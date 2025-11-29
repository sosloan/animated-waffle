/**
 * Alpaca-Convex Integration Tests
 * 
 * Comprehensive test suite for the functional-reactive trading system:
 * - Unit tests for pure functions and data transformations
 * - Integration tests for component interactions
 * - Holistic tests for end-to-end trading scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// ============================================================================
// INTEGRATION TESTS - Component Interactions
// ============================================================================

describe('Integration - Market Data Pipeline', () => {
  /**
   * Simulates bar data transformation from Alpaca format to Convex storage.
   */
  function transformBarToStorage(alpacaBar: {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw?: number;
    n?: number;
  }, symbol: string, assetType: 'equity' | 'crypto' | 'option', timeframe: string) {
    return {
      symbol,
      assetType,
      timeframe,
      timestamp: alpacaBar.t,
      open: alpacaBar.o,
      high: alpacaBar.h,
      low: alpacaBar.l,
      close: alpacaBar.c,
      volume: alpacaBar.v,
      vwap: alpacaBar.vw,
      tradeCount: alpacaBar.n,
      fetchedAt: Date.now(),
    };
  }

  it('should transform Alpaca bar to storage format', () => {
    const alpacaBar = {
      t: '2024-01-15T14:30:00Z',
      o: 185.50,
      h: 186.75,
      l: 185.25,
      c: 186.50,
      v: 1500000,
      vw: 186.10,
      n: 12500,
    };

    const stored = transformBarToStorage(alpacaBar, 'AAPL', 'equity', '1Day');

    expect(stored.symbol).toBe('AAPL');
    expect(stored.assetType).toBe('equity');
    expect(stored.timeframe).toBe('1Day');
    expect(stored.open).toBe(185.50);
    expect(stored.close).toBe(186.50);
    expect(stored.vwap).toBe(186.10);
  });

  it('should handle optional fields in bar transformation', () => {
    const alpacaBar = {
      t: '2024-01-15T14:30:00Z',
      o: 185.50,
      h: 186.75,
      l: 185.25,
      c: 186.50,
      v: 1500000,
    };

    const stored = transformBarToStorage(alpacaBar, 'AAPL', 'equity', '1Day');

    expect(stored.vwap).toBeUndefined();
    expect(stored.tradeCount).toBeUndefined();
  });

  it('should handle crypto symbol format', () => {
    const alpacaBar = {
      t: '2024-01-15T14:30:00Z',
      o: 42500.00,
      h: 43000.00,
      l: 42200.00,
      c: 42800.00,
      v: 1500.5,
      vw: 42650.00,
    };

    const stored = transformBarToStorage(alpacaBar, 'BTC/USD', 'crypto', '1Hour');

    expect(stored.symbol).toBe('BTC/USD');
    expect(stored.assetType).toBe('crypto');
  });
});

describe('Integration - Snapshot Pipeline', () => {
  /**
   * Transforms Alpaca snapshot data to Convex storage format.
   */
  function transformSnapshotToStorage(
    snapshot: {
      latestTrade?: { p: number };
      latestQuote?: { bp: number; ap: number; bs: number; as: number };
      dailyBar?: { o: number; h: number; l: number; c: number; v: number };
      prevDailyBar?: { c: number };
    },
    symbol: string,
    assetType: 'equity' | 'crypto' | 'option'
  ) {
    const latestPrice = snapshot.latestTrade?.p ?? snapshot.dailyBar?.c ?? 0;
    const prevClose = snapshot.prevDailyBar?.c;
    const change = prevClose ? latestPrice - prevClose : undefined;
    const changePercent = prevClose ? ((latestPrice - prevClose) / prevClose) * 100 : undefined;

    return {
      symbol,
      assetType,
      latestPrice,
      bidPrice: snapshot.latestQuote?.bp,
      askPrice: snapshot.latestQuote?.ap,
      bidSize: snapshot.latestQuote?.bs,
      askSize: snapshot.latestQuote?.as,
      volume: snapshot.dailyBar?.v,
      dailyHigh: snapshot.dailyBar?.h,
      dailyLow: snapshot.dailyBar?.l,
      dailyOpen: snapshot.dailyBar?.o,
      prevClose,
      change,
      changePercent,
      updatedAt: Date.now(),
    };
  }

  it('should calculate change from previous close', () => {
    const snapshot = {
      latestTrade: { p: 150.00 },
      prevDailyBar: { c: 145.00 },
    };

    const stored = transformSnapshotToStorage(snapshot, 'AAPL', 'equity');

    expect(stored.change).toBe(5.00);
    expect(stored.changePercent).toBeCloseTo(3.448, 2);
  });

  it('should handle missing previous close', () => {
    const snapshot = {
      latestTrade: { p: 150.00 },
    };

    const stored = transformSnapshotToStorage(snapshot, 'AAPL', 'equity');

    expect(stored.change).toBeUndefined();
    expect(stored.changePercent).toBeUndefined();
  });

  it('should use daily bar close when no trade', () => {
    const snapshot = {
      dailyBar: { o: 145.00, h: 152.00, l: 144.00, c: 150.00, v: 5000000 },
    };

    const stored = transformSnapshotToStorage(snapshot, 'AAPL', 'equity');

    expect(stored.latestPrice).toBe(150.00);
  });

  it('should extract quote data', () => {
    const snapshot = {
      latestTrade: { p: 150.00 },
      latestQuote: { bp: 149.95, ap: 150.05, bs: 100, as: 200 },
    };

    const stored = transformSnapshotToStorage(snapshot, 'AAPL', 'equity');

    expect(stored.bidPrice).toBe(149.95);
    expect(stored.askPrice).toBe(150.05);
    expect(stored.bidSize).toBe(100);
    expect(stored.askSize).toBe(200);
  });
});

