/**
 * SPEC TEST (2 of 2-by-1): objectives.spec.ts
 * Paired with objectives.ts (compute/generator)
 * 
 * Extreme Pairs TDD: No compute without dual tests.
 * This file verifies invariants and correctness of objective comparisons.
 */

import { describe, it, expect } from 'vitest';
import {
  noWorse,
  strictlyBetter,
  satisfiesLaw,
  DEFAULT_OBJECTIVES,
  type ObjectiveSpec,
  type Law,
} from './objectives';

describe('objectives - invariants', () => {
  it('should have 6 default objectives', () => {
    expect(DEFAULT_OBJECTIVES).toHaveLength(6);
  });

  it('should have balanced max/min objectives', () => {
    const maxCount = DEFAULT_OBJECTIVES.filter(o => o.sense === 'max').length;
    const minCount = DEFAULT_OBJECTIVES.filter(o => o.sense === 'min').length;
    expect(maxCount).toBeGreaterThan(0);
    expect(minCount).toBeGreaterThan(0);
  });

  it('should have unique objective names', () => {
    const names = DEFAULT_OBJECTIVES.map(o => o.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

describe('noWorse comparison', () => {
  it('should return true when values are equal for max', () => {
    expect(noWorse(5, 5, 'max')).toBe(true);
  });

  it('should return true when values are equal for min', () => {
    expect(noWorse(5, 5, 'min')).toBe(true);
  });

  it('should return true when a > b for max sense', () => {
    expect(noWorse(10, 5, 'max')).toBe(true);
  });

  it('should return false when a < b for max sense', () => {
    expect(noWorse(5, 10, 'max')).toBe(false);
  });

  it('should return true when a < b for min sense', () => {
    expect(noWorse(5, 10, 'min')).toBe(true);
  });

  it('should return false when a > b for min sense', () => {
    expect(noWorse(10, 5, 'min')).toBe(false);
  });
});

describe('strictlyBetter comparison', () => {
  it('should return false when values are equal', () => {
    expect(strictlyBetter(5, 5, 'max')).toBe(false);
    expect(strictlyBetter(5, 5, 'min')).toBe(false);
  });

  it('should return true when a > b for max sense', () => {
    expect(strictlyBetter(10, 5, 'max')).toBe(true);
  });

  it('should return false when a < b for max sense', () => {
    expect(strictlyBetter(5, 10, 'max')).toBe(false);
  });

  it('should return true when a < b for min sense', () => {
    expect(strictlyBetter(5, 10, 'min')).toBe(true);
  });

  it('should return false when a > b for min sense', () => {
    expect(strictlyBetter(10, 5, 'min')).toBe(false);
  });

  it('should be asymmetric', () => {
    expect(strictlyBetter(10, 5, 'max')).toBe(true);
    expect(strictlyBetter(5, 10, 'max')).toBe(false);
  });
});

describe('satisfiesLaw', () => {
  it('should always return true when no threshold is set', () => {
    const law: Law = {
      name: 'test',
      evaluate: () => 0,
      sense: 'max',
    };
    expect(satisfiesLaw(law, 100)).toBe(true);
    expect(satisfiesLaw(law, -100)).toBe(true);
  });

  it('should enforce max threshold correctly', () => {
    const law: Law = {
      name: 'min-gain',
      evaluate: () => 0,
      sense: 'max',
      threshold: 0.5,
    };
    expect(satisfiesLaw(law, 0.6)).toBe(true);
    expect(satisfiesLaw(law, 0.5)).toBe(true);
    expect(satisfiesLaw(law, 0.4)).toBe(false);
  });

  it('should enforce min threshold correctly', () => {
    const law: Law = {
      name: 'max-privacy-loss',
      evaluate: () => 0,
      sense: 'min',
      threshold: 1.0,
    };
    expect(satisfiesLaw(law, 0.8)).toBe(true);
    expect(satisfiesLaw(law, 1.0)).toBe(true);
    expect(satisfiesLaw(law, 1.2)).toBe(false);
  });
});

describe('objective delta emission (Rule 4)', () => {
  it('should emit measurable difference for strictlyBetter', () => {
    const before = 5;
    const after = 10;
    const delta = after - before;
    
    expect(strictlyBetter(after, before, 'max')).toBe(true);
    expect(delta).toBeGreaterThan(0);
  });

  it('should track objective improvement over time', () => {
    const objectives = [
      { value: 0.1, ts: 1 },
      { value: 0.3, ts: 2 },
      { value: 0.5, ts: 3 },
    ];
    
    for (let i = 1; i < objectives.length; i++) {
      const delta = objectives[i].value - objectives[i - 1].value;
      expect(delta).toBeGreaterThan(0);
      expect(strictlyBetter(objectives[i].value, objectives[i - 1].value, 'max')).toBe(true);
    }
  });
});
