/**
 * Alpaca Markets Integration - Convex Actions & Mutations
 *
 * Functional-reactive trading at nanosecond precision.
 * Each function is pure: same inputs → same outputs.
 * Market state flows reactively through subscriptions.
 *
 * Architecture:
 * - Actions: External API calls to Alpaca (impure boundary)
 * - Mutations: Database writes with transactional guarantees
 * - Queries: Reactive subscriptions to market state
 */

import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

const ALPACA_DATA_BASE_URL = "https://data.alpaca.markets";

// ============================================================================
// Types (mirrored from src/core/integrations/alpaca for Convex compatibility)
// ============================================================================

/** Bar data from Alpaca */
interface AlpacaBar {
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  n?: number; // trade count
  vw?: number; // vwap
}

/** Trade data from Alpaca */
interface AlpacaTrade {
  t: string;
  p: number;
  s: number;
  x?: string;
  i?: string;
}

/** Quote data from Alpaca */
interface AlpacaQuote {
  t: string;
  ap: number;
  as: number;
  bp: number;
  bs: number;
}

/** Snapshot data from Alpaca */
interface AlpacaSnapshot {
  latestTrade?: AlpacaTrade;
  latestQuote?: AlpacaQuote;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build query string from parameters.
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

/**
 * Make authenticated request to Alpaca API.
 */
async function alpacaRequest<T>(
  path: string,
  apiKeyId: string,
  apiSecretKey: string,
  queryParams: Record<string, unknown> = {}
): Promise<T> {
  const query = buildQueryString(queryParams);
  const url = `${ALPACA_DATA_BASE_URL}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "APCA-API-KEY-ID": apiKeyId,
      "APCA-API-SECRET-KEY": apiSecretKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return (await response.json()) as T;
}

// ============================================================================
// Queries - Reactive Market Data Subscriptions
// ============================================================================

/**
 * Get latest market snapshot for a symbol.
 * Clients subscribe to this for real-time price updates.
 */
export const getSnapshot = query({
  args: {
    symbol: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("marketSnapshots")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .first();
  },
});

/**
 * Get all snapshots for multiple symbols.
 * Batch subscription for portfolio views.
 */
export const getSnapshots = query({
  args: {
    symbols: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const snapshots: Record<string, Doc<"marketSnapshots"> | null> = {};
    for (const symbol of args.symbols) {
      snapshots[symbol] = await ctx.db
        .query("marketSnapshots")
        .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
        .first();
    }
    return snapshots;
  },
});

/**
 * Get historical bars for a symbol.
 */
export const getBars = query({
  args: {
    symbol: v.string(),
    timeframe: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("marketBars")
      .withIndex("by_symbol", (idx) => idx.eq("symbol", args.symbol))
      .order("desc");

    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

/**
 * Get active trading signals.
 */
export const getActiveSignals = query({
  args: {
    symbol: v.optional(v.string()),
    signalType: v.optional(
      v.union(v.literal("buy"), v.literal("sell"), v.literal("hold"), v.literal("alert"))
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("tradingSignals").withIndex("by_acknowledged", (idx) =>
      idx.eq("acknowledged", false)
    );

    const signals = await q.collect();

    return signals.filter((s) => {
      if (args.symbol && s.symbol !== args.symbol) return false;
      if (args.signalType && s.signalType !== args.signalType) return false;
      if (s.expiresAt && s.expiresAt < Date.now()) return false;
      return true;
    });
  },
});

/**
 * Get all traders.
 */
export const getTraders = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("traders")
        .filter((q) => q.eq(q.field("state.isActive"), true))
        .collect();
    }
    return await ctx.db.query("traders").collect();
  },
});

/**
 * Get a specific trader by name.
 */
export const getTrader = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("traders")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Get a specific trader by ID.
 */
export const getTraderById = query({
  args: {
    traderId: v.id("traders"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.traderId);
  },
});

// ============================================================================
// Internal Queries - For use by actions
// ============================================================================

export const _getTraderInternal = internalQuery({
  args: {
    traderId: v.id("traders"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.traderId);
  },
});

// ============================================================================
// Mutations - Database Writes
// ============================================================================

/**
 * Store market bars from Alpaca API response.
 * Internal mutation for use by actions.
 */
export const _storeBars = internalMutation({
  args: {
    symbol: v.string(),
    assetType: v.union(v.literal("equity"), v.literal("crypto"), v.literal("option")),
    timeframe: v.string(),
    bars: v.array(
      v.object({
        t: v.string(),
        o: v.number(),
        h: v.number(),
        l: v.number(),
        c: v.number(),
        v: v.number(),
        vw: v.optional(v.number()),
        n: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const inserted: Id<"marketBars">[] = [];

    for (const bar of args.bars) {
      const id = await ctx.db.insert("marketBars", {
        symbol: args.symbol,
        assetType: args.assetType,
        timeframe: args.timeframe,
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        vwap: bar.vw,
        tradeCount: bar.n,
        fetchedAt: now,
      });
      inserted.push(id);
    }

    return { inserted: inserted.length, symbol: args.symbol };
  },
});

/**
 * Update or create market snapshot.
 * Internal mutation for use by actions.
 */
export const _updateSnapshot = internalMutation({
  args: {
    symbol: v.string(),
    assetType: v.union(v.literal("equity"), v.literal("crypto"), v.literal("option")),
    latestPrice: v.number(),
    bidPrice: v.optional(v.number()),
    askPrice: v.optional(v.number()),
    bidSize: v.optional(v.number()),
    askSize: v.optional(v.number()),
    volume: v.optional(v.number()),
    dailyHigh: v.optional(v.number()),
    dailyLow: v.optional(v.number()),
    dailyOpen: v.optional(v.number()),
    prevClose: v.optional(v.number()),
    change: v.optional(v.number()),
    changePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return { updated: true, id: existing._id };
    } else {
      const id = await ctx.db.insert("marketSnapshots", {
        ...args,
        updatedAt: now,
      });
      return { updated: false, id };
    }
  },
});

/**
 * Create a new trading signal.
 */
export const createSignal = mutation({
  args: {
    symbol: v.string(),
    signalType: v.union(v.literal("buy"), v.literal("sell"), v.literal("hold"), v.literal("alert")),
    strength: v.number(),
    confidence: v.number(),
    price: v.number(),
    strategy: v.string(),
    metadata: v.optional(v.any()),
    expiresInMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = args.expiresInMs ? now + args.expiresInMs : undefined;

    const id = await ctx.db.insert("tradingSignals", {
      symbol: args.symbol,
      signalType: args.signalType,
      strength: args.strength,
      confidence: args.confidence,
      price: args.price,
      strategy: args.strategy,
      metadata: args.metadata,
      generatedAt: now,
      expiresAt,
      acknowledged: false,
    });

    return { id, generatedAt: now };
  },
});

/**
 * Acknowledge a trading signal.
 */
export const acknowledgeSignal = mutation({
  args: {
    signalId: v.id("tradingSignals"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.signalId, { acknowledged: true });
    return { acknowledged: true };
  },
});

/**
 * Create a new trader.
 */
export const createTrader = mutation({
  args: {
    name: v.string(),
    strategy: v.string(),
    symbols: v.array(v.string()),
    config: v.object({
      riskTolerance: v.number(),
      maxPositionSize: v.number(),
      stopLossPercent: v.optional(v.number()),
      takeProfitPercent: v.optional(v.number()),
      cooldownMs: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if trader with same name exists
    const existing = await ctx.db
      .query("traders")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error(`Trader with name "${args.name}" already exists`);
    }

    const id = await ctx.db.insert("traders", {
      name: args.name,
      strategy: args.strategy,
      symbols: args.symbols,
      config: args.config,
      state: {
        isActive: true,
        totalSignals: 0,
        performance: {
          successRate: 0,
          totalTrades: 0,
          pnl: 0,
        },
      },
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  },
});

/**
 * Update trader state.
 */
export const updateTraderState = mutation({
  args: {
    traderId: v.id("traders"),
    isActive: v.optional(v.boolean()),
    lastSignalAt: v.optional(v.number()),
    incrementSignals: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader) {
      throw new Error("Trader not found");
    }

    const updates: Partial<Doc<"traders">> = {
      updatedAt: Date.now(),
    };

    const newState = { ...trader.state };
    if (args.isActive !== undefined) {
      newState.isActive = args.isActive;
    }
    if (args.lastSignalAt !== undefined) {
      newState.lastSignalAt = args.lastSignalAt;
    }
    if (args.incrementSignals) {
      newState.totalSignals += 1;
    }

    updates.state = newState;

    await ctx.db.patch(args.traderId, updates);
    return { updated: true };
  },
});

// ============================================================================
// Actions - External Alpaca API Calls (using internalAction to avoid type issues)
// ============================================================================

/**
 * Fetch stock bars from Alpaca and store in Convex.
 * This is the impure boundary - all Alpaca API calls happen here.
 */
export const fetchStockBars = internalAction({
  args: {
    symbols: v.array(v.string()),
    timeframe: v.string(),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get API credentials from environment
    const apiKeyId = process.env.ALPACA_API_KEY_ID;
    const apiSecretKey = process.env.ALPACA_API_SECRET_KEY;

    if (!apiKeyId || !apiSecretKey) {
      throw new Error("Missing Alpaca API credentials. Set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY environment variables.");
    }

    const response = await alpacaRequest<{ bars: Record<string, AlpacaBar[]> }>(
      "/v2/stocks/bars",
      apiKeyId,
      apiSecretKey,
      {
        symbols: args.symbols.join(","),
        timeframe: args.timeframe,
        start: args.start,
        end: args.end,
        limit: args.limit,
      }
    );

    // Return the data - caller will store it
    return { bars: response.bars, timestamp: Date.now() };
  },
});

/**
 * Fetch crypto bars from Alpaca.
 */
export const fetchCryptoBars = internalAction({
  args: {
    symbols: v.array(v.string()),
    timeframe: v.string(),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKeyId = process.env.ALPACA_API_KEY_ID;
    const apiSecretKey = process.env.ALPACA_API_SECRET_KEY;

    if (!apiKeyId || !apiSecretKey) {
      throw new Error("Missing Alpaca API credentials.");
    }

    const response = await alpacaRequest<{ bars: Record<string, AlpacaBar[]> }>(
      "/v1beta3/crypto/us/bars",
      apiKeyId,
      apiSecretKey,
      {
        symbols: args.symbols.join(","),
        timeframe: args.timeframe,
        start: args.start,
        end: args.end,
        limit: args.limit,
      }
    );

    return { bars: response.bars, timestamp: Date.now() };
  },
});

/**
 * Fetch stock snapshot from Alpaca.
 */
export const fetchStockSnapshot = internalAction({
  args: {
    symbols: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKeyId = process.env.ALPACA_API_KEY_ID;
    const apiSecretKey = process.env.ALPACA_API_SECRET_KEY;

    if (!apiKeyId || !apiSecretKey) {
      throw new Error("Missing Alpaca API credentials.");
    }

    const response = await alpacaRequest<{ snapshots: Record<string, AlpacaSnapshot> }>(
      "/v2/stocks/snapshots",
      apiKeyId,
      apiSecretKey,
      {
        symbols: args.symbols.join(","),
      }
    );

    return { snapshots: response.snapshots, timestamp: Date.now() };
  },
});

/**
 * Fetch crypto snapshot from Alpaca.
 */
export const fetchCryptoSnapshot = internalAction({
  args: {
    symbols: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKeyId = process.env.ALPACA_API_KEY_ID;
    const apiSecretKey = process.env.ALPACA_API_SECRET_KEY;

    if (!apiKeyId || !apiSecretKey) {
      throw new Error("Missing Alpaca API credentials.");
    }

    const response = await alpacaRequest<{ snapshots: Record<string, AlpacaSnapshot> }>(
      "/v1beta3/crypto/us/snapshots",
      apiKeyId,
      apiSecretKey,
      {
        symbols: args.symbols.join(","),
      }
    );

    return { snapshots: response.snapshots, timestamp: Date.now() };
  },
});

// ============================================================================
// Functional-Reactive Trading Logic
// ============================================================================

/**
 * Simple momentum strategy signal generator.
 * Pure function: bars → signal
 */
export const generateMomentumSignal = mutation({
  args: {
    symbol: v.string(),
    traderId: v.id("traders"),
  },
  handler: async (ctx, args) => {
    // Get recent bars
    const bars = await ctx.db
      .query("marketBars")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .order("desc")
      .take(20);

    if (bars.length < 5) {
      return { signal: null, reason: "Insufficient data" };
    }

    // Simple momentum calculation
    const recentBars = bars.slice(0, 5);
    const olderBars = bars.slice(5, 10);

    const recentAvg = recentBars.reduce((sum, b) => sum + b.close, 0) / recentBars.length;
    const olderAvg = olderBars.length > 0 
      ? olderBars.reduce((sum, b) => sum + b.close, 0) / olderBars.length 
      : recentAvg;

    const momentum = (recentAvg - olderAvg) / olderAvg;
    const latestPrice = recentBars[0].close;

    // Generate signal based on momentum
    let signalType: "buy" | "sell" | "hold" = "hold";
    let strength = Math.abs(momentum);
    
    if (momentum > 0.02) {
      signalType = "buy";
    } else if (momentum < -0.02) {
      signalType = "sell";
    }

    // Create the signal
    const now = Date.now();
    const signalId = await ctx.db.insert("tradingSignals", {
      symbol: args.symbol,
      signalType,
      strength: Math.min(1, strength * 10), // Scale to 0-1
      confidence: Math.min(1, bars.length / 20), // More data = more confidence
      price: latestPrice,
      strategy: "momentum",
      metadata: { momentum, recentAvg, olderAvg },
      generatedAt: now,
      expiresAt: now + 5 * 60 * 1000, // 5 minute expiry
      acknowledged: false,
    });

    // Update trader state
    const trader = await ctx.db.get(args.traderId);
    if (trader) {
      await ctx.db.patch(args.traderId, {
        state: {
          ...trader.state,
          lastSignalAt: now,
          totalSignals: trader.state.totalSignals + 1,
        },
        updatedAt: now,
      });
    }

    return {
      signal: {
        id: signalId,
        type: signalType,
        strength: Math.min(1, strength * 10),
        price: latestPrice,
        momentum,
      },
    };
  },
});

/**
 * Mean reversion strategy signal generator.
 * Pure function: bars + snapshot → signal
 */
export const generateMeanReversionSignal = mutation({
  args: {
    symbol: v.string(),
    traderId: v.id("traders"),
    lookbackPeriod: v.optional(v.number()),
    deviationThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lookback = args.lookbackPeriod ?? 20;
    const threshold = args.deviationThreshold ?? 2.0;

    // Get historical bars
    const bars = await ctx.db
      .query("marketBars")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .order("desc")
      .take(lookback);

    if (bars.length < lookback / 2) {
      return { signal: null, reason: "Insufficient data" };
    }

    // Calculate mean and standard deviation
    const closes = bars.map((b) => b.close);
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance = closes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / closes.length;
    const stdDev = Math.sqrt(variance);

    const latestPrice = closes[0];
    const zScore = stdDev > 0 ? (latestPrice - mean) / stdDev : 0;

    // Generate signal based on z-score
    let signalType: "buy" | "sell" | "hold" = "hold";
    let strength = Math.abs(zScore) / threshold;

    if (zScore < -threshold) {
      signalType = "buy"; // Price below mean - expect reversion up
    } else if (zScore > threshold) {
      signalType = "sell"; // Price above mean - expect reversion down
    }

    const now = Date.now();
    const signalId = await ctx.db.insert("tradingSignals", {
      symbol: args.symbol,
      signalType,
      strength: Math.min(1, strength),
      confidence: Math.min(1, bars.length / lookback),
      price: latestPrice,
      strategy: "mean_reversion",
      metadata: { mean, stdDev, zScore, lookback },
      generatedAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minute expiry
      acknowledged: false,
    });

    // Update trader state
    const trader = await ctx.db.get(args.traderId);
    if (trader) {
      await ctx.db.patch(args.traderId, {
        state: {
          ...trader.state,
          lastSignalAt: now,
          totalSignals: trader.state.totalSignals + 1,
        },
        updatedAt: now,
      });
    }

    return {
      signal: {
        id: signalId,
        type: signalType,
        strength: Math.min(1, strength),
        price: latestPrice,
        zScore,
        mean,
        stdDev,
      },
    };
  },
});

/**
 * Reactive market data refresh - orchestrates data fetching.
 * Call this periodically to keep market data fresh.
 */
export const refreshMarketData = mutation({
  args: {
    symbols: v.array(v.string()),
    assetType: v.union(v.literal("equity"), v.literal("crypto")),
    timeframe: v.string(),
  },
  handler: async (ctx, args) => {
    // Create a data fetch job record
    const jobId = await ctx.db.insert("dataFetchJobs", {
      jobType: "bars",
      assetType: args.assetType,
      symbols: args.symbols,
      status: "pending",
    });

    return { jobId, symbols: args.symbols, status: "scheduled" };
  },
});

/**
 * Update data fetch job status.
 */
export const updateFetchJobStatus = internalMutation({
  args: {
    jobId: v.id("dataFetchJobs"),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    recordsCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: Partial<Doc<"dataFetchJobs">> = {
      status: args.status,
    };

    if (args.status === "running") {
      updates.startedAt = now;
    } else if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now;
      if (args.recordsCount !== undefined) {
        updates.recordsCount = args.recordsCount;
      }
      if (args.error !== undefined) {
        updates.error = args.error;
      }
    }

    await ctx.db.patch(args.jobId, updates);
    return { updated: true };
  },
});
