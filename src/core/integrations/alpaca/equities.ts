/**
 * Alpaca Markets API - Equities (Stocks) Market Data
 *
 * Provides access to stock market data including:
 * - Historical and real-time bars (OHLCV)
 * - Quotes (bid/ask)
 * - Trades
 * - Snapshots
 */

import type {
  AlpacaConfig,
  Bar,
  Quote,
  Trade,
  Snapshot,
  Timeframe,
  DataFeed,
  SortOrder,
  PaginationParams,
  TimeRangeParams,
  RequestOptions,
  MultiSymbolResponse,
} from './types';
import { buildQueryString } from './utils';

// ============================================================================
// Equities-Specific Types
// ============================================================================

/**
 * Stock exchange code.
 */
export type StockExchange =
  | 'AMEX'
  | 'ARCA'
  | 'BATS'
  | 'NYSE'
  | 'NASDAQ'
  | 'NYSEARCA'
  | 'OTC';

/**
 * Stock bar with volume-weighted average price.
 */
export interface StockBar extends Bar {
  /** Volume-weighted average price */
  vw: number;
}

/**
 * Stock trade data.
 */
export interface StockTrade extends Trade {
  /** Trade ID */
  i: string;
  /** Exchange code */
  x: string;
}

/**
 * Stock quote with exchange codes.
 */
export interface StockQuote extends Quote {
  /** Ask exchange code */
  ax: string;
  /** Bid exchange code */
  bx: string;
}

/**
 * Stock snapshot with all latest data.
 */
export interface StockSnapshot extends Snapshot {
  latestBar?: StockBar;
  latestQuote?: StockQuote;
  latestTrade?: StockTrade;
  minuteBar?: StockBar;
  dailyBar?: StockBar;
  prevDailyBar?: StockBar;
}

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Parameters for fetching stock bars.
 */
