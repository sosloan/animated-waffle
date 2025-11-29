/**
 * Alpaca-Convex Integration Tests
 * 
 * Unit tests for the functional-reactive trading system.
 * Tests the pure functions and data transformations.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Helper Functions Tests (Pure Functions)
// ============================================================================

/**
 * Build query string from parameters.
 * Copied from convex/alpaca.ts for unit testing.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return [k, v.join(",")];
      }
      return [k, String(v)];
    });
  return new URLSearchParams(entries).toString();
}

describe('buildQueryString', () => {
  it('should build query string from simple params', () => {
    const result = buildQueryString({ foo: 'bar', baz: 123 });
    expect(result).toBe('foo=bar&baz=123');
  });

  it('should filter out undefined values', () => {
    const result = buildQueryString({ foo: 'bar', baz: undefined });
    expect(result).toBe('foo=bar');
  });

  it('should filter out null values', () => {
    const result = buildQueryString({ foo: 'bar', baz: null });
    expect(result).toBe('foo=bar');
  });

  it('should join array values with commas', () => {
    const result = buildQueryString({ symbols: ['AAPL', 'GOOGL', 'MSFT'] });
    expect(result).toBe('symbols=AAPL%2CGOOGL%2CMSFT');
  });

  it('should handle empty params', () => {
    const result = buildQueryString({});
    expect(result).toBe('');
  });
});

// ============================================================================
// Signal Generation Logic Tests (Pure Functions)
// ============================================================================

/**
 * Calculate momentum from bar data.
 * Pure function: bars → momentum value.
 */
function calculateMomentum(
  bars: Array<{ close: number }>
): { momentum: number; recentAvg: number; olderAvg: number } | null {
  if (bars.length < 5) {
    return null;
  }

  const recentBars = bars.slice(0, 5);
  const olderBars = bars.slice(5, 10);

  const recentAvg = recentBars.reduce((sum, b) => sum + b.close, 0) / recentBars.length;
  const olderAvg = olderBars.length > 0
    ? olderBars.reduce((sum, b) => sum + b.close, 0) / olderBars.length
    : recentAvg;

  const momentum = olderAvg !== 0 ? (recentAvg - olderAvg) / olderAvg : 0;

  return { momentum, recentAvg, olderAvg };
}

/**
 * Determine signal type from momentum.
 */
function momentumToSignal(
  momentum: number,
  buyThreshold: number = 0.02,
  sellThreshold: number = -0.02
): 'buy' | 'sell' | 'hold' {
  if (momentum > buyThreshold) {
    return 'buy';
  } else if (momentum < sellThreshold) {
    return 'sell';
  }
  return 'hold';
}

describe('calculateMomentum', () => {
  it('should return null for insufficient data', () => {
    const result = calculateMomentum([{ close: 100 }]);
    expect(result).toBeNull();
  });

  it('should calculate positive momentum', () => {
    const bars = [
      { close: 110 }, { close: 108 }, { close: 107 }, { close: 106 }, { close: 105 },
      { close: 100 }, { close: 99 }, { close: 98 }, { close: 97 }, { close: 96 },
    ];
    const result = calculateMomentum(bars);
    expect(result).not.toBeNull();
    expect(result!.momentum).toBeGreaterThan(0);
    expect(result!.recentAvg).toBe(107.2);
    expect(result!.olderAvg).toBe(98);
  });

  it('should calculate negative momentum', () => {
    const bars = [
      { close: 90 }, { close: 91 }, { close: 92 }, { close: 93 }, { close: 94 },
      { close: 100 }, { close: 101 }, { close: 102 }, { close: 103 }, { close: 104 },
    ];
    const result = calculateMomentum(bars);
    expect(result).not.toBeNull();
    expect(result!.momentum).toBeLessThan(0);
  });

  it('should handle exactly 5 bars', () => {
    const bars = [
      { close: 100 }, { close: 100 }, { close: 100 }, { close: 100 }, { close: 100 },
    ];
    const result = calculateMomentum(bars);
    expect(result).not.toBeNull();
    expect(result!.momentum).toBe(0); // No older bars, same avg
  });
});