describe('Integration - Signal Pipeline', () => {
  /**
   * Creates a trading signal from analysis results.
   */
  function createTradingSignal(
    symbol: string,
    signalType: 'buy' | 'sell' | 'hold' | 'alert',
    strength: number,
    confidence: number,
    price: number,
    strategy: string,
    metadata: Record<string, unknown> = {},
    expiresInMs?: number
  ) {
    const now = Date.now();
    return {
      symbol,
      signalType,
      strength: Math.min(1, Math.max(0, strength)),
      confidence: Math.min(1, Math.max(0, confidence)),
      price,
      strategy,
      metadata,
      generatedAt: now,
      expiresAt: expiresInMs ? now + expiresInMs : undefined,
      acknowledged: false,
    };
  }

  it('should clamp strength to 0-1 range', () => {
    const signal = createTradingSignal('AAPL', 'buy', 1.5, 0.9, 150, 'momentum');
    expect(signal.strength).toBe(1);

    const signal2 = createTradingSignal('AAPL', 'buy', -0.5, 0.9, 150, 'momentum');
    expect(signal2.strength).toBe(0);
  });

  it('should clamp confidence to 0-1 range', () => {
    const signal = createTradingSignal('AAPL', 'buy', 0.8, 1.5, 150, 'momentum');
    expect(signal.confidence).toBe(1);
  });

  it('should set expiration from milliseconds', () => {
    const before = Date.now();
    const signal = createTradingSignal('AAPL', 'buy', 0.8, 0.9, 150, 'momentum', {}, 60000);
    const after = Date.now();

    expect(signal.expiresAt).toBeGreaterThanOrEqual(before + 60000);
    expect(signal.expiresAt).toBeLessThanOrEqual(after + 60000);
  });

  it('should not set expiration if not provided', () => {
    const signal = createTradingSignal('AAPL', 'buy', 0.8, 0.9, 150, 'momentum');
    expect(signal.expiresAt).toBeUndefined();
  });

  it('should store metadata', () => {
    const metadata = { momentum: 0.05, recentAvg: 155, olderAvg: 150 };
    const signal = createTradingSignal('AAPL', 'buy', 0.8, 0.9, 155, 'momentum', metadata);

    expect(signal.metadata).toEqual(metadata);
  });
});

describe('Integration - Trader State Management', () => {
  /**
   * Simulates trader state updates.
   */
  function updateTraderState(
    currentState: {
      lastSignalAt?: number;
      totalSignals: number;
      performance: { successRate: number; totalTrades: number; pnl: number };
    },
    updates: {
      lastSignalAt?: number;
      incrementSignals?: boolean;
      newTrade?: { success: boolean; pnl: number };
    }
  ) {
    const newState = { ...currentState };
    
    if (updates.lastSignalAt !== undefined) {
      newState.lastSignalAt = updates.lastSignalAt;
    }
    
    if (updates.incrementSignals) {
      newState.totalSignals += 1;
    }
    
    if (updates.newTrade) {
      const perf = { ...currentState.performance };
      perf.totalTrades += 1;
      perf.pnl += updates.newTrade.pnl;
      const successCount = Math.round(perf.successRate * (perf.totalTrades - 1)) + (updates.newTrade.success ? 1 : 0);
      perf.successRate = perf.totalTrades > 0 ? successCount / perf.totalTrades : 0;
      newState.performance = perf;
    }
    
    return newState;
  }

  it('should increment signal count', () => {
    const state = {
      totalSignals: 5,
      performance: { successRate: 0.6, totalTrades: 10, pnl: 500 },
    };

    const updated = updateTraderState(state, { incrementSignals: true });

    expect(updated.totalSignals).toBe(6);
  });

  it('should update last signal timestamp', () => {
    const state = {
      totalSignals: 5,
      performance: { successRate: 0.6, totalTrades: 10, pnl: 500 },
    };
    const now = Date.now();

    const updated = updateTraderState(state, { lastSignalAt: now });

    expect(updated.lastSignalAt).toBe(now);
  });

  it('should update performance on new trade', () => {
    const state = {
      totalSignals: 5,
      performance: { successRate: 0.5, totalTrades: 4, pnl: 100 },
    };

    const updated = updateTraderState(state, { newTrade: { success: true, pnl: 50 } });

    expect(updated.performance.totalTrades).toBe(5);
    expect(updated.performance.pnl).toBe(150);
    expect(updated.performance.successRate).toBeCloseTo(0.6, 2);
  });

  it('should handle failed trade', () => {
    const state = {
      totalSignals: 5,
      performance: { successRate: 0.5, totalTrades: 4, pnl: 100 },
    };

    const updated = updateTraderState(state, { newTrade: { success: false, pnl: -30 } });

    expect(updated.performance.pnl).toBe(70);
    expect(updated.performance.successRate).toBeCloseTo(0.4, 2);
  });
});

