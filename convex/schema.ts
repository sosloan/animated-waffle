import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  numbers: defineTable({
    value: v.number(),
  }),

  // ============================================================================
  // Alpaca Markets Integration - Functional-Reactive Trading
  // ============================================================================

  /**
   * Market data bars (OHLCV) - stored for reactive queries
   * Optimized for nanosecond-precision reactive updates
   */
  marketBars: defineTable({
    symbol: v.string(),
    assetType: v.union(v.literal("equity"), v.literal("crypto"), v.literal("option")),
    timeframe: v.string(),
    timestamp: v.string(), // RFC 3339 timestamp
    open: v.number(),
    high: v.number(),
    low: v.number(),
    close: v.number(),
    volume: v.number(),
    vwap: v.optional(v.number()),
    tradeCount: v.optional(v.number()),
    fetchedAt: v.number(), // Unix timestamp when data was fetched
  })
    .index("by_symbol", ["symbol"])
    .index("by_symbol_timeframe", ["symbol", "timeframe"])
    .index("by_symbol_timestamp", ["symbol", "timestamp"])
    .index("by_asset_type", ["assetType"]),

  /**
   * Trading signals - reactive signals from analysis/strategy
   * Sub-millisecond signal generation and propagation
   */
  tradingSignals: defineTable({
    symbol: v.string(),
    signalType: v.union(
      v.literal("buy"),
      v.literal("sell"),
      v.literal("hold"),
      v.literal("alert")
    ),
    strength: v.number(), // 0-1 signal strength
    confidence: v.number(), // 0-1 confidence level
    price: v.number(), // Price at signal generation
    strategy: v.string(), // Strategy that generated signal
    metadata: v.optional(v.any()), // Additional strategy-specific data
    generatedAt: v.number(), // Unix timestamp (nanosecond precision when possible)
    expiresAt: v.optional(v.number()), // Signal expiry time
    acknowledged: v.boolean(),
  })
    .index("by_symbol", ["symbol"])
    .index("by_signal_type", ["signalType"])
    .index("by_strategy", ["strategy"])
    .index("by_generated_at", ["generatedAt"])
    .index("by_acknowledged", ["acknowledged"]),

  /**
   * Market snapshots - latest state for each symbol
   * Real-time reactive state management
   */
  marketSnapshots: defineTable({
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
    updatedAt: v.number(),
  })
    .index("by_symbol", ["symbol"])
    .index("by_asset_type", ["assetType"]),

  /**
   * Trader state - functional-reactive trader configurations
   * Each trader is a pure function of market state
   */
  traders: defineTable({
    name: v.string(),
    strategy: v.string(),
    symbols: v.array(v.string()),
    config: v.object({
      riskTolerance: v.number(), // 0-1
      maxPositionSize: v.number(),
      stopLossPercent: v.optional(v.number()),
      takeProfitPercent: v.optional(v.number()),
      cooldownMs: v.optional(v.number()), // Minimum time between trades
    }),
    state: v.object({
      isActive: v.boolean(),
      lastSignalAt: v.optional(v.number()),
      totalSignals: v.number(),
      performance: v.object({
        successRate: v.number(),
        totalTrades: v.number(),
        pnl: v.number(),
      }),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_strategy", ["strategy"])
    .index("by_active", ["state.isActive"]),

  /**
   * Data fetch jobs - track Alpaca API requests
   * For rate limiting and audit
   */
  dataFetchJobs: defineTable({
    jobType: v.union(
      v.literal("bars"),
      v.literal("quotes"),
      v.literal("trades"),
      v.literal("snapshot"),
      v.literal("news")
    ),
    assetType: v.union(v.literal("equity"), v.literal("crypto"), v.literal("option")),
    symbols: v.array(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    recordsCount: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_job_type", ["jobType"]),
});