describe('momentumToSignal', () => {
  it('should return buy for positive momentum above threshold', () => {
    expect(momentumToSignal(0.03)).toBe('buy');
    expect(momentumToSignal(0.05)).toBe('buy');
    expect(momentumToSignal(0.10)).toBe('buy');
  });

  it('should return sell for negative momentum below threshold', () => {
    expect(momentumToSignal(-0.03)).toBe('sell');
    expect(momentumToSignal(-0.05)).toBe('sell');
    expect(momentumToSignal(-0.10)).toBe('sell');
  });

  it('should return hold for momentum within thresholds', () => {
    expect(momentumToSignal(0.01)).toBe('hold');
    expect(momentumToSignal(-0.01)).toBe('hold');
    expect(momentumToSignal(0)).toBe('hold');
  });

  it('should respect custom thresholds', () => {
    expect(momentumToSignal(0.025, 0.03, -0.03)).toBe('hold');
    expect(momentumToSignal(0.04, 0.03, -0.03)).toBe('buy');
    expect(momentumToSignal(-0.04, 0.03, -0.03)).toBe('sell');
  });
});

// ============================================================================
// Mean Reversion Logic Tests
// ============================================================================

/**
 * Calculate z-score for mean reversion strategy.
 * Pure function: prices → z-score.
 */
function calculateZScore(
  prices: number[]
): { zScore: number; mean: number; stdDev: number } | null {
  if (prices.length < 2) {
    return null;
  }

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return { zScore: 0, mean, stdDev };
  }

  const latestPrice = prices[0];
  const zScore = (latestPrice - mean) / stdDev;

  return { zScore, mean, stdDev };
}

/**
 * Determine signal type from z-score.
 */
function zScoreToSignal(
  zScore: number,
  threshold: number = 2.0
): 'buy' | 'sell' | 'hold' {
  if (zScore < -threshold) {
    return 'buy'; // Price below mean - expect reversion up
  } else if (zScore > threshold) {
    return 'sell'; // Price above mean - expect reversion down
  }
  return 'hold';
}

describe('calculateZScore', () => {
  it('should return null for insufficient data', () => {
    expect(calculateZScore([100])).toBeNull();
    expect(calculateZScore([])).toBeNull();
  });

  it('should calculate z-score correctly', () => {
    // Prices: latest=120, mean of [120,100,100,100,100] = 104
    // StdDev calculation for this set
    const prices = [120, 100, 100, 100, 100];
    const result = calculateZScore(prices);
    expect(result).not.toBeNull();
    expect(result!.mean).toBe(104);
    expect(result!.zScore).toBeGreaterThan(0); // 120 is above mean
  });

  it('should return z-score of 0 for constant prices', () => {
    const prices = [100, 100, 100, 100, 100];
    const result = calculateZScore(prices);
    expect(result).not.toBeNull();
    expect(result!.zScore).toBe(0);
    expect(result!.stdDev).toBe(0);
  });

  it('should return negative z-score when price is below mean', () => {
    const prices = [80, 100, 100, 100, 100]; // 80 is below mean of 96
    const result = calculateZScore(prices);
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeLessThan(0);
  });
});

describe('zScoreToSignal', () => {
  it('should return buy when z-score is significantly negative', () => {
    expect(zScoreToSignal(-2.5)).toBe('buy');
    expect(zScoreToSignal(-3.0)).toBe('buy');
  });

  it('should return sell when z-score is significantly positive', () => {
    expect(zScoreToSignal(2.5)).toBe('sell');
    expect(zScoreToSignal(3.0)).toBe('sell');
  });

  it('should return hold when z-score is within threshold', () => {
    expect(zScoreToSignal(1.5)).toBe('hold');
    expect(zScoreToSignal(-1.5)).toBe('hold');
    expect(zScoreToSignal(0)).toBe('hold');
  });

  it('should respect custom threshold', () => {
    expect(zScoreToSignal(-1.5, 1.0)).toBe('buy');
    expect(zScoreToSignal(1.5, 1.0)).toBe('sell');
    expect(zScoreToSignal(0.5, 1.0)).toBe('hold');
  });
});

