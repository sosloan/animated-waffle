// router/evolution_router.ts
// Bell Labs in Cleats — Evolution Router
// "Every compute is a test": routing itself is an online experiment.

import xxhash from "xxhash-wasm";
import registry from "../agents/registry.json";

// ---------- Types ----------

export type Layer = "perception" | "reasoning" | "coordination" | "execution" | "verification" | "presentation";

export interface RoutingContext {
  userId?: string;
  phase?: number;                 // 0..7
  domain?: string;                // embodied_control, nav_sim, etc.
  taskType?: string;              // next_action, multi_agent_future, etc.
  tags: string[];                 // from request parsing / Rosetta keeper
  stack?: string[];               // swift, rust, mojo, metal, python...
  risk?: "low" | "medium" | "high";
}

export interface AgentSpec {
  id: string;
  layer: Layer;
  triggers: string[];
  inputs: string[];
  outputs: string[];
  tags: string[];
}

export interface RoutedTask {
  agentId: string;
  confidence: number;
  reason: string[];
  payload: any; // FRECS event payload
}

export interface BanditArmState {
  agentId: string;
  pulls: number;
  meanReward: number;
  lastReward?: number;
}

export interface BanditState {
  explorationRate: number;
  arms: Record<string, BanditArmState>;
}

export interface RouterResult {
  tasks: RoutedTask[];
  chosen: string[];
  exploration: number;
  trace: {
    hash: number;
    scores: Record<string, number>;
    reasons: Record<string, string[]>;
  };
}

interface RegistryData {
  version: string;
  defaultRouting: {
    topK: number;
    explorationRate: number;
    minConfidence: number;
  };
  agents: Record<string, AgentSpec>;
}

// ---------- Constants ----------

const HASH_EXPLORATION_DIVISOR = 1000;

// ---------- Helpers ----------

function getAgents(): AgentSpec[] {
  const registryData = registry as RegistryData;
  return Object.values(registryData.agents);
}

