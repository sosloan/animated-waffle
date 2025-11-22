/**
 * Hilbert Space Learning Dynamics
 * 
 * Represents learning states as vectors in a Hilbert space.
 * Supports spectral synchronization for privacy-preserving coordination.
 */

export interface Complex {
  re: number;
  im: number;
}

/**
 * A learning state in Hilbert space.
 * Can represent concept, skill, motivation, metacognition subspaces.
 */
export type HilbertState = Complex[];

/**
 * Create a zero state of given dimension.
 */
export function zeroState(dim: number): HilbertState {
  return Array.from({ length: dim }, () => ({ re: 0, im: 0 }));
}

/**
 * Compute norm squared of a Hilbert state.
 */
export function normSquared(state: HilbertState): number {
  return state.reduce((sum, z) => sum + z.re * z.re + z.im * z.im, 0);
}

/**
 * Compute norm of a Hilbert state.
 */
export function norm(state: HilbertState): number {
  return Math.sqrt(normSquared(state));
}

/**
 * Normalize a Hilbert state to unit norm.
 */
export function normalize(state: HilbertState): HilbertState {
  const n = norm(state);
  if (n < 1e-12) return zeroState(state.length);
  
  return state.map(z => ({
    re: z.re / n,
    im: z.im / n,
  }));
}

/**
 * Inner product of two Hilbert states.
 */
export function innerProduct(a: HilbertState, b: HilbertState): Complex {
  if (a.length !== b.length) {
    throw new Error('States must have same dimension');
  }
  
  let re = 0;
  let im = 0;
  
  for (let i = 0; i < a.length; i++) {
    // <a|b> = sum_i conj(a_i) * b_i
    re += a[i].re * b[i].re + a[i].im * b[i].im;
    im += a[i].re * b[i].im - a[i].im * b[i].re;
  }
  
  return { re, im };
}

/**
 * Distance between two learning states.
 */
export function stateDistance(a: HilbertState, b: HilbertState): number {
  if (a.length !== b.length) {
    throw new Error('States must have same dimension');
  }
  
  const diff: HilbertState = a.map((z, i) => ({
    re: z.re - b[i].re,
    im: z.im - b[i].im,
  }));
  
  return norm(diff);
}

/**
 * Privacy-preserving projection operator.
 * Projects state to lower-dimensional subspace + adds noise.
 */
export function privacyProjection(
  state: HilbertState,
  targetDim: number,
  noiseScale = 0.1
): HilbertState {
  if (targetDim >= state.length) {
    // No compression needed, just add noise
    return state.map(z => ({
      re: z.re + (Math.random() - 0.5) * 2 * noiseScale,
      im: z.im + (Math.random() - 0.5) * 2 * noiseScale,
    }));
  }
  
  // Simple projection: take first targetDim components + noise
  const projected = state.slice(0, targetDim).map(z => ({
    re: z.re + (Math.random() - 0.5) * 2 * noiseScale,
    im: z.im + (Math.random() - 0.5) * 2 * noiseScale,
  }));
  
  return projected;
}

/**
 * Spectral synchronization: align states via consensus averaging.
 * This is a simplified version. Full implementation would use graph Laplacian eigenvectors.
 */
export function spectralSync(states: HilbertState[]): HilbertState {
  if (states.length === 0) return [];
  
  const dim = states[0].length;
  const avgState = zeroState(dim);
  
  // Consensus average
  for (const state of states) {
    for (let i = 0; i < dim; i++) {
      avgState[i].re += state[i].re;
      avgState[i].im += state[i].im;
    }
  }
  
  const n = states.length;
  for (let i = 0; i < dim; i++) {
    avgState[i].re /= n;
    avgState[i].im /= n;
  }
  
  return normalize(avgState);
}

/**
 * Learning energy functional (proxy for loss).
 * Lower energy = better learned state.
 */
export function learningEnergy(state: HilbertState): number {
  // Simple energy: deviation from unit norm + oscillation measure
  const n = norm(state);
  const normDeviation = Math.abs(n - 1.0);
  
  // Oscillation: variance of magnitudes
  const mags = state.map(z => Math.sqrt(z.re * z.re + z.im * z.im));
  const avgMag = mags.reduce((s, m) => s + m, 0) / mags.length;
  const variance = mags.reduce((s, m) => s + (m - avgMag) ** 2, 0) / mags.length;
  
  return normDeviation + 0.1 * variance;
}

/**
 * Check if a state is stable (local energy minimum).
 */
export function isStable(state: HilbertState, epsilon = 0.1): boolean {
  const energy = learningEnergy(state);
  
  // Test small perturbations
  for (let trial = 0; trial < 10; trial++) {
    const perturbed = state.map(z => ({
      re: z.re + (Math.random() - 0.5) * epsilon,
      im: z.im + (Math.random() - 0.5) * epsilon,
    }));
    
    const perturbedEnergy = learningEnergy(perturbed);
    if (perturbedEnergy < energy) {
      return false; // found a better nearby state
    }
  }
  
  return true;
}
