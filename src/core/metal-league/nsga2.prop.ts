/**
 * PROPERTY TEST: nsga2.prop.ts
 * Property-based tests for NSGA-II
 */

import { describe, it, expect } from 'vitest';
import {
  dominates,
  fastNonDominatedSort,
  crowdingDistance,
  type Genome,
} from './nsga2';
import { ObjectiveSpec } from '../laws-physics/objectives';

const testSpecs: ObjectiveSpec[] = [
  { name: 'gain', sense: 'max' },
  { name: 'cost', sense: 'min' },
];

function randomGenome(id: string): Genome {
  return {
    id,
    objectives: {
      values: [Math.random() * 10, Math.random() * 10],
      timestamp: Date.now(),
    },
  };
}

function randomPopulation(size: number): Genome[] {
  return Array.from({ length: size }, (_, i) => randomGenome(`g${i}`));
}

function forAll<T>(generator: () => T, property: (value: T) => boolean, iterations = 50): void {
  for (let i = 0; i < iterations; i++) {
    const value = generator();
    if (!property(value)) {
      throw new Error(`Property violated with value: ${JSON.stringify(value)}`);
    }
  }
}

describe('nsga2 - properties', () => {
  describe('dominance properties', () => {
    it('should be irreflexive: not dominates(x, x)', () => {
      forAll(
        () => randomGenome('test'),
        (g) => !dominates(g, g, testSpecs)
      );
    });

    it('should be asymmetric: dominates(a, b) => not dominates(b, a)', () => {
      forAll(
        () => ({ a: randomGenome('a'), b: randomGenome('b') }),
        ({ a, b }) => {
          const ab = dominates(a, b, testSpecs);
          const ba = dominates(b, a, testSpecs);
          return !ab || !ba; // at most one can be true
        }
      );
    });

    it('should be transitive: dominates(a, b) && dominates(b, c) => dominates(a, c)', () => {
      forAll(
        () => {
          // Create a chain to test transitivity
          const a = randomGenome('a');
          const b = randomGenome('b');
          const c = randomGenome('c');
          
          // Force b to be dominated by a
          b.objectives.values = [
            Math.min(a.objectives.values[0] - 1, a.objectives.values[0]),
            Math.max(b.objectives.values[1] + 1, a.objectives.values[1]),
          ];
          
          // Force c to be dominated by b
          c.objectives.values = [
            Math.min(b.objectives.values[0] - 1, b.objectives.values[0]),
            Math.max(c.objectives.values[1] + 1, b.objectives.values[1]),
          ];
          
          return { a, b, c };
        },
        ({ a, b, c }) => {
          const ab = dominates(a, b, testSpecs);
          const bc = dominates(b, c, testSpecs);
          const ac = dominates(a, c, testSpecs);
          
          return !ab || !bc || ac; // if ab AND bc then ac must hold
        },
        30
      );
    });
  });

  describe('fast non-dominated sort properties', () => {
    it('should partition entire population into fronts', () => {
      forAll(
        () => randomPopulation(10),
        (pop) => {
          const fronts = fastNonDominatedSort(pop, testSpecs);
          const totalInFronts = fronts.reduce((sum, f) => sum + f.length, 0);
          return totalInFronts === pop.length;
        },
        30
      );
    });

    it('should have non-dominated individuals in front 0', () => {
      forAll(
        () => randomPopulation(10),
        (pop) => {
          const fronts = fastNonDominatedSort(pop, testSpecs);
          if (fronts.length === 0) return true;
          
          // No one in front 0 should be dominated by anyone
          for (const a of fronts[0]) {
            for (const b of pop) {
              if (a.id === b.id) continue;
              if (dominates(b, a, testSpecs)) {
                return false; // front 0 member is dominated!
              }
            }
          }
          return true;
        },
        30
      );
    });

    it('should assign increasing ranks to fronts', () => {
      forAll(
        () => randomPopulation(10),
        (pop) => {
          const fronts = fastNonDominatedSort(pop, testSpecs);
          
          for (let i = 0; i < fronts.length; i++) {
            for (const g of fronts[i]) {
              if (g.rank !== i) return false;
            }
          }
          return true;
        },
        30
      );
    });

    it('should handle empty population', () => {
      const fronts = fastNonDominatedSort([], testSpecs);
      expect(fronts).toHaveLength(0);
    });

    it('should be deterministic', () => {
      const pop = randomPopulation(5);
      const fronts1 = fastNonDominatedSort([...pop], testSpecs);
      const fronts2 = fastNonDominatedSort([...pop], testSpecs);
      
      expect(fronts1.length).toBe(fronts2.length);
      for (let i = 0; i < fronts1.length; i++) {
        expect(fronts1[i].length).toBe(fronts2[i].length);
      }
    });
  });

  describe('crowding distance properties', () => {
    it('should be non-negative', () => {
      forAll(
        () => randomPopulation(5),
        (pop) => {
          const distances = crowdingDistance(pop, testSpecs);
          return Array.from(distances.values()).every(d => d >= 0 || d === Infinity);
        },
        30
      );
    });

    it('should assign infinite distance to at least 2 boundary points', () => {
      forAll(
        () => randomPopulation(5),
        (pop) => {
          if (pop.length <= 2) return true;
          const distances = crowdingDistance(pop, testSpecs);
          const infiniteCount = Array.from(distances.values()).filter(d => d === Infinity).length;
          return infiniteCount >= 2;
        },
        30
      );
    });

    it('should handle identical objectives gracefully', () => {
      const pop = Array.from({ length: 5 }, (_, i) => ({
        id: `g${i}`,
        objectives: {
          values: [5, 5],
          timestamp: Date.now(),
        },
      }));
      
      const distances = crowdingDistance(pop, testSpecs);
      expect(Array.from(distances.values()).every(d => !isNaN(d))).toBe(true);
    });

    it('should set crowding on all genomes in front', () => {
      forAll(
        () => randomPopulation(5),
        (pop) => {
          crowdingDistance(pop, testSpecs);
          return pop.every(g => g.crowding !== undefined);
        },
        30
      );
    });
  });

  describe('combined NSGA-II properties', () => {
    it('should maintain population diversity through crowding', () => {
      forAll(
        () => randomPopulation(20),
        (pop) => {
          const fronts = fastNonDominatedSort(pop, testSpecs);
          
          // Check that crowding is calculated for all fronts
          for (const front of fronts) {
            crowdingDistance(front, testSpecs);
            const hasCrowding = front.every(g => g.crowding !== undefined);
            if (!hasCrowding) return false;
          }
          return true;
        },
        20
      );
    });

    it('should preserve Pareto optimality: no member of front 0 is dominated', () => {
      forAll(
        () => randomPopulation(15),
        (pop) => {
          const fronts = fastNonDominatedSort(pop, testSpecs);
          if (fronts.length === 0) return true;
          
          for (const optimal of fronts[0]) {
            for (const other of pop) {
              if (optimal.id === other.id) continue;
              if (dominates(other, optimal, testSpecs)) {
                return false;
              }
            }
          }
          return true;
        },
        20
      );
    });
  });
});