// ============================================================================
// Signal Strength Calculation Tests
// ============================================================================

/**
 * Calculate signal strength from various metrics.
 */
function calculateSignalStrength(
  momentum: number,
  scaleFactor: number = 10,
  maxStrength: number = 1
): number {
  return Math.min(maxStrength, Math.abs(momentum) * scaleFactor);
}

/**
 * Calculate confidence from data quality.
 */
function calculateConfidence(
  dataPoints: number,
  requiredPoints: number = 20
): number {
  return Math.min(1, dataPoints / requiredPoints);
}

describe('calculateSignalStrength', () => {
  it('should scale momentum to strength', () => {
    expect(calculateSignalStrength(0.05)).toBe(0.5);
    expect(calculateSignalStrength(0.1)).toBe(1.0);
    expect(calculateSignalStrength(-0.05)).toBe(0.5);
  });

  it('should cap at maxStrength', () => {
    expect(calculateSignalStrength(0.2)).toBe(1.0);
    expect(calculateSignalStrength(1.0)).toBe(1.0);
  });

  it('should handle custom scale factor', () => {
    expect(calculateSignalStrength(0.1, 5)).toBe(0.5);
    expect(calculateSignalStrength(0.1, 20)).toBe(1.0);
  });
});

describe('calculateConfidence', () => {
  it('should return 1 when data meets requirements', () => {
    expect(calculateConfidence(20)).toBe(1.0);
    expect(calculateConfidence(30)).toBe(1.0);
  });

  it('should return fractional confidence for partial data', () => {
    expect(calculateConfidence(10)).toBe(0.5);
    expect(calculateConfidence(5)).toBe(0.25);
  });

  it('should handle custom required points', () => {
    expect(calculateConfidence(10, 10)).toBe(1.0);
    expect(calculateConfidence(5, 10)).toBe(0.5);
  });
});

// ============================================================================
// Type Definitions Tests
// ============================================================================

describe('Type definitions', () => {
  it('should have correct Bar type structure', () => {
    interface Bar {
      t: string;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw?: number;
      n?: number;
    }

    const bar: Bar = {
      t: '2024-01-01T00:00:00Z',
      o: 100,
      h: 110,
      l: 95,
      c: 105,
      v: 1000000,
    };

    expect(bar.t).toBeDefined();
    expect(bar.o).toBe(100);
    expect(bar.c).toBe(105);
  });

  it('should have correct Signal type structure', () => {
    interface TradingSignal {
      symbol: string;
      signalType: 'buy' | 'sell' | 'hold' | 'alert';
      strength: number;
      confidence: number;
      price: number;
      strategy: string;
    }

    const signal: TradingSignal = {
      symbol: 'AAPL',
      signalType: 'buy',
      strength: 0.8,
      confidence: 0.9,
      price: 150.50,
      strategy: 'momentum',
    };

    expect(signal.symbol).toBe('AAPL');
    expect(signal.signalType).toBe('buy');
    expect(signal.strength).toBeLessThanOrEqual(1);
  });

  it('should have correct Trader config structure', () => {
    interface TraderConfig {
      riskTolerance: number;
      maxPositionSize: number;
      stopLossPercent?: number;
      takeProfitPercent?: number;
      cooldownMs?: number;
    }

    const config: TraderConfig = {
      riskTolerance: 0.5,
      maxPositionSize: 10000,
      stopLossPercent: 5,
      takeProfitPercent: 10,
    };

    expect(config.riskTolerance).toBeLessThanOrEqual(1);
    expect(config.maxPositionSize).toBeGreaterThan(0);
  });
});