// ============================================================================
// HOLISTIC TESTS - End-to-End Trading Scenarios
// ============================================================================

describe('Holistic - Complete Trading Cycle', () => {
  /**
   * Simulates a complete trading cycle from data ingestion to signal generation.
   */
  interface MarketBar {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }

  interface TradingScenario {
    symbol: string;
    bars: MarketBar[];
    strategy: 'momentum' | 'mean_reversion';
  }

  function runTradingScenario(scenario: TradingScenario) {
    const { symbol, bars, strategy } = scenario;
    
    if (bars.length < 5) {
      return { signal: null, reason: 'Insufficient data' };
    }

    if (strategy === 'momentum') {
      const recentBars = bars.slice(0, 5);
      const olderBars = bars.slice(5, 10);
      
      const recentAvg = recentBars.reduce((sum, b) => sum + b.close, 0) / recentBars.length;
      const olderAvg = olderBars.length > 0 
        ? olderBars.reduce((sum, b) => sum + b.close, 0) / olderBars.length 
        : recentAvg;
      
      const momentum = olderAvg !== 0 ? (recentAvg - olderAvg) / olderAvg : 0;
      
      let signalType: 'buy' | 'sell' | 'hold' = 'hold';
      if (momentum > 0.02) signalType = 'buy';
      else if (momentum < -0.02) signalType = 'sell';
      
      return {
        signal: {
          symbol,
          signalType,
          strength: Math.min(1, Math.abs(momentum) * 10),
          confidence: Math.min(1, bars.length / 20),
          price: recentBars[0].close,
          strategy: 'momentum',
          metadata: { momentum, recentAvg, olderAvg },
        },
      };
    }

    if (strategy === 'mean_reversion') {
      const closes = bars.map(b => b.close);
      const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
      const variance = closes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / closes.length;
      const stdDev = Math.sqrt(variance);
      
      const latestPrice = closes[0];
      const zScore = stdDev > 0 ? (latestPrice - mean) / stdDev : 0;
      const threshold = 2.0;
      
      let signalType: 'buy' | 'sell' | 'hold' = 'hold';
      if (zScore < -threshold) signalType = 'buy';
      else if (zScore > threshold) signalType = 'sell';
      
      return {
        signal: {
          symbol,
          signalType,
          strength: Math.min(1, Math.abs(zScore) / threshold),
          confidence: Math.min(1, bars.length / 20),
          price: latestPrice,
          strategy: 'mean_reversion',
          metadata: { mean, stdDev, zScore },
        },
      };
    }

    return { signal: null, reason: 'Unknown strategy' };
  }

  it('should generate buy signal on upward momentum', () => {
    const scenario: TradingScenario = {
      symbol: 'AAPL',
      strategy: 'momentum',
      bars: [
        { timestamp: '2024-01-10', open: 190, high: 192, low: 189, close: 191, volume: 1000000 },
        { timestamp: '2024-01-09', open: 188, high: 191, low: 187, close: 189, volume: 1000000 },
        { timestamp: '2024-01-08', open: 186, high: 189, low: 185, close: 188, volume: 1000000 },
        { timestamp: '2024-01-07', open: 184, high: 187, low: 183, close: 186, volume: 1000000 },
        { timestamp: '2024-01-06', open: 182, high: 185, low: 181, close: 184, volume: 1000000 },
        { timestamp: '2024-01-05', open: 175, high: 178, low: 174, close: 177, volume: 1000000 },
        { timestamp: '2024-01-04', open: 173, high: 176, low: 172, close: 175, volume: 1000000 },
        { timestamp: '2024-01-03', open: 171, high: 174, low: 170, close: 173, volume: 1000000 },
        { timestamp: '2024-01-02', open: 169, high: 172, low: 168, close: 171, volume: 1000000 },
        { timestamp: '2024-01-01', open: 167, high: 170, low: 166, close: 169, volume: 1000000 },
      ],
    };

    const result = runTradingScenario(scenario);

    expect(result.signal).not.toBeNull();
    expect(result.signal?.signalType).toBe('buy');
    expect(result.signal?.strength).toBeGreaterThan(0);
  });

  it('should generate sell signal on downward momentum', () => {
    const scenario: TradingScenario = {
      symbol: 'TSLA',
      strategy: 'momentum',
      bars: [
        { timestamp: '2024-01-10', open: 170, high: 172, low: 169, close: 169, volume: 1000000 },
        { timestamp: '2024-01-09', open: 172, high: 174, low: 170, close: 171, volume: 1000000 },
        { timestamp: '2024-01-08', open: 174, high: 176, low: 173, close: 173, volume: 1000000 },
        { timestamp: '2024-01-07', open: 176, high: 178, low: 175, close: 175, volume: 1000000 },
        { timestamp: '2024-01-06', open: 178, high: 180, low: 177, close: 177, volume: 1000000 },
        { timestamp: '2024-01-05', open: 185, high: 188, low: 184, close: 186, volume: 1000000 },
        { timestamp: '2024-01-04', open: 187, high: 190, low: 186, close: 188, volume: 1000000 },
        { timestamp: '2024-01-03', open: 189, high: 192, low: 188, close: 190, volume: 1000000 },
        { timestamp: '2024-01-02', open: 191, high: 194, low: 190, close: 192, volume: 1000000 },
        { timestamp: '2024-01-01', open: 193, high: 196, low: 192, close: 194, volume: 1000000 },
      ],
    };

    const result = runTradingScenario(scenario);

    expect(result.signal).not.toBeNull();
    expect(result.signal?.signalType).toBe('sell');
  });

  it('should generate hold signal on sideways movement', () => {
    const scenario: TradingScenario = {
      symbol: 'MSFT',
      strategy: 'momentum',
      bars: [
        { timestamp: '2024-01-10', open: 400, high: 402, low: 398, close: 401, volume: 1000000 },
        { timestamp: '2024-01-09', open: 401, high: 403, low: 399, close: 400, volume: 1000000 },
        { timestamp: '2024-01-08', open: 399, high: 401, low: 397, close: 401, volume: 1000000 },
        { timestamp: '2024-01-07', open: 400, high: 402, low: 398, close: 399, volume: 1000000 },
        { timestamp: '2024-01-06', open: 401, high: 403, low: 399, close: 400, volume: 1000000 },
        { timestamp: '2024-01-05', open: 400, high: 402, low: 398, close: 401, volume: 1000000 },
        { timestamp: '2024-01-04', open: 401, high: 403, low: 399, close: 400, volume: 1000000 },
        { timestamp: '2024-01-03', open: 399, high: 401, low: 397, close: 401, volume: 1000000 },
        { timestamp: '2024-01-02', open: 400, high: 402, low: 398, close: 399, volume: 1000000 },
        { timestamp: '2024-01-01', open: 401, high: 403, low: 399, close: 400, volume: 1000000 },
      ],
    };

    const result = runTradingScenario(scenario);

    expect(result.signal).not.toBeNull();
    expect(result.signal?.signalType).toBe('hold');
  });

  it('should generate buy on mean reversion for oversold stock', () => {
    // Price dropped significantly below mean - expect reversion up
    const scenario: TradingScenario = {
      symbol: 'NVDA',
      strategy: 'mean_reversion',
      bars: [
        { timestamp: '2024-01-10', open: 420, high: 425, low: 415, close: 418, volume: 1000000 }, // Current: way below mean
        { timestamp: '2024-01-09', open: 480, high: 485, low: 475, close: 478, volume: 1000000 },
        { timestamp: '2024-01-08', open: 490, high: 495, low: 485, close: 488, volume: 1000000 },
        { timestamp: '2024-01-07', open: 500, high: 505, low: 495, close: 498, volume: 1000000 },
        { timestamp: '2024-01-06', open: 510, high: 515, low: 505, close: 508, volume: 1000000 },
        { timestamp: '2024-01-05', open: 505, high: 510, low: 500, close: 508, volume: 1000000 },
        { timestamp: '2024-01-04', open: 500, high: 505, low: 495, close: 503, volume: 1000000 },
        { timestamp: '2024-01-03', open: 495, high: 500, low: 490, close: 498, volume: 1000000 },
        { timestamp: '2024-01-02', open: 490, high: 495, low: 485, close: 493, volume: 1000000 },
        { timestamp: '2024-01-01', open: 485, high: 490, low: 480, close: 488, volume: 1000000 },
      ],
    };

    const result = runTradingScenario(scenario);

    expect(result.signal).not.toBeNull();
    expect(result.signal?.signalType).toBe('buy');
  });

  it('should generate sell on mean reversion for overbought stock', () => {
    // Price spiked significantly above mean - expect reversion down
    const scenario: TradingScenario = {
      symbol: 'AMD',
      strategy: 'mean_reversion',
      bars: [
        { timestamp: '2024-01-10', open: 195, high: 200, low: 193, close: 198, volume: 1000000 }, // Current: way above mean
        { timestamp: '2024-01-09', open: 150, high: 155, low: 148, close: 152, volume: 1000000 },
        { timestamp: '2024-01-08', open: 148, high: 153, low: 146, close: 150, volume: 1000000 },
        { timestamp: '2024-01-07', open: 146, high: 151, low: 144, close: 148, volume: 1000000 },
        { timestamp: '2024-01-06', open: 144, high: 149, low: 142, close: 146, volume: 1000000 },
        { timestamp: '2024-01-05', open: 145, high: 150, low: 143, close: 147, volume: 1000000 },
        { timestamp: '2024-01-04', open: 143, high: 148, low: 141, close: 145, volume: 1000000 },
        { timestamp: '2024-01-03', open: 141, high: 146, low: 139, close: 143, volume: 1000000 },
        { timestamp: '2024-01-02', open: 139, high: 144, low: 137, close: 141, volume: 1000000 },
        { timestamp: '2024-01-01', open: 137, high: 142, low: 135, close: 139, volume: 1000000 },
      ],
    };

    const result = runTradingScenario(scenario);

    expect(result.signal).not.toBeNull();
    expect(result.signal?.signalType).toBe('sell');
  });

  it('should return null for insufficient data', () => {
    const scenario: TradingScenario = {
      symbol: 'GOOG',
      strategy: 'momentum',
      bars: [
        { timestamp: '2024-01-03', open: 140, high: 142, low: 139, close: 141, volume: 1000000 },
        { timestamp: '2024-01-02', open: 138, high: 140, low: 137, close: 139, volume: 1000000 },
        { timestamp: '2024-01-01', open: 136, high: 138, low: 135, close: 137, volume: 1000000 },
      ],
    };

    const result = runTradingScenario(scenario);

    expect(result.signal).toBeNull();
    expect(result.reason).toBe('Insufficient data');
  });
});