export interface GetStockBarsParams
  extends PaginationParams,
    TimeRangeParams {
  /** Stock symbol(s) */
  symbols: string | string[];
  /** Bar timeframe */
  timeframe: Timeframe;
  /** Adjustment type for bars */
  adjustment?: 'raw' | 'split' | 'dividend' | 'all';
  /** Data feed source */
  feed?: DataFeed;
  /** Currency for price data */
  currency?: string;
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching stock trades.
 */
export interface GetStockTradesParams
  extends PaginationParams,
    TimeRangeParams {
  /** Stock symbol(s) */
  symbols: string | string[];
  /** Data feed source */
  feed?: DataFeed;
  /** Currency for price data */
  currency?: string;
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching stock quotes.
 */
export interface GetStockQuotesParams
  extends PaginationParams,
    TimeRangeParams {
  /** Stock symbol(s) */
  symbols: string | string[];
  /** Data feed source */
  feed?: DataFeed;
  /** Currency for price data */
  currency?: string;
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching stock snapshots.
 */
export interface GetStockSnapshotsParams {
  /** Stock symbol(s) */
  symbols: string | string[];
  /** Data feed source */
  feed?: DataFeed;
  /** Currency for price data */
  currency?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response for stock bars request.
 */
export interface StockBarsResponse {
  bars: MultiSymbolResponse<StockBar[]>;
  nextPageToken?: string;
}

/**
 * Response for stock trades request.
 */
export interface StockTradesResponse {
  trades: MultiSymbolResponse<StockTrade[]>;
  nextPageToken?: string;
}

/**
 * Response for stock quotes request.
 */
export interface StockQuotesResponse {
  quotes: MultiSymbolResponse<StockQuote[]>;
  nextPageToken?: string;
}

/**
 * Response for stock snapshots request.
 */
export interface StockSnapshotsResponse {
  snapshots: MultiSymbolResponse<StockSnapshot>;
}

// ============================================================================
// Equities Client Interface
// ============================================================================

/**
 * Client interface for Alpaca Equities Market Data API.
 */
export interface EquitiesClient {
  /**
   * Get historical bars for one or more stock symbols.
   */
  getBars(
    params: GetStockBarsParams,
    options?: RequestOptions
  ): Promise<StockBarsResponse>;

  /**
   * Get historical trades for one or more stock symbols.
   */
  getTrades(
    params: GetStockTradesParams,
    options?: RequestOptions
  ): Promise<StockTradesResponse>;

  /**
   * Get historical quotes for one or more stock symbols.
   */
  getQuotes(
    params: GetStockQuotesParams,
    options?: RequestOptions
  ): Promise<StockQuotesResponse>;

  /**
   * Get current snapshots for one or more stock symbols.
   */
  getSnapshots(
    params: GetStockSnapshotsParams,
    options?: RequestOptions
  ): Promise<StockSnapshotsResponse>;

  /**
   * Get the latest bar for a single symbol.
   */
  getLatestBar(
    symbol: string,
    feed?: DataFeed,
    options?: RequestOptions
  ): Promise<StockBar | null>;

  /**
   * Get the latest trade for a single symbol.
   */
  getLatestTrade(
    symbol: string,
    feed?: DataFeed,
    options?: RequestOptions
  ): Promise<StockTrade | null>;

  /**
   * Get the latest quote for a single symbol.
   */
  getLatestQuote(
    symbol: string,
    feed?: DataFeed,
    options?: RequestOptions
  ): Promise<StockQuote | null>;
}

// ============================================================================
// Equities Client Implementation
// ============================================================================

/**
 * Default data API base URL.
 */
const DEFAULT_DATA_BASE_URL = 'https://data.alpaca.markets';

/**
 * Create an Equities Market Data client.
 */
export function createEquitiesClient(config: AlpacaConfig): EquitiesClient {
  const baseUrl = config.dataBaseUrl ?? DEFAULT_DATA_BASE_URL;
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
          `Alpaca API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async getBars(
      params: GetStockBarsParams,
      options?: RequestOptions
    ): Promise<StockBarsResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<StockBarsResponse>(
        '/v2/stocks/bars',
        {
          symbols: symbols,
          timeframe: params.timeframe,
          start: params.start,
          end: params.end,
          limit: params.limit,
          page_token: params.pageToken,
          adjustment: params.adjustment,
          feed: params.feed,
          currency: params.currency,
          sort: params.sort,
        },
        options
      );
    },

    async getTrades(
      params: GetStockTradesParams,
      options?: RequestOptions
    ): Promise<StockTradesResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<StockTradesResponse>(
        '/v2/stocks/trades',
        {
          symbols: symbols,
          start: params.start,
          end: params.end,
          limit: params.limit,
          page_token: params.pageToken,
          feed: params.feed,
          currency: params.currency,
          sort: params.sort,
        },
        options
      );
    },

    async getQuotes(
      params: GetStockQuotesParams,
      options?: RequestOptions
    ): Promise<StockQuotesResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<StockQuotesResponse>(
        '/v2/stocks/quotes',
        {
          symbols: symbols,
          start: params.start,
          end: params.end,
          limit: params.limit,
          page_token: params.pageToken,
          feed: params.feed,
          currency: params.currency,
          sort: params.sort,
        },
        options
      );
    },

    async getSnapshots(
      params: GetStockSnapshotsParams,
      options?: RequestOptions
    ): Promise<StockSnapshotsResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<StockSnapshotsResponse>(
        '/v2/stocks/snapshots',
        {
          symbols: symbols,
          feed: params.feed,
          currency: params.currency,
        },
        options
      );
    },

    async getLatestBar(
      symbol: string,
      feed?: DataFeed,
      options?: RequestOptions
    ): Promise<StockBar | null> {
      const response = await request<{ bars: MultiSymbolResponse<StockBar> }>(
        `/v2/stocks/${encodeURIComponent(symbol)}/bars/latest`,
        { feed },
        options
      );
      return response.bars?.[symbol] ?? null;
    },

    async getLatestTrade(
      symbol: string,
      feed?: DataFeed,
      options?: RequestOptions
    ): Promise<StockTrade | null> {
      const response = await request<{
        trades: MultiSymbolResponse<StockTrade>;
      }>(`/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`, { feed }, options);
      return response.trades?.[symbol] ?? null;
    },

    async getLatestQuote(
      symbol: string,
      feed?: DataFeed,
      options?: RequestOptions
    ): Promise<StockQuote | null> {
      const response = await request<{
        quotes: MultiSymbolResponse<StockQuote>;
      }>(`/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`, { feed }, options);
      return response.quotes?.[symbol] ?? null;
    },
  };
}
