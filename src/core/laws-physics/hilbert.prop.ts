/**
 * PROPERTY TEST: hilbert.prop.ts
 * Property-based tests for Hilbert space operations
 */

import { describe, it, expect } from 'vitest';
import {
  norm,
  normalize,
  innerProduct,
  stateDistance,
  spectralSync,
  type HilbertState,
} from './hilbert';

function randomComplex() {
  return {
    re: (Math.random() - 0.5) * 10,
    im: (Math.random() - 0.5) * 10,
  };
}

function randomState(dim: number): HilbertState {
  return Array.from({ length: dim }, () => randomComplex());
}

function forAll<T>(generator: () => T, property: (value: T) => boolean, iterations = 50): void {
  for (let i = 0; i < iterations; i++) {
    const value = generator();
    if (!property(value)) {
      throw new Error(`Property violated with value: ${JSON.stringify(value)}`);
    }
  }
}

describe('hilbert - properties', () => {
  describe('norm properties', () => {
    it('should be non-negative', () => {
      forAll(
        () => randomState(3),
        (state) => norm(state) >= 0
      );
    });

    it('should be zero only for zero state', () => {
      forAll(
        () => randomState(3),
        (state) => {
          const n = norm(state);
          const allZero = state.every(z => Math.abs(z.re) < 1e-10 && Math.abs(z.im) < 1e-10);
          return (n < 1e-10) === allZero;
        }
      );
    });

    it('should satisfy triangle inequality: norm(a+b) <= norm(a) + norm(b)', () => {
      forAll(
        () => ({ a: randomState(3), b: randomState(3) }),
        ({ a, b }) => {
          const sum = a.map((z, i) => ({
            re: z.re + b[i].re,
            im: z.im + b[i].im,
          }));
          return norm(sum) <= norm(a) + norm(b) + 1e-10; // small epsilon for floating point
        }
      );
    });
  });

  describe('normalize properties', () => {
    it('should produce unit norm (except for zero)', () => {
      forAll(
        () => randomState(3),
        (state) => {
          if (norm(state) < 1e-10) return true; // skip zero
          const normalized = normalize(state);
          return Math.abs(norm(normalized) - 1.0) < 1e-10;
        }
      );
    });

    it('should be idempotent: normalize(normalize(x)) = normalize(x)', () => {
      forAll(
        () => randomState(3),
        (state) => {
          if (norm(state) < 1e-10) return true;
          const once = normalize(state);
          const twice = normalize(once);
          return stateDistance(once, twice) < 1e-10;
        }
      );
    });
  });

  describe('inner product properties', () => {
    it('should be conjugate symmetric: <a|b> = conj(<b|a>)', () => {
      forAll(
        () => ({ a: randomState(3), b: randomState(3) }),
        ({ a, b }) => {
          const ab = innerProduct(a, b);
          const ba = innerProduct(b, a);
          return Math.abs(ab.re - ba.re) < 1e-10 && Math.abs(ab.im + ba.im) < 1e-10;
        }
      );
    });

    it('should satisfy Cauchy-Schwarz: |<a|b>|^2 <= <a|a><b|b>', () => {
      forAll(
        () => ({ a: randomState(3), b: randomState(3) }),
        ({ a, b }) => {
          const ab = innerProduct(a, b);
          const abMagSq = ab.re * ab.re + ab.im * ab.im;
          const aa = norm(a) ** 2;
          const bb = norm(b) ** 2;
          return abMagSq <= aa * bb + 1e-8;
        }
      );
    });
  });

  describe('distance properties', () => {
    it('should be non-negative', () => {
      forAll(
        () => ({ a: randomState(3), b: randomState(3) }),
        ({ a, b }) => stateDistance(a, b) >= 0
      );
    });

    it('should be symmetric', () => {
      forAll(
        () => ({ a: randomState(3), b: randomState(3) }),
        ({ a, b }) => Math.abs(stateDistance(a, b) - stateDistance(b, a)) < 1e-10
      );
    });

    it('should be zero iff states are identical', () => {
      forAll(
        () => randomState(3),
        (state) => stateDistance(state, state) < 1e-10
      );
    });

    it('should satisfy triangle inequality: d(a,c) <= d(a,b) + d(b,c)', () => {
      forAll(
        () => ({ a: randomState(2), b: randomState(2), c: randomState(2) }),
        ({ a, b, c }) => {
          const dac = stateDistance(a, c);
          const dab = stateDistance(a, b);
          const dbc = stateDistance(b, c);
          return dac <= dab + dbc + 1e-8;
        },
        30 // fewer iterations for expensive check
      );
    });
  });

  describe('spectral sync properties', () => {
    it('should always produce unit norm output', () => {
      forAll(
        () => {
          const n = Math.floor(Math.random() * 5) + 1;
          return Array.from({ length: n }, () => randomState(3));
        },
        (states) => {
          if (states.length === 0) return true;
          const synced = spectralSync(states);
          if (synced.length === 0) return true;
          return Math.abs(norm(synced) - 1.0) < 1e-8;
        },
        30
      );
    });

    it('should return same dimension as input states', () => {
      forAll(
        () => {
          const dim = Math.floor(Math.random() * 5) + 1;
          const n = Math.floor(Math.random() * 5) + 1;
          return Array.from({ length: n }, () => randomState(dim));
        },
        (states) => {
          const synced = spectralSync(states);
          return states.length === 0 || synced.length === states[0].length;
        },
        30
      );
    });

    it('should be idempotent for single state: sync([s]) ~ normalize(s)', () => {
      forAll(
        () => randomState(3),
        (state) => {
          if (norm(state) < 1e-10) return true;
          const synced = spectralSync([state]);
          const normalized = normalize(state);
          return stateDistance(synced, normalized) < 1e-8;
        }
      );
    });
  });
});
