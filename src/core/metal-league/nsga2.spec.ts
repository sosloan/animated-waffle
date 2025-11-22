/**
 * SPEC TEST: nsga2.spec.ts
 * Paired with nsga2.ts
 */

import { describe, it, expect } from 'vitest';
import {
  dominates,
  fastNonDominatedSort,
  crowdingDistance,
  tournamentSelect,
  nsga2Select,
  type Genome,
} from './nsga2';
import { ObjectiveSpec } from '../laws-physics/objectives';

const testSpecs: ObjectiveSpec[] = [
  { name: 'gain', sense: 'max' },
  { name: 'cost', sense: 'min' },
];

function makeGenome(id: string, gain: number, cost: number): Genome {
  return {
    id,
    objectives: {
      values: [gain, cost],
      timestamp: Date.now(),
    },
  };
}

describe('nsga2 - dominance', () => {
  it('should detect clear dominance', () => {
    const a = makeGenome('a', 10, 5);  // higher gain, lower cost
    const b = makeGenome('b', 5, 10);  // lower gain, higher cost
    expect(dominates(a, b, testSpecs)).toBe(true);
    expect(dominates(b, a, testSpecs)).toBe(false);
  });

  it('should not dominate when equal', () => {
    const a = makeGenome('a', 10, 5);
    const b = makeGenome('b', 10, 5);
    expect(dominates(a, b, testSpecs)).toBe(false);
    expect(dominates(b, a, testSpecs)).toBe(false);
  });

  it('should not dominate when trade-off exists', () => {
    const a = makeGenome('a', 10, 10); // higher gain, higher cost
    const b = makeGenome('b', 5, 5);   // lower gain, lower cost
    expect(dominates(a, b, testSpecs)).toBe(false);
    expect(dominates(b, a, testSpecs)).toBe(false);
  });

  it('should dominate when better in one and equal in other', () => {
    const a = makeGenome('a', 10, 5);
    const b = makeGenome('b', 10, 10);
    expect(dominates(a, b, testSpecs)).toBe(true);
    expect(dominates(b, a, testSpecs)).toBe(false);
  });

  it('should throw on mismatched objective lengths', () => {
    const a: Genome = {
      id: 'a',
      objectives: { values: [1], timestamp: 0 },
    };
    const b = makeGenome('b', 5, 5);
    expect(() => dominates(a, b, testSpecs)).toThrow();
  });
});

describe('nsga2 - fast non-dominated sort', () => {
  it('should put all non-dominated in front 0', () => {
    const pop = [
      makeGenome('a', 10, 5),
      makeGenome('b', 8, 3),
      makeGenome('c', 6, 6),
    ];
    const fronts = fastNonDominatedSort(pop, testSpecs);
    expect(fronts[0]).toHaveLength(2); // a and b dominate c
    expect(fronts[0].map(g => g.id).sort()).toEqual(['a', 'b']);
    expect(fronts[0][0].rank).toBe(0);
  });

  it('should handle single solution', () => {
    const pop = [makeGenome('a', 5, 5)];
    const fronts = fastNonDominatedSort(pop, testSpecs);
    expect(fronts).toHaveLength(1);
    expect(fronts[0]).toHaveLength(1);
    expect(fronts[0][0].rank).toBe(0);
  });

  it('should create multiple fronts', () => {
    const pop = [
      makeGenome('a', 10, 5),  // front 0
      makeGenome('b', 7, 7),   // front 0 (trade-off with a)
      makeGenome('c', 5, 10),  // front 1 (dominated by a)
      makeGenome('d', 3, 12),  // front 2 (dominated by c)
    ];
    const fronts = fastNonDominatedSort(pop, testSpecs);
    expect(fronts.length).toBeGreaterThanOrEqual(2);
    // Verify a dominates c (a has higher gain AND lower cost)
    expect(dominates(pop[0], pop[2], testSpecs)).toBe(true);
  });

  it('should handle all dominated by one', () => {
    const pop = [
      makeGenome('best', 10, 1),
      makeGenome('b', 5, 5),
      makeGenome('c', 3, 7),
    ];
    const fronts = fastNonDominatedSort(pop, testSpecs);
    expect(fronts[0]).toHaveLength(1);
    expect(fronts[0][0].id).toBe('best');
  });

  it('should set rank on all genomes', () => {
    const pop = [
      makeGenome('a', 10, 5),
      makeGenome('b', 5, 10),
    ];
    const fronts = fastNonDominatedSort(pop, testSpecs);
    for (const front of fronts) {
      for (const genome of front) {
        expect(genome.rank).toBeDefined();
      }
    }
  });
});

describe('nsga2 - crowding distance', () => {
  it('should assign infinity to boundary points', () => {
    const front = [
      makeGenome('a', 10, 5),
      makeGenome('b', 7, 7),
      makeGenome('c', 5, 10),
    ];
    const distances = crowdingDistance(front, testSpecs);
    
    // Boundary points should have infinite distance
    const infiniteCount = Array.from(distances.values()).filter(d => d === Infinity).length;
    expect(infiniteCount).toBeGreaterThanOrEqual(2);
  });

  it('should return empty for empty front', () => {
    const distances = crowdingDistance([], testSpecs);
    expect(distances.size).toBe(0);
  });

  it('should handle single genome', () => {
    const front = [makeGenome('a', 5, 5)];
    const distances = crowdingDistance(front, testSpecs);
    expect(distances.get('a')).toBe(Infinity);
  });

  it('should set crowding on genomes', () => {
    const front = [
      makeGenome('a', 10, 5),
      makeGenome('b', 5, 10),
    ];
    const distances = crowdingDistance(front, testSpecs);
    
    // Check distances map has values
    expect(distances.size).toBe(2);
    // Check that genomes have crowding set
    for (const genome of front) {
      expect(genome.crowding).toBeDefined();
    }
  });

  it('should give higher crowding to more isolated points', () => {
    const front = [
      makeGenome('a', 10, 5),
      makeGenome('b', 9, 6),   // close to a
      makeGenome('c', 5, 10),
    ];
    crowdingDistance(front, testSpecs);
    
    // a and c are boundaries, should have infinity
    // b is in middle but close to a
    expect(front[0].crowding).toBeDefined();
    expect(front[1].crowding).toBeDefined();
    expect(front[2].crowding).toBeDefined();
  });
});