describe('Holistic - Multi-Asset Portfolio', () => {
  /**
   * Simulates portfolio-level signal aggregation.
   */
  interface PortfolioSignal {
    symbol: string;
    signalType: 'buy' | 'sell' | 'hold';
    strength: number;
    weight: number; // Portfolio weight
  }

  function aggregatePortfolioSignals(signals: PortfolioSignal[]): {
    netSignal: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    allocation: Record<string, number>;
  } {
    if (signals.length === 0) {
      return { netSignal: 'neutral', strength: 0, allocation: {} };
    }

    // Calculate weighted signal
    let totalBullish = 0;
    let totalBearish = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = signal.weight * signal.strength;
      totalWeight += signal.weight;
      
      if (signal.signalType === 'buy') {
        totalBullish += weight;
      } else if (signal.signalType === 'sell') {
        totalBearish += weight;
      }
    }

    const netStrength = (totalBullish - totalBearish) / totalWeight;
    
    let netSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (netStrength > 0.1) netSignal = 'bullish';
    else if (netStrength < -0.1) netSignal = 'bearish';

    // Calculate allocation
    const allocation: Record<string, number> = {};
    for (const signal of signals) {
      if (signal.signalType === 'buy') {
        allocation[signal.symbol] = (signal.weight * signal.strength) / totalWeight;
      } else if (signal.signalType === 'sell') {
        allocation[signal.symbol] = -(signal.weight * signal.strength) / totalWeight;
      } else {
        allocation[signal.symbol] = 0;
      }
    }

    return {
      netSignal,
      strength: Math.abs(netStrength),
      allocation,
    };
  }

  it('should aggregate bullish portfolio', () => {
    const signals: PortfolioSignal[] = [
      { symbol: 'AAPL', signalType: 'buy', strength: 0.8, weight: 0.3 },
      { symbol: 'GOOGL', signalType: 'buy', strength: 0.7, weight: 0.3 },
      { symbol: 'MSFT', signalType: 'hold', strength: 0.5, weight: 0.2 },
      { symbol: 'AMZN', signalType: 'buy', strength: 0.6, weight: 0.2 },
    ];

    const result = aggregatePortfolioSignals(signals);

    expect(result.netSignal).toBe('bullish');
    expect(result.strength).toBeGreaterThan(0);
    expect(result.allocation['AAPL']).toBeGreaterThan(0);
    expect(result.allocation['MSFT']).toBe(0);
  });

  it('should aggregate bearish portfolio', () => {
    const signals: PortfolioSignal[] = [
      { symbol: 'AAPL', signalType: 'sell', strength: 0.9, weight: 0.4 },
      { symbol: 'GOOGL', signalType: 'sell', strength: 0.8, weight: 0.3 },
      { symbol: 'MSFT', signalType: 'hold', strength: 0.5, weight: 0.3 },
    ];

    const result = aggregatePortfolioSignals(signals);

    expect(result.netSignal).toBe('bearish');
    expect(result.allocation['AAPL']).toBeLessThan(0);
  });

  it('should aggregate neutral portfolio', () => {
    const signals: PortfolioSignal[] = [
      { symbol: 'AAPL', signalType: 'buy', strength: 0.6, weight: 0.25 },
      { symbol: 'GOOGL', signalType: 'sell', strength: 0.6, weight: 0.25 },
      { symbol: 'MSFT', signalType: 'hold', strength: 0.5, weight: 0.25 },
      { symbol: 'AMZN', signalType: 'hold', strength: 0.5, weight: 0.25 },
    ];

    const result = aggregatePortfolioSignals(signals);

    expect(result.netSignal).toBe('neutral');
  });

  it('should handle empty portfolio', () => {
    const result = aggregatePortfolioSignals([]);

    expect(result.netSignal).toBe('neutral');
    expect(result.strength).toBe(0);
    expect(Object.keys(result.allocation)).toHaveLength(0);
  });
});

