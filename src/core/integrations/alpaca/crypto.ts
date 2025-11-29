/**
 * Alpaca Markets API - Crypto Market Data
 *
 * Provides access to cryptocurrency market data including:
 * - Historical and real-time bars (OHLCV)
 * - Quotes (bid/ask)
 * - Trades
 * - Snapshots
 * - Orderbooks
 */

import type {
  AlpacaConfig,
  Bar,
  Quote,
  Trade,
  Snapshot,
  Timeframe,
  SortOrder,
  PaginationParams,
  TimeRangeParams,
  RequestOptions,
  MultiSymbolResponse,
} from './types';

// ============================================================================
// Crypto-Specific Types
// ============================================================================

/**
 * Crypto exchange/location code.
 */
export type CryptoExchange = 'CBSE' | 'ERSX' | 'FTX' | 'GNSS';

/**
 * Crypto bar data.
 */
export interface CryptoBar extends Bar {
  /** Volume-weighted average price */
  vw: number;
}

/**
 * Crypto trade data.
 */
export interface CryptoTrade extends Trade {
  /** Trade ID */
  i: number;
  /** Taker side ('B' = buy, 'S' = sell) */
  tks: 'B' | 'S';
}

/**
 * Crypto quote/BBO data.
 * Extends base Quote with crypto-specific fields.
 */
export type CryptoQuote = Quote;

/**
 * Crypto snapshot with latest data.
 */
export interface CryptoSnapshot extends Snapshot {
  latestBar?: CryptoBar;
  latestQuote?: CryptoQuote;
  latestTrade?: CryptoTrade;
  minuteBar?: CryptoBar;
  dailyBar?: CryptoBar;
  prevDailyBar?: CryptoBar;
}

/**
 * Orderbook price level.
 */
export interface OrderbookLevel {
  /** Price */
  p: number;
  /** Size */
  s: number;
}

/**
 * Crypto orderbook snapshot.
 */
export interface CryptoOrderbook {
  /** Timestamp (RFC 3339) */
  t: string;
  /** Bid levels (sorted by price descending) */
  b: OrderbookLevel[];
  /** Ask levels (sorted by price ascending) */
  a: OrderbookLevel[];
}

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Parameters for fetching crypto bars.
 */