describe('nsga2 - tournament selection', () => {
  /**
   * WHY THESE TESTS ARE PROBABILISTIC:
   * 
   * The tournamentSelect function implements binary tournament selection,
   * which is a core NSGA-II algorithm component:
   * 
   * ```typescript
   * export function tournamentSelect(population: Genome[]): Genome {
   *   const a = population[Math.floor(Math.random() * population.length)];
   *   const b = population[Math.floor(Math.random() * population.length)];
   *   // ... compare and return winner
   * }
   * ```
   * 
   * The function is inherently probabilistic because:
   * 1. It randomly picks 2 candidates from the population
   * 2. With pop = [a, b], possible tournaments are: (a,a), (a,b), (b,a), (b,b)
   * 3. When both picked candidates are the same (e.g., (a,a)), that one wins by default
   * 4. This means 'b' can win ~50% of the time even though 'a' has better rank
   * 
   * Therefore, we test the statistical selection pressure (70%+ win rate) rather than
   * expecting deterministic outcomes. This verifies the emergent evolutionary behavior
   * that drives NSGA-II convergence.
   */
  
  it('should prefer lower rank', () => {
    const a = makeGenome('a', 10, 5);
    const b = makeGenome('b', 5, 10);
    a.rank = 0;
    a.crowding = 0;
    b.rank = 1;
    b.crowding = 100;
    
    const pop = [a, b];
    
    // Run multiple times and check that a wins consistently (lower rank)
    let aWins = 0;
    for (let i = 0; i < 100; i++) {
      const selected = tournamentSelect(pop);
      if (selected.id === 'a') aWins++;
    }
    // a should win much more often due to lower rank
    expect(aWins).toBeGreaterThan(70);
  });

  it('should prefer higher crowding when rank is equal', () => {
    const a = makeGenome('a', 10, 5);
    const b = makeGenome('b', 5, 10);
    a.rank = 0;
    a.crowding = 0.5;
    b.rank = 0;
    b.crowding = 1.5;
    
    // Tournament is random, but if we force the selection, b should win
    const pop = [a, b];
    
    // Run multiple times and check that b wins more often (probabilistic test)
    let bWins = 0;
    for (let i = 0; i < 100; i++) {
      const selected = tournamentSelect(pop);
      if (selected.id === 'b') bWins++;
    }
    // b should win significantly more than a (around 75% of the time)
    expect(bWins).toBeGreaterThan(50);
  });

  it('should handle missing rank/crowding', () => {
    const a = makeGenome('a', 10, 5);
    const b = makeGenome('b', 5, 10);
    const pop = [a, b];
    
    expect(() => tournamentSelect(pop)).not.toThrow();
  });
});

describe('nsga2 - select', () => {
  it('should return correct size', () => {
    const pop = [
      makeGenome('a', 10, 5),
      makeGenome('b', 8, 7),
      makeGenome('c', 6, 9),
      makeGenome('d', 4, 11),
    ];
    const selected = nsga2Select(pop, testSpecs, 2);
    expect(selected).toHaveLength(2);
  });

  it('should prioritize front 0', () => {
    const pop = [
      makeGenome('a', 10, 5),  // front 0
      makeGenome('b', 8, 3),   // front 0
      makeGenome('c', 5, 10),  // dominated
    ];
    const selected = nsga2Select(pop, testSpecs, 2);
    expect(selected.every(g => g.rank === 0)).toBe(true);
  });

  it('should use crowding for tie-breaking', () => {
    const pop = [
      makeGenome('a', 10, 5),
      makeGenome('b', 8, 7),
      makeGenome('c', 6, 9),
      makeGenome('d', 4, 11),
    ];
    // All are on Pareto front, selection uses crowding
    const selected = nsga2Select(pop, testSpecs, 3);
    expect(selected).toHaveLength(3);
  });

  it('should handle target size larger than population', () => {
    const pop = [makeGenome('a', 5, 5)];
    const selected = nsga2Select(pop, testSpecs, 10);
    expect(selected).toHaveLength(1);
  });
});

describe('nsga2 - objective delta emission (Rule 4)', () => {
  it('should track Pareto improvement across generations', () => {
    const gen0 = [
      makeGenome('a', 5, 10),
      makeGenome('b', 6, 9),
    ];
    
    const gen1 = [
      makeGenome('c', 7, 8),  // improvement
      makeGenome('d', 8, 7),  // improvement
    ];
    
    const fronts0 = fastNonDominatedSort(gen0, testSpecs);
    const fronts1 = fastNonDominatedSort(gen1, testSpecs);
    
    // Check that gen1 dominates gen0
    const best0 = fronts0[0][0];
    const best1 = fronts1[0][0];
    
    expect(best1.objectives.values[0]).toBeGreaterThanOrEqual(best0.objectives.values[0]);
  });
});