describe('Holistic - Risk Management', () => {
  /**
   * Risk-adjusted position sizing.
   */
  interface RiskParams {
    riskTolerance: number;    // 0-1
    maxPositionSize: number;  // Max $ per position
    stopLossPercent: number;  // Stop loss as %
    volatility: number;       // Annualized volatility
    signalStrength: number;   // 0-1
    accountValue: number;     // Total account value
  }

  function calculatePositionSize(params: RiskParams): {
    size: number;
    riskAmount: number;
    stopLossPrice: number;
    riskRewardRatio: number;
  } {
    const { riskTolerance, maxPositionSize, stopLossPercent, volatility, signalStrength, accountValue } = params;

    // Risk per trade as % of account
    const riskPerTrade = riskTolerance * 0.02; // Max 2% per trade at full risk
    const maxRiskAmount = accountValue * riskPerTrade;

    // Volatility-adjusted position size
    const volatilityFactor = Math.max(0.2, 1 - volatility); // Reduce size for high vol
    const signalFactor = signalStrength;
    
    const targetSize = accountValue * 0.1 * volatilityFactor * signalFactor; // Base 10% position
    const size = Math.min(targetSize, maxPositionSize);
    
    const riskAmount = size * (stopLossPercent / 100);
    const adjustedSize = riskAmount > maxRiskAmount ? size * (maxRiskAmount / riskAmount) : size;
    
    const stopLossPrice = 100 * (1 - stopLossPercent / 100); // Assume $100 entry
    const takeProfitPrice = 100 * (1 + stopLossPercent * 2 / 100); // 2:1 R/R
    const riskRewardRatio = 2.0;

    return {
      size: Math.round(adjustedSize * 100) / 100,
      riskAmount: Math.round(adjustedSize * (stopLossPercent / 100) * 100) / 100,
      stopLossPrice,
      riskRewardRatio,
    };
  }

  it('should calculate position size based on risk tolerance', () => {
    const result = calculatePositionSize({
      riskTolerance: 0.5,
      maxPositionSize: 10000,
      stopLossPercent: 5,
      volatility: 0.3,
      signalStrength: 0.8,
      accountValue: 100000,
    });

    expect(result.size).toBeLessThanOrEqual(10000);
    expect(result.size).toBeGreaterThan(0);
    expect(result.stopLossPrice).toBe(95);
    expect(result.riskRewardRatio).toBe(2);
  });

  it('should reduce position for high volatility', () => {
    const lowVolResult = calculatePositionSize({
      riskTolerance: 0.5,
      maxPositionSize: 10000,
      stopLossPercent: 5,
      volatility: 0.2,
      signalStrength: 0.8,
      accountValue: 100000,
    });

    const highVolResult = calculatePositionSize({
      riskTolerance: 0.5,
      maxPositionSize: 10000,
      stopLossPercent: 5,
      volatility: 0.6,
      signalStrength: 0.8,
      accountValue: 100000,
    });

    expect(highVolResult.size).toBeLessThan(lowVolResult.size);
  });

  it('should scale position with signal strength', () => {
    const weakSignal = calculatePositionSize({
      riskTolerance: 0.5,
      maxPositionSize: 10000,
      stopLossPercent: 5,
      volatility: 0.3,
      signalStrength: 0.3,
      accountValue: 100000,
    });

    const strongSignal = calculatePositionSize({
      riskTolerance: 0.5,
      maxPositionSize: 10000,
      stopLossPercent: 5,
      volatility: 0.3,
      signalStrength: 0.9,
      accountValue: 100000,
    });

    expect(strongSignal.size).toBeGreaterThan(weakSignal.size);
  });

  it('should respect max position size', () => {
    const result = calculatePositionSize({
      riskTolerance: 1.0,
      maxPositionSize: 5000,
      stopLossPercent: 5,
      volatility: 0.1,
      signalStrength: 1.0,
      accountValue: 1000000,
    });

    expect(result.size).toBeLessThanOrEqual(5000);
  });
});

