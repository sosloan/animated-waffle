/**
 * Alpaca Markets API - Common Types
 *
 * Type definitions shared across all Alpaca API endpoints:
 * - Equities (stocks)
 * - Crypto
 * - Options
 * - News
 */

// ============================================================================
// Authentication & Configuration
// ============================================================================

/**
 * Alpaca API authentication credentials.
 */
export interface AlpacaCredentials {
  /** API Key ID from Alpaca dashboard */
  apiKeyId: string;
  /** API Secret Key from Alpaca dashboard */
  apiSecretKey: string;
}

/**
 * Alpaca API environment configuration.
 */
export interface AlpacaConfig {
  /** API credentials */
  credentials: AlpacaCredentials;
  /** Use paper trading endpoint (default: true for safety) */
  paper?: boolean;
  /** Base URL override for data API */
  dataBaseUrl?: string;
  /** Base URL override for trading API */
  tradingBaseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * Timestamp format - RFC 3339 string or Unix timestamp.
 */
export type Timestamp = string | number;

/**
 * Common pagination parameters for list endpoints.
 */
export interface PaginationParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Pagination token for next page */
  pageToken?: string;
}

/**
 * Common time range parameters.
 */
export interface TimeRangeParams {
  /** Start of time range (RFC 3339 or Unix timestamp) */
  start?: Timestamp;
  /** End of time range (RFC 3339 or Unix timestamp) */
  end?: Timestamp;
}

/**
 * Sort order for results.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Timeframe for bars/aggregates.
 */
export type Timeframe =
  | '1Min'
  | '5Min'
  | '15Min'
  | '30Min'
  | '1Hour'
  | '4Hour'
  | '1Day'
  | '1Week'
  | '1Month';

/**
 * Data feed source.
 */
export type DataFeed = 'iex' | 'sip';

// ============================================================================
// Market Data Common Types
// ============================================================================

/**
 * OHLCV bar/candlestick data.
 */
export interface Bar {
  /** Bar timestamp (RFC 3339) */
  t: string;
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
  /** Volume */
  v: number;
  /** Trade count */
  n?: number;
  /** VWAP (volume-weighted average price) */
  vw?: number;
}

/**
 * Quote/BBO data.
 */
export interface Quote {
  /** Quote timestamp (RFC 3339) */
  t: string;
  /** Ask price */
  ap: number;
  /** Ask size */
  as: number;
  /** Bid price */
  bp: number;
  /** Bid size */
  bs: number;
  /** Ask exchange */
  ax?: string;
  /** Bid exchange */
  bx?: string;
  /** Quote conditions */
  c?: string[];
  /** Tape */
  z?: string;
}

/**
 * Trade data.
 */
export interface Trade {
  /** Trade timestamp (RFC 3339) */
  t: string;
  /** Trade price */
  p: number;
  /** Trade size */
  s: number;
  /** Exchange */
  x?: string;
  /** Trade ID */
  i?: string;
  /** Trade conditions */
  c?: string[];
  /** Tape */
  z?: string;
}

/**
 * Snapshot combining latest bar, quote, and trade.
 */
export interface Snapshot {
  /** Latest bar */
  latestBar?: Bar;
  /** Latest quote */
  latestQuote?: Quote;
  /** Latest trade */
  latestTrade?: Trade;
  /** Minute bar */
  minuteBar?: Bar;
  /** Daily bar */
  dailyBar?: Bar;
  /** Previous daily bar */
  prevDailyBar?: Bar;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  /** Response data */
  data: T;
  /** Next page token (if more results available) */
  nextPageToken?: string;
}

/**
 * Multi-symbol response wrapper (keyed by symbol).
 */
export interface MultiSymbolResponse<T> {
  /** Data keyed by symbol */
  [symbol: string]: T;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Alpaca API error response.
 */
export interface AlpacaErrorResponse {
  /** Error code */
  code: number;
  /** Error message */
  message: string;
}

/**
 * Alpaca API error with additional context.
 */
export class AlpacaApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly statusCode: number,
    public readonly response?: AlpacaErrorResponse
  ) {
    super(message);
    this.name = 'AlpacaApiError';
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limit information from API response headers.
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;
  /** Total requests allowed per window */
  limit: number;
  /** Time when rate limit resets (Unix timestamp) */
  resetAt: number;
}

// ============================================================================
// Request Options
// ============================================================================

/**
 * Common request options for API calls.
 */
export interface RequestOptions {
  /** Custom timeout for this request */
  timeout?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Custom headers */
  headers?: Record<string, string>;
}