function normalizeScore(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

// ---------- Contextual scoring ----------

function scoreAgent(ctx: RoutingContext, agent: AgentSpec) {
  const ctxTags = new Set(ctx.tags.map(t => t.toLowerCase()));
  const trig = new Set(agent.triggers.map(t => t.toLowerCase()));
  const tagOverlap = jaccard(ctxTags, trig);

  const domainBoost = agent.triggers.includes(ctx.domain ?? "") ? 0.2 : 0;
  const taskBoost = agent.triggers.includes(ctx.taskType ?? "") ? 0.2 : 0;

  const stackBoost =
    ctx.stack && ctx.stack.some(s => agent.triggers.includes(s.toLowerCase()))
      ? 0.15
      : 0;

  const riskPenalty =
    ctx.risk === "high" && !agent.tags.includes("safety")
      ? -0.25
      : 0;

  const raw = tagOverlap + domainBoost + taskBoost + stackBoost + riskPenalty;
  const score = normalizeScore(raw);

  const reasons: string[] = [];
  if (tagOverlap > 0) reasons.push(`trigger_overlap=${tagOverlap.toFixed(2)}`);
  if (domainBoost) reasons.push(`domain_boost=${domainBoost}`);
  if (taskBoost) reasons.push(`task_boost=${taskBoost}`);
  if (stackBoost) reasons.push(`stack_boost=${stackBoost}`);
  if (riskPenalty) reasons.push(`risk_penalty=${riskPenalty}`);

  return { score, reasons };
}

// ---------- Bandit policy (UCB + epsilon mix) ----------

export function initBanditState(explorationRate?: number): BanditState {
  const registryData = registry as RegistryData;
  const rate = explorationRate ?? registryData.defaultRouting.explorationRate;
  const arms: Record<string, BanditArmState> = {};
  for (const a of getAgents()) {
    arms[a.id] = { agentId: a.id, pulls: 0, meanReward: 0 };
  }
  return { explorationRate: rate, arms };
}

function ucbScore(arm: BanditArmState, totalPulls: number) {
  if (arm.pulls === 0) return Infinity;
  const c = 1.2;
  return arm.meanReward + c * Math.sqrt(Math.log(totalPulls + 1) / arm.pulls);
}

/** Update after a run finishes: reward in [0,1] */
export function updateBandit(state: BanditState, agentId: string, reward: number) {
  const arm = state.arms[agentId];
  if (!arm) return;
  arm.pulls += 1;
  arm.lastReward = reward;
  arm.meanReward = arm.meanReward + (reward - arm.meanReward) / arm.pulls;
}

/** Choose topK agents with epsilon-greedy over UCB */
export async function route(
  ctx: RoutingContext,
  bandit: BanditState,
  topK?: number
): Promise<RouterResult> {
  const registryData = registry as RegistryData;
  const k = topK ?? registryData.defaultRouting.topK;
  const agents = getAgents();

  // deterministic hash for "every 1 has 2 and every 2 has one"
  const seedStr = `${ctx.userId ?? "anon"}|${ctx.phase ?? 0}|${ctx.domain ?? ""}|${ctx.taskType ?? ""}|${ctx.tags.join(",")}`;
  const xx = await xxhash();
  const h = xx.h32(seedStr, 0xC1EA75);

  const scores: Record<string, number> = {};
  const reasons: Record<string, string[]> = {};
  for (const agent of agents) {
    const { score, reasons: rs } = scoreAgent(ctx, agent);
    scores[agent.id] = score;
    reasons[agent.id] = rs;
  }

  // combine contextual score + bandit UCB
  const totalPulls = Object.values(bandit.arms).reduce((s, a) => s + a.pulls, 0);
  const combined = agents.map(a => {
    const arm = bandit.arms[a.id];
    const ucb = arm ? ucbScore(arm, totalPulls) : 0;
    const ctxScore = scores[a.id];
    // UCB dominates early, context dominates later
    const mix = arm && arm.pulls < 5 ? 0.35 : 0.7;
    const finalScore = normalizeScore(mix * ctxScore + (1 - mix) * (isFinite(ucb) ? Math.tanh(ucb) : 1));
    return { agent: a, finalScore };
  }).sort((x, y) => y.finalScore - x.finalScore);

  // epsilon exploration
  const eps = bandit.explorationRate;
  const chosen: AgentSpec[] = [];
  const used = new Set<string>();

  for (let i = 0; i < k; i++) {
    const explore = (h % HASH_EXPLORATION_DIVISOR) / HASH_EXPLORATION_DIVISOR < eps; // hash-driven but stable
    let pick: AgentSpec | null = null;

    if (explore) {
      const pool = combined.filter(c => !used.has(c.agent.id));
      pick = pool[Math.floor((h + i) % pool.length)]?.agent ?? null;
    } else {
      pick = combined.find(c => !used.has(c.agent.id))?.agent ?? null;
    }

    if (pick) {
      chosen.push(pick);
      used.add(pick.id);
    }
  }

  // build FRECS tasks
  const tasks: RoutedTask[] = chosen.map((a, idx) => ({
    agentId: a.id,
    confidence: combined.find(c => c.agent.id === a.id)?.finalScore ?? 0,
    reason: reasons[a.id] ?? [],
    payload: {
      type: "FRECS_TASK",
      stripe: a.layer,
      agent: a.id,
      context: ctx,
      order: idx,
      hash: h
    }
  }));

  return {
    tasks,
    chosen: chosen.map(c => c.id),
    exploration: eps,
    trace: { hash: h, scores, reasons }
  };
}

// ---------- Fan-in reducer (Film Room → DELTA → Beta) ----------

export function fanIn(results: Array<{ agentId: string; output: any }>) {
  return {
    type: "FRECS_FANIN",
    results,
    // downstream canonical consumers:
    to: ["FilmRoom", "DELTA", "Beta", "Alex"]
  };
}
