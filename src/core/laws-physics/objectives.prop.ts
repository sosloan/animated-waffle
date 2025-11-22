/**
 * PROPERTY TEST (2 of 2-by-1): objectives.prop.ts
 * Paired with objectives.ts (compute/generator)
 * 
 * Extreme Pairs TDD: Property-based tests for mathematical invariants.
 * These tests verify algebraic properties and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  noWorse,
  strictlyBetter,
  DEFAULT_OBJECTIVES,
  type ObjectiveSense,
} from './objectives';

// Simple property-based test helpers
function forAll<T>(generator: () => T, property: (value: T) => boolean, iterations = 100): void {
  for (let i = 0; i < iterations; i++) {
    const value = generator();
    if (!property(value)) {
      throw new Error(`Property violated with value: ${JSON.stringify(value)}`);
    }
  }
}

function randomNumber(min = -1000, max = 1000): number {
  return Math.random() * (max - min) + min;
}

function randomSense(): ObjectiveSense {
  return Math.random() > 0.5 ? 'max' : 'min';
}

describe('objectives - properties', () => {
  describe('noWorse reflexivity', () => {
    it('should be reflexive: noWorse(x, x) always true', () => {
      forAll(
        () => ({ value: randomNumber(), sense: randomSense() }),
        ({ value, sense }) => noWorse(value, value, sense)
      );
    });
  });

  describe('noWorse transitivity', () => {
    it('should be transitive for max: if a >= b and b >= c then a >= c', () => {
      forAll(
        () => {
          const values = [randomNumber(), randomNumber(), randomNumber()].sort((a, b) => b - a);
          return { a: values[0], b: values[1], c: values[2] };
        },
        ({ a, b, c }) => {
          const ab = noWorse(a, b, 'max');
          const bc = noWorse(b, c, 'max');
          const ac = noWorse(a, c, 'max');
          return !ab || !bc || ac; // if ab AND bc then ac must be true
        }
      );
    });

    it('should be transitive for min: if a <= b and b <= c then a <= c', () => {
      forAll(
        () => {
          const values = [randomNumber(), randomNumber(), randomNumber()].sort((a, b) => a - b);
          return { a: values[0], b: values[1], c: values[2] };
        },
        ({ a, b, c }) => {
          const ab = noWorse(a, b, 'min');
          const bc = noWorse(b, c, 'min');
          const ac = noWorse(a, c, 'min');
          return !ab || !bc || ac;
        }
      );
    });
  });

  describe('strictlyBetter asymmetry', () => {
    it('should be asymmetric: if strictlyBetter(a, b) then not strictlyBetter(b, a)', () => {
      forAll(
        () => {
          const a = randomNumber();
          const b = randomNumber();
          const sense = randomSense();
          return { a, b, sense };
        },
        ({ a, b, sense }) => {
          const ab = strictlyBetter(a, b, sense);
          const ba = strictlyBetter(b, a, sense);
          return !ab || !ba; // can't both be true
        }
      );
    });

    it('should be irreflexive: never strictlyBetter(x, x)', () => {
      forAll(
        () => ({ value: randomNumber(), sense: randomSense() }),
        ({ value, sense }) => !strictlyBetter(value, value, sense)
      );
    });
  });

  describe('strictlyBetter implies noWorse', () => {
    it('should satisfy: strictlyBetter(a, b) => noWorse(a, b)', () => {
      forAll(
        () => {
          const a = randomNumber();
          const b = randomNumber();
          const sense = randomSense();
          return { a, b, sense };
        },
        ({ a, b, sense }) => {
          const better = strictlyBetter(a, b, sense);
          const notWorse = noWorse(a, b, sense);
          return !better || notWorse; // if better then notWorse
        }
      );
    });
  });

  describe('sense duality', () => {
    it('should have dual behavior: max(a,b) = min(-a,-b)', () => {
      forAll(
        () => ({ a: randomNumber(), b: randomNumber() }),
        ({ a, b }) => {
          const maxAB = noWorse(a, b, 'max');
          const minNegAB = noWorse(-a, -b, 'min');
          return maxAB === minNegAB;
        }
      );
    });
  });

  describe('boundary conditions', () => {
    it('should handle zero correctly', () => {
      expect(noWorse(0, 0, 'max')).toBe(true);
      expect(noWorse(0, 0, 'min')).toBe(true);
      expect(strictlyBetter(0, 0, 'max')).toBe(false);
      expect(strictlyBetter(0, 0, 'min')).toBe(false);
    });

    it('should handle negative numbers correctly', () => {
      expect(noWorse(-5, -10, 'max')).toBe(true);  // -5 > -10
      expect(noWorse(-10, -5, 'min')).toBe(true);  // -10 < -5
      expect(strictlyBetter(-5, -10, 'max')).toBe(true);
      expect(strictlyBetter(-10, -5, 'min')).toBe(true);
    });

    it('should handle infinity correctly', () => {
      expect(noWorse(Infinity, 100, 'max')).toBe(true);
      expect(noWorse(-Infinity, 100, 'min')).toBe(true);
      expect(strictlyBetter(Infinity, 100, 'max')).toBe(true);
      expect(strictlyBetter(-Infinity, 100, 'min')).toBe(true);
    });
  });

  describe('default objectives invariants', () => {
    it('should maintain balance across multiple runs', () => {
      // This property ensures our default objectives maintain structural integrity
      forAll(
        () => ({}),
        () => {
          const maxCount = DEFAULT_OBJECTIVES.filter(o => o.sense === 'max').length;
          const minCount = DEFAULT_OBJECTIVES.filter(o => o.sense === 'min').length;
          return maxCount >= 2 && minCount >= 2; // reasonable balance
        },
        10 // only need to check a few times since defaults don't change
      );
    });
  });
});
