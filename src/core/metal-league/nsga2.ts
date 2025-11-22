/**
 * NSGA-II Multi-Objective Evolutionary Algorithm
 * 
 * Core engine for Pareto frontier evolution.
 * Implements fast non-dominated sorting and crowding distance.
 */

import { ObjectiveSpec, ObjectiveVector, noWorse, strictlyBetter } from '../laws-physics/objectives';

export interface Genome {
  id: string;
  objectives: ObjectiveVector;
  rank?: number;
  crowding?: number;
  [key: string]: unknown;
}

/**
 * Check if genome 'a' Pareto-dominates genome 'b'.
 * a dominates b if a is no worse in all objectives and strictly better in at least one.
 */
export function dominates(
  a: Genome,
  b: Genome,
  specs: ObjectiveSpec[]
): boolean {
  if (a.objectives.values.length !== specs.length ||
      b.objectives.values.length !== specs.length) {
    throw new Error('Objective vector length must match specs');
  }

  let strictlyBetterInOne = false;
  
  for (let i = 0; i < specs.length; i++) {
    const sense = specs[i].sense;
    const av = a.objectives.values[i];
    const bv = b.objectives.values[i];
    
    if (!noWorse(av, bv, sense)) {
      return false; // a is worse than b in this objective
    }
    
    if (strictlyBetter(av, bv, sense)) {
      strictlyBetterInOne = true;
    }
  }
  
  return strictlyBetterInOne;
}

/**
 * Fast non-dominated sorting (NSGA-II).
 * Returns array of fronts where front[0] is Pareto-optimal.
 */
export function fastNonDominatedSort(
  population: Genome[],
  specs: ObjectiveSpec[]
): Genome[][] {
  const fronts: Genome[][] = [];
  const S = new Map<string, Genome[]>(); // solutions each genome dominates
  const n = new Map<string, number>();   // domination count
  
  // Initialize
  for (const p of population) {
    S.set(p.id, []);
    n.set(p.id, 0);
  }
  
  // Find dominance relationships
  for (const p of population) {
    for (const q of population) {
      if (p.id === q.id) continue;
      
      if (dominates(p, q, specs)) {
        S.get(p.id)!.push(q);
      } else if (dominates(q, p, specs)) {
        n.set(p.id, (n.get(p.id) ?? 0) + 1);
      }
    }
    
    // If not dominated by anyone, belongs to front 0
    if (n.get(p.id) === 0) {
      p.rank = 0;
      if (!fronts[0]) fronts[0] = [];
      fronts[0].push(p);
    }
  }
  
  // Build subsequent fronts
  let i = 0;
  while (fronts[i] && fronts[i].length > 0) {
    const nextFront: Genome[] = [];
    
    for (const p of fronts[i]) {
      for (const q of S.get(p.id) ?? []) {
        n.set(q.id, (n.get(q.id) ?? 0) - 1);
        if (n.get(q.id) === 0) {
          q.rank = i + 1;
          nextFront.push(q);
        }
      }
    }
    
    if (nextFront.length > 0) {
      fronts[i + 1] = nextFront;
    }
    i++;
  }
  
  return fronts.filter(f => f.length > 0);
}

/**
 * Calculate crowding distance for diversity within a front.
 * Higher crowding distance = more isolated = more valuable for diversity.
 */
export function crowdingDistance(
  front: Genome[],
  specs: ObjectiveSpec[]
): Map<string, number> {
  const distances = new Map<string, number>();
  
  if (front.length === 0) return distances;
  
  // Initialize distances
  for (const g of front) {
    distances.set(g.id, 0);
  }
  
  // Boundary solutions get infinite distance
  if (front.length <= 2) {
    for (const g of front) {
      distances.set(g.id, Infinity);
      g.crowding = Infinity; // Set on genome too
    }
    return distances;
  }
  
  // For each objective
  for (let m = 0; m < specs.length; m++) {
    const sense = specs[m].sense;
    
    // Sort by this objective
    const sorted = [...front].sort((a, b) => {
      const av = a.objectives.values[m];
      const bv = b.objectives.values[m];
      return sense === 'max' ? bv - av : av - bv;
    });
    
    // Boundary points get infinite distance
    distances.set(sorted[0].id, Infinity);
    distances.set(sorted[sorted.length - 1].id, Infinity);
    
    // Calculate range
    const minVal = sorted[sorted.length - 1].objectives.values[m];
    const maxVal = sorted[0].objectives.values[m];
    const range = maxVal - minVal;
    
    if (range < 1e-10) continue; // avoid division by zero
    
    // Calculate distances for middle points
    for (let i = 1; i < sorted.length - 1; i++) {
      const prev = sorted[i - 1].objectives.values[m];
      const next = sorted[i + 1].objectives.values[m];
      const dist = distances.get(sorted[i].id) ?? 0;
      distances.set(sorted[i].id, dist + Math.abs(next - prev) / range);
    }
  }
  
  // Set crowding on genomes
  for (const g of front) {
    g.crowding = distances.get(g.id) ?? 0;
  }
  
  return distances;
}

/**
 * Binary tournament selection by rank and crowding.
 * Lower rank wins; if tied, higher crowding wins.
 */
export function tournamentSelect(population: Genome[]): Genome {
  const a = population[Math.floor(Math.random() * population.length)];
  const b = population[Math.floor(Math.random() * population.length)];
  
  const rankA = a.rank ?? Infinity;
  const rankB = b.rank ?? Infinity;
  
  if (rankA < rankB) return a;
  if (rankB < rankA) return b;
  
  // Same rank, use crowding
  const crowdA = a.crowding ?? 0;
  const crowdB = b.crowding ?? 0;
  
  return crowdA >= crowdB ? a : b;
}

/**
 * Select next generation using elitism + crowding.
 */
export function nsga2Select(
  population: Genome[],
  specs: ObjectiveSpec[],
  targetSize: number
): Genome[] {
  const fronts = fastNonDominatedSort(population, specs);
  
  // Calculate crowding for each front
  for (const front of fronts) {
    crowdingDistance(front, specs);
  }
  
  const selected: Genome[] = [];
  
  // Fill with whole fronts while possible
  for (const front of fronts) {
    if (selected.length + front.length <= targetSize) {
      selected.push(...front);
    } else {
      // Sort remaining by crowding and take best
      const sorted = [...front].sort((a, b) => (b.crowding ?? 0) - (a.crowding ?? 0));
      const remaining = targetSize - selected.length;
      selected.push(...sorted.slice(0, remaining));
      break;
    }
  }
  
  return selected;
}