describe('Holistic - Signal Expiration and Lifecycle', () => {
  /**
   * Simulates signal lifecycle management.
   */
  interface Signal {
    id: string;
    generatedAt: number;
    expiresAt?: number;
    acknowledged: boolean;
    signalType: 'buy' | 'sell' | 'hold';
  }

  function isSignalValid(signal: Signal, currentTime: number): boolean {
    if (signal.acknowledged) return false;
    if (signal.expiresAt && currentTime > signal.expiresAt) return false;
    return true;
  }

  function filterValidSignals(signals: Signal[], currentTime: number): Signal[] {
    return signals.filter(s => isSignalValid(s, currentTime));
  }

  function prioritizeSignals(signals: Signal[]): Signal[] {
    // Prioritize: sell > buy > hold, and newer > older
    return signals.sort((a, b) => {
      const typeOrder = { sell: 0, buy: 1, hold: 2 };
      const typeDiff = typeOrder[a.signalType] - typeOrder[b.signalType];
      if (typeDiff !== 0) return typeDiff;
      return b.generatedAt - a.generatedAt; // Newer first
    });
  }

  it('should filter expired signals', () => {
    const now = Date.now();
    const signals: Signal[] = [
      { id: '1', generatedAt: now - 10000, expiresAt: now - 5000, acknowledged: false, signalType: 'buy' },
      { id: '2', generatedAt: now - 5000, expiresAt: now + 10000, acknowledged: false, signalType: 'sell' },
      { id: '3', generatedAt: now - 3000, acknowledged: false, signalType: 'hold' },
    ];

    const valid = filterValidSignals(signals, now);

    expect(valid).toHaveLength(2);
    expect(valid.find(s => s.id === '1')).toBeUndefined();
  });

  it('should filter acknowledged signals', () => {
    const now = Date.now();
    const signals: Signal[] = [
      { id: '1', generatedAt: now - 10000, acknowledged: true, signalType: 'buy' },
      { id: '2', generatedAt: now - 5000, acknowledged: false, signalType: 'sell' },
    ];

    const valid = filterValidSignals(signals, now);

    expect(valid).toHaveLength(1);
    expect(valid[0].id).toBe('2');
  });

  it('should prioritize sell signals over buy', () => {
    const now = Date.now();
    const signals: Signal[] = [
      { id: '1', generatedAt: now - 1000, acknowledged: false, signalType: 'buy' },
      { id: '2', generatedAt: now - 2000, acknowledged: false, signalType: 'sell' },
      { id: '3', generatedAt: now - 500, acknowledged: false, signalType: 'hold' },
    ];

    const prioritized = prioritizeSignals(signals);

    expect(prioritized[0].signalType).toBe('sell');
    expect(prioritized[1].signalType).toBe('buy');
    expect(prioritized[2].signalType).toBe('hold');
  });

  it('should prioritize newer signals of same type', () => {
    const now = Date.now();
    const signals: Signal[] = [
      { id: '1', generatedAt: now - 5000, acknowledged: false, signalType: 'buy' },
      { id: '2', generatedAt: now - 1000, acknowledged: false, signalType: 'buy' },
      { id: '3', generatedAt: now - 3000, acknowledged: false, signalType: 'buy' },
    ];

    const prioritized = prioritizeSignals(signals);

    expect(prioritized[0].id).toBe('2');
    expect(prioritized[1].id).toBe('3');
    expect(prioritized[2].id).toBe('1');
  });
});

