/**
 * Tri-Layer Agent Runtime
 * 
 * Every agent is a triple-stack organism:
 * - Perception (Π): neural/tensors/embeddings in Hilbert space
 * - Reasoning (ℛ): symbolic/rules/plans/facts  
 * - Coordination (𝒞): agentic/tools/memory/decisions
 * 
 * This is the core "physics" that all agents share.
 */

import { HilbertState } from '../laws-physics/hilbert';
import { ObjectiveVector } from '../laws-physics/objectives';

/**
 * Agent kind in the evolving hierarchy.
 */
export type AgentKind =
  | 'student'              // learns, provides feedback
  | 'tutor'                // teaches, adapts to students
  | 'curriculumDesigner'   // generates task sequences
  | 'pedagogyTheorist'     // discovers meta-learning laws
  | 'theoremProver'        // proves guarantees about learning
  | 'metaDesigner';        // designs the designers

/**
 * Symbolic item: facts, rules, plans.
 */
export type SymbolicItem =
  | { type: 'fact'; content: string }
  | { type: 'rule'; condition: string; action: string }
  | { type: 'plan'; steps: string[]; goal: string };

/**
 * Tool specification.
 */
export interface Tool {
  name: string;
  cost: number;
  preconditions?: string[];
  effects?: string[];
}

/**
 * Memory entry.
 */
export interface MemoryEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl?: number; // time to live in ms
}

/**
 * Perception Layer: Neural/tensor processing.
 */
export interface Perception {
  /** Current state in Hilbert space */
  state: HilbertState;
  
  /** Uncertainty measure */
  uncertainty: number;
  
  /** Provenance trace */
  provenance: string[];
  
  /** Last update timestamp */
  timestamp: number;
}

/**
 * Reasoning Layer: Symbolic processing.
 */
export interface Reasoning {
  /** Knowledge base: facts, rules, plans */
  knowledge: SymbolicItem[];
  
  /** Active goals */
  goals: string[];
  
  /** Current plan being executed */
  activePlan?: SymbolicItem;
}

/**
 * Coordination Layer: Agentic decisions.
 */
export interface Coordination {
  /** Available tools */
  tools: Tool[];
  
  /** Working memory */
  memory: MemoryEntry[];
  
  /** Decision history */
  decisions: string[];
  
  /** Communication partners */
  partners: string[]; // agent IDs
}

/**
 * Proof bundle: certificate that an agent satisfies its spec.
 */
export interface ProofBundle {
  spec: string;
  proof: string;
  verified: boolean;
  timestamp: number;
}

/**
 * Meta-agent: the complete tri-layer organism.
 */
export interface MetaAgent {
  id: string;
  kind: AgentKind;
  generation: number;
  
  /** PERCEPTION layer */
  perception: Perception;
  
  /** REASONING layer */
  reasoning: Reasoning;
  
  /** COORDINATION layer */
  coordination: Coordination;
  
  /** Multi-objective fitness */
  objectives: ObjectiveVector;
  
  /** Proof certificate */
  proof?: ProofBundle;
  
  /** Parent lineage */
  lineage: string[];
  
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Create a new agent with default initialization.
 */
export function createAgent(
  id: string,
  kind: AgentKind,
  stateDim = 8
): MetaAgent {
  return {
    id,
    kind,
    generation: 0,
    perception: {
      state: Array.from({ length: stateDim }, () => ({ re: 0, im: 0 })),
      uncertainty: 1.0,
      provenance: ['init'],
      timestamp: Date.now(),
    },
    reasoning: {
      knowledge: [],
      goals: [],
    },
    coordination: {
      tools: [],
      memory: [],
      decisions: [],
      partners: [],
    },
    objectives: {
      values: [0, 0, 0, 0, 0, 0], // [gain, latency, engagement, fairness, privacy, cost]
      timestamp: Date.now(),
    },
    lineage: ['genesis'],
    metadata: {},
  };
}

/**
 * Clone an agent (for mutation/crossover).
 */
export function cloneAgent(agent: MetaAgent, newId?: string): MetaAgent {
  return {
    ...agent,
    id: newId ?? `${agent.id}-clone`,
    perception: {
      ...agent.perception,
      state: [...agent.perception.state],
      provenance: [...agent.perception.provenance, 'clone'],
    },
    reasoning: {
      ...agent.reasoning,
      knowledge: [...agent.reasoning.knowledge],
      goals: [...agent.reasoning.goals],
    },
    coordination: {
      ...agent.coordination,
      tools: [...agent.coordination.tools],
      memory: [...agent.coordination.memory],
      decisions: [...agent.coordination.decisions],
      partners: [...agent.coordination.partners],
    },
    objectives: {
      ...agent.objectives,
      values: [...agent.objectives.values],
    },
    lineage: [...agent.lineage, `clone-from:${agent.id}`],
  };
}

/**
 * Add a fact to an agent's knowledge base.
 */
export function addFact(agent: MetaAgent, fact: string): void {
  agent.reasoning.knowledge.push({ type: 'fact', content: fact });
}

/**
 * Add a tool to an agent's coordination layer.
 */
export function addTool(agent: MetaAgent, tool: Tool): void {
  agent.coordination.tools.push(tool);
}

/**
 * Record a decision in an agent's history.
 */
export function recordDecision(agent: MetaAgent, decision: string): void {
  agent.coordination.decisions.push(decision);
}

/**
 * Update agent's perception state.
 */
export function updatePerception(
  agent: MetaAgent,
  newState: HilbertState,
  provenance: string
): void {
  agent.perception.state = newState;
  agent.perception.provenance.push(provenance);
  agent.perception.timestamp = Date.now();
}
