/**
 * Proof Gate System
 * 
 * "No mutation without proof" - Law 3 of the Extreme Rulebook.
 * Every agent mutation must pass verification gates before entering the next generation.
 * 
 * Proof-carrying evolution: agents carry certificates that they satisfy their specs.
 */

import { MetaAgent } from '../agents-runtime/agent';
import { learningEnergy, isStable } from '../laws-physics/hilbert';
import { ObjectiveSpec, satisfiesLaw, Law } from '../laws-physics/objectives';

/**
 * Verification result.
 */
export interface VerificationResult {
  passed: boolean;
  reason?: string;
  timestamp: number;
  checks: CheckResult[];
}

/**
 * Individual check result.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  value?: number;
  threshold?: number;
  message?: string;
}

/**
 * Proof gate configuration.
 */
export interface ProofGateConfig {
  /** Minimum objectives that must be satisfied */
  laws: Law[];
  
  /** Maximum privacy loss allowed */
  maxPrivacyLoss: number;
  
  /** Maximum cost allowed */
  maxCost: number;
  
  /** Require stable learning state */
  requireStability: boolean;
  
  /** Stability epsilon */
  stabilityEpsilon: number;
}

/**
 * Default proof gate configuration.
 */
export const DEFAULT_PROOF_GATE: ProofGateConfig = {
  laws: [
    {
      name: 'min-gain',
      evaluate: (agent: MetaAgent) => agent.objectives.values[0],
      sense: 'max',
      threshold: 0.1,
    },
    {
      name: 'max-latency',
      evaluate: (agent: MetaAgent) => agent.objectives.values[1],
      sense: 'min',
      threshold: 1000,
    },
  ],
  maxPrivacyLoss: 1.0,
  maxCost: 10.0,
  requireStability: true,
  stabilityEpsilon: 0.1,
};

/**
 * Verify an agent against proof gate requirements.
 */
export function verifyAgent(
  agent: MetaAgent,
  config: ProofGateConfig = DEFAULT_PROOF_GATE
): VerificationResult {
  const checks: CheckResult[] = [];
  let passed = true;

  // Check 1: Laws (invariants)
  for (const law of config.laws) {
    const value = law.evaluate(agent);
    const lawPassed = satisfiesLaw(law, value);
    
    checks.push({
      name: law.name,
      passed: lawPassed,
      value,
      threshold: law.threshold,
      message: lawPassed
        ? `${law.name} satisfied`
        : `${law.name} failed: ${value} vs threshold ${law.threshold}`,
    });
    
    if (!lawPassed) passed = false;
  }

  // Check 2: Privacy loss
  const privacyLossIdx = 4; // position in objective vector
  const privacyLoss = agent.objectives.values[privacyLossIdx];
  const privacyPassed = privacyLoss <= config.maxPrivacyLoss;
  
  checks.push({
    name: 'privacy-loss',
    passed: privacyPassed,
    value: privacyLoss,
    threshold: config.maxPrivacyLoss,
    message: privacyPassed
      ? 'Privacy budget satisfied'
      : `Privacy loss ${privacyLoss} exceeds limit ${config.maxPrivacyLoss}`,
  });
  
  if (!privacyPassed) passed = false;

  // Check 3: Cost
  const costIdx = 5; // position in objective vector
  const cost = agent.objectives.values[costIdx];
  const costPassed = cost <= config.maxCost;
  
  checks.push({
    name: 'cost',
    passed: costPassed,
    value: cost,
    threshold: config.maxCost,
    message: costPassed
      ? 'Cost budget satisfied'
      : `Cost ${cost} exceeds limit ${config.maxCost}`,
  });
  
  if (!costPassed) passed = false;

  // Check 4: Stability (if required)
  if (config.requireStability) {
    const stable = isStable(agent.perception.state, config.stabilityEpsilon);
    const energy = learningEnergy(agent.perception.state);
    
    checks.push({
      name: 'stability',
      passed: stable,
      value: energy,
      message: stable
        ? `Learning state is stable (energy=${energy.toFixed(4)})`
        : `Learning state is unstable (energy=${energy.toFixed(4)})`,
    });
    
    if (!stable) passed = false;
  }

  // Check 5: Tool cost budget
  const toolCost = agent.coordination.tools.reduce((sum, t) => sum + t.cost, 0);
  const toolBudgetPassed = toolCost <= config.maxCost * 0.5; // tools can't exceed 50% of total cost
  
  checks.push({
    name: 'tool-budget',
    passed: toolBudgetPassed,
    value: toolCost,
    threshold: config.maxCost * 0.5,
    message: toolBudgetPassed
      ? 'Tool budget satisfied'
      : `Tool cost ${toolCost} exceeds budget ${config.maxCost * 0.5}`,
  });
  
  if (!toolBudgetPassed) passed = false;

  return {
    passed,
    reason: passed ? 'All checks passed' : 'Some checks failed',
    timestamp: Date.now(),
    checks,
  };
}

/**
 * Apply proof gate to a population.
 * Returns only agents that pass verification.
 */
export function applyProofGate(
  population: MetaAgent[],
  config: ProofGateConfig = DEFAULT_PROOF_GATE
): {
  passed: MetaAgent[];
  failed: MetaAgent[];
  results: Map<string, VerificationResult>;
} {
  const passed: MetaAgent[] = [];
  const failed: MetaAgent[] = [];
  const results = new Map<string, VerificationResult>();

  for (const agent of population) {
    const result = verifyAgent(agent, config);
    results.set(agent.id, result);
    
    if (result.passed) {
      // Attach proof bundle to agent
      agent.proof = {
        spec: `Verified against ${config.laws.length} laws + privacy/cost/stability`,
        proof: JSON.stringify(result.checks),
        verified: true,
        timestamp: result.timestamp,
      };
      passed.push(agent);
    } else {
      failed.push(agent);
    }
  }

  return { passed, failed, results };
}

/**
 * Generate a proof certificate string for an agent.
 */
export function generateProofCertificate(agent: MetaAgent): string {
  if (!agent.proof) {
    return 'No proof certificate available';
  }
  
  const lines = [
    '=== PROOF CERTIFICATE ===',
    `Agent: ${agent.id}`,
    `Kind: ${agent.kind}`,
    `Generation: ${agent.generation}`,
    `Timestamp: ${new Date(agent.proof.timestamp).toISOString()}`,
    `Verified: ${agent.proof.verified}`,
    '',
    'Spec:',
    agent.proof.spec,
    '',
    'Proof:',
    agent.proof.proof,
    '',
    'Lineage:',
    ...agent.lineage.map(l => `  - ${l}`),
    '========================',
  ];
  
  return lines.join('\n');
}

/**
 * Check if an agent's proof is still valid (not expired).
 */
export function isProofValid(agent: MetaAgent, maxAgeMs = 3600000): boolean {
  if (!agent.proof) return false;
  if (!agent.proof.verified) return false;
  
  const age = Date.now() - agent.proof.timestamp;
  return age <= maxAgeMs;
}
