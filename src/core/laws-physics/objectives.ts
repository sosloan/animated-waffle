/**
 * Laws of Physics: Formal objective vectors and invariants
 * 
 * This is the mathematical core - the "laws" that govern agent evolution.
 * Every agent has a multi-objective fitness vector that determines
 * its position on the Pareto frontier.
 */

export type ObjectiveSense = "max" | "min";

/**
 * Specification for a single objective dimension.
 * Examples: gain (max), latency (min), privacy (max), cost (min)
 */
export interface ObjectiveSpec {
  name: string;
  sense: ObjectiveSense;
  weight?: number; // optional for scalarization/tie-breaking
}

/**
 * Multi-objective fitness vector.
 * Each value corresponds to an ObjectiveSpec in the same order.
 */
export interface ObjectiveVector {
  values: number[];
  timestamp: number;
}

/**
 * Standard objective set for educational/world-model agents.
 * This is the "default physics" but can be extended/modified per domain.
 */
export const DEFAULT_OBJECTIVES: ObjectiveSpec[] = [
  { name: "gain", sense: "max" },           // learning improvement / accuracy
  { name: "latency", sense: "min" },        // response time p95
  { name: "engagement", sense: "max" },     // retention / flow / affect
  { name: "fairness", sense: "max" },       // equity across groups
  { name: "privacyLoss", sense: "min" },    // DP epsilon spent
  { name: "cost", sense: "min" },           // compute / API / tool spend
];

/**
 * Law: an invariant that must hold for all agents.
 * Examples: energy >= 0, privacy <= epsilon, latency <= budget
 */
export interface Law {
  name: string;
  evaluate: (context: unknown) => number;
  sense: "min" | "max";
  threshold?: number;
}

/**
 * Check if value satisfies the law based on sense and threshold.
 */
export function satisfiesLaw(law: Law, value: number): boolean {
  if (law.threshold === undefined) return true;
  
  if (law.sense === "max") {
    return value >= law.threshold;
  } else {
    return value <= law.threshold;
  }
}

/**
 * Compare two objective values under a given sense.
 * Returns true if 'a' is no worse than 'b'.
 */
export function noWorse(a: number, b: number, sense: ObjectiveSense): boolean {
  return sense === "max" ? a >= b : a <= b;
}

/**
 * Compare two objective values under a given sense.
 * Returns true if 'a' is strictly better than 'b'.
 */
export function strictlyBetter(a: number, b: number, sense: ObjectiveSense): boolean {
  return sense === "max" ? a > b : a < b;
}