export interface GetCryptoBarsParams extends PaginationParams, TimeRangeParams {
  /** Crypto symbol(s) - e.g., 'BTC/USD', 'ETH/USD' */
  symbols: string | string[];
  /** Bar timeframe */
  timeframe: Timeframe;
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching crypto trades.
 */
export interface GetCryptoTradesParams
  extends PaginationParams,
    TimeRangeParams {
  /** Crypto symbol(s) */
  symbols: string | string[];
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching crypto quotes.
 */
export interface GetCryptoQuotesParams
  extends PaginationParams,
    TimeRangeParams {
  /** Crypto symbol(s) */
  symbols: string | string[];
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching crypto snapshots.
 */
export interface GetCryptoSnapshotsParams {
  /** Crypto symbol(s) */
  symbols: string | string[];
}

/**
 * Parameters for fetching crypto orderbook.
 */
export interface GetCryptoOrderbookParams {
  /** Crypto symbol */
  symbol: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response for crypto bars request.
 */
export interface CryptoBarsResponse {
  bars: MultiSymbolResponse<CryptoBar[]>;
  nextPageToken?: string;
}

/**
 * Response for crypto trades request.
 */
export interface CryptoTradesResponse {
  trades: MultiSymbolResponse<CryptoTrade[]>;
  nextPageToken?: string;
}

/**
 * Response for crypto quotes request.
 */
export interface CryptoQuotesResponse {
  quotes: MultiSymbolResponse<CryptoQuote[]>;
  nextPageToken?: string;
}

/**
 * Response for crypto snapshots request.
 */
export interface CryptoSnapshotsResponse {
  snapshots: MultiSymbolResponse<CryptoSnapshot>;
}

// ============================================================================
// Crypto Client Interface
// ============================================================================

/**
 * Client interface for Alpaca Crypto Market Data API.
 */
export interface CryptoClient {
  /**
   * Get historical bars for one or more crypto symbols.
   */
  getBars(
    params: GetCryptoBarsParams,
    options?: RequestOptions
  ): Promise<CryptoBarsResponse>;

  /**
   * Get historical trades for one or more crypto symbols.
   */
  getTrades(
    params: GetCryptoTradesParams,
    options?: RequestOptions
  ): Promise<CryptoTradesResponse>;

  /**
   * Get historical quotes for one or more crypto symbols.
   */
  getQuotes(
    params: GetCryptoQuotesParams,
    options?: RequestOptions
  ): Promise<CryptoQuotesResponse>;

  /**
   * Get current snapshots for one or more crypto symbols.
   */
  getSnapshots(
    params: GetCryptoSnapshotsParams,
    options?: RequestOptions
  ): Promise<CryptoSnapshotsResponse>;

  /**
   * Get the latest bar for a single crypto symbol.
   */
  getLatestBar(
    symbol: string,
    options?: RequestOptions
  ): Promise<CryptoBar | null>;

  /**
   * Get the latest trade for a single crypto symbol.
   */
  getLatestTrade(
    symbol: string,
    options?: RequestOptions
  ): Promise<CryptoTrade | null>;

  /**
   * Get the latest quote for a single crypto symbol.
   */
  getLatestQuote(
    symbol: string,
    options?: RequestOptions
  ): Promise<CryptoQuote | null>;

  /**
   * Get the current orderbook for a crypto symbol.
   */
  getOrderbook(
    params: GetCryptoOrderbookParams,
    options?: RequestOptions
  ): Promise<CryptoOrderbook>;
}

// ============================================================================
// Crypto Client Implementation
// ============================================================================

/**
 * Default crypto data API base URL.
 */
const DEFAULT_CRYPTO_BASE_URL = 'https://data.alpaca.markets';

/**
 * Build query string from parameters.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return [k, v.join(',')];
      }
      return [k, String(v)];
    });
  return new URLSearchParams(entries).toString();
}

/**
 * Normalize crypto symbol for URL (replace '/' with '%2F').
 */
function _normalizeSymbol(symbol: string): string {
  return encodeURIComponent(symbol);
}

/**
 * Create a Crypto Market Data client.
 */
export function createCryptoClient(config: AlpacaConfig): CryptoClient {
  const baseUrl = config.dataBaseUrl ?? DEFAULT_CRYPTO_BASE_URL;
  const timeout = config.timeout ?? 30000;

  /**
   * Make an authenticated API request.
   */
  async function request<T>(
    path: string,
    queryParams: Record<string, unknown> = {},
    options?: RequestOptions
  ): Promise<T> {
    const query = buildQueryString(queryParams);
    const url = `${baseUrl}${path}${query ? `?${query}` : ''}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout ?? timeout
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': config.credentials.apiKeyId,
          'APCA-API-SECRET-KEY': config.credentials.apiSecretKey,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: options?.signal ?? controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Alpaca Crypto API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async getBars(
      params: GetCryptoBarsParams,
      options?: RequestOptions
    ): Promise<CryptoBarsResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<CryptoBarsResponse>(
        '/v1beta3/crypto/us/bars',
        {
          symbols: symbols,
          timeframe: params.timeframe,
          start: params.start,
          end: params.end,
          limit: params.limit,
          page_token: params.pageToken,
          sort: params.sort,
        },
        options
      );
    },

    async getTrades(
      params: GetCryptoTradesParams,
      options?: RequestOptions
    ): Promise<CryptoTradesResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<CryptoTradesResponse>(
        '/v1beta3/crypto/us/trades',
        {
          symbols: symbols,
          start: params.start,
          end: params.end,
          limit: params.limit,
          page_token: params.pageToken,
          sort: params.sort,
        },
        options
      );
    },

    async getQuotes(
      params: GetCryptoQuotesParams,
      options?: RequestOptions
    ): Promise<CryptoQuotesResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<CryptoQuotesResponse>(
        '/v1beta3/crypto/us/quotes',
        {
          symbols: symbols,
          start: params.start,
          end: params.end,
          limit: params.limit,
          page_token: params.pageToken,
          sort: params.sort,
        },
        options
      );
    },

    async getSnapshots(
      params: GetCryptoSnapshotsParams,
      options?: RequestOptions
    ): Promise<CryptoSnapshotsResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<CryptoSnapshotsResponse>(
        '/v1beta3/crypto/us/snapshots',
        {
          symbols: symbols,
        },
        options
      );
    },

    async getLatestBar(
      symbol: string,
      options?: RequestOptions
    ): Promise<CryptoBar | null> {
      const response = await request<{ bars: MultiSymbolResponse<CryptoBar> }>(
        `/v1beta3/crypto/us/latest/bars`,
        { symbols: symbol },
        options
      );
      return response.bars?.[symbol] ?? null;
    },

    async getLatestTrade(
      symbol: string,
      options?: RequestOptions
    ): Promise<CryptoTrade | null> {
      const response = await request<{
        trades: MultiSymbolResponse<CryptoTrade>;
      }>(`/v1beta3/crypto/us/latest/trades`, { symbols: symbol }, options);
      return response.trades?.[symbol] ?? null;
    },

    async getLatestQuote(
      symbol: string,
      options?: RequestOptions
    ): Promise<CryptoQuote | null> {
      const response = await request<{
        quotes: MultiSymbolResponse<CryptoQuote>;
      }>(`/v1beta3/crypto/us/latest/quotes`, { symbols: symbol }, options);
      return response.quotes?.[symbol] ?? null;
    },

    async getOrderbook(
      params: GetCryptoOrderbookParams,
      options?: RequestOptions
    ): Promise<CryptoOrderbook> {
      const response = await request<{
        orderbooks: MultiSymbolResponse<CryptoOrderbook>;
      }>(
        `/v1beta3/crypto/us/orderbooks`,
        { symbols: params.symbol },
        options
      );
      const orderbook = response.orderbooks?.[params.symbol];
      if (!orderbook) {
        throw new Error(`No orderbook data for symbol: ${params.symbol}`);
      }
      return orderbook;
    },
  };
}