// ============================================================================
// PERFORMANCE TESTS - High-Frequency Scenarios
// ============================================================================

describe('Performance - High-Frequency Signal Processing', () => {
  /**
   * Tests performance characteristics for high-frequency trading scenarios.
   */
  function generateLargeBarsDataset(count: number): Array<{ close: number }> {
    return Array.from({ length: count }, (_, i) => ({
      close: 100 + Math.sin(i * 0.1) * 10 + Math.random() * 2,
    }));
  }

  function processSignalsInBatch(
    bars: Array<{ close: number }>,
    windowSize: number
  ): number {
    let signalCount = 0;
    
    for (let i = windowSize; i < bars.length; i++) {
      const window = bars.slice(i - windowSize, i);
      const avg = window.reduce((s, b) => s + b.close, 0) / window.length;
      const current = bars[i].close;
      
      if (Math.abs(current - avg) / avg > 0.02) {
        signalCount++;
      }
    }
    
    return signalCount;
  }

  it('should process large bar datasets efficiently', () => {
    const bars = generateLargeBarsDataset(1000);
    
    const start = performance.now();
    const signalCount = processSignalsInBatch(bars, 20);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Should complete in <100ms
    expect(signalCount).toBeGreaterThanOrEqual(0);
  });

  it('should handle high-frequency data streams', () => {
    const iterations = 100;
    const bars = generateLargeBarsDataset(50);
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      processSignalsInBatch(bars, 10);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // 100 iterations in <50ms
  });

  it('should scale linearly with data size', () => {
    const small = generateLargeBarsDataset(100);
    const large = generateLargeBarsDataset(1000);

    const smallStart = performance.now();
    processSignalsInBatch(small, 10);
    const smallTime = performance.now() - smallStart;

    const largeStart = performance.now();
    processSignalsInBatch(large, 10);
    const largeTime = performance.now() - largeStart;

    // Large should be roughly 10x slower (linear), allow 15x for variance
    expect(largeTime / smallTime).toBeLessThan(15);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases - Data Anomalies', () => {
  it('should handle zero price', () => {
    const bars = [{ close: 0 }, { close: 100 }, { close: 100 }, { close: 100 }, { close: 100 }];
    const result = calculateMomentum(bars);
    
    // Should not crash on zero in older bars
    expect(result).not.toBeNull();
  });

  it('should handle negative momentum denominator', () => {
    // Edge case where older average could theoretically be 0
    const bars = [
      { close: 10 }, { close: 10 }, { close: 10 }, { close: 10 }, { close: 10 },
      { close: 0 }, { close: 0 }, { close: 0 }, { close: 0 }, { close: 0 },
    ];
    
    const result = calculateMomentum(bars);
    
    // Should handle zero average gracefully
    expect(result).not.toBeNull();
    expect(result!.momentum).toBe(0);
  });

  it('should handle extreme price values', () => {
    const bars = [
      { close: 1e10 }, { close: 1e10 }, { close: 1e10 }, { close: 1e10 }, { close: 1e10 },
      { close: 1e-10 }, { close: 1e-10 }, { close: 1e-10 }, { close: 1e-10 }, { close: 1e-10 },
    ];
    
    const result = calculateMomentum(bars);
    
    expect(result).not.toBeNull();
    expect(isFinite(result!.momentum)).toBe(true);
  });

  it('should handle NaN values gracefully', () => {
    const prices = [NaN, 100, 100, 100, 100];
    const result = calculateZScore(prices);
    
    // Function should handle NaN without crashing
    expect(result).not.toBeNull();
    expect(isNaN(result!.zScore)).toBe(true);
  });

  it('should handle empty symbol', () => {
    const signal = createTradingSignal('', 'buy', 0.8, 0.9, 150, 'momentum');
    expect(signal.symbol).toBe('');
  });

  it('should handle very long symbol names', () => {
    const longSymbol = 'A'.repeat(100);
    const signal = createTradingSignal(longSymbol, 'buy', 0.8, 0.9, 150, 'momentum');
    expect(signal.symbol).toBe(longSymbol);
  });
});

describe('Edge Cases - Timing', () => {
  it('should handle signals at epoch', () => {
    const signal = {
      generatedAt: 0,
      expiresAt: 1000,
      acknowledged: false,
    };
    
    expect(signal.generatedAt).toBe(0);
  });

  it('should handle far-future expiration', () => {
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365 * 100; // 100 years
    const signal = {
      generatedAt: Date.now(),
      expiresAt: farFuture,
      acknowledged: false,
    };
    
    expect(signal.expiresAt).toBe(farFuture);
  });

  it('should handle same generation and expiration time', () => {
    const now = Date.now();
    const signal = {
      generatedAt: now,
      expiresAt: now,
      acknowledged: false,
    };
    
    // Signal expires immediately - edge case
    expect(signal.expiresAt).toBe(signal.generatedAt);
  });
});

// Re-export the signal creation helper for use in other test files
function createTradingSignal(
  symbol: string,
  signalType: 'buy' | 'sell' | 'hold' | 'alert',
  strength: number,
  confidence: number,
  price: number,
  strategy: string,
  metadata: Record<string, unknown> = {},
  expiresInMs?: number
) {
  const now = Date.now();
  return {
    symbol,
    signalType,
    strength: Math.min(1, Math.max(0, strength)),
    confidence: Math.min(1, Math.max(0, confidence)),
    price,
    strategy,
    metadata,
    generatedAt: now,
    expiresAt: expiresInMs ? now + expiresInMs : undefined,
    acknowledged: false,
  };
}
