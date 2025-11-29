/**
 * Alpaca Markets API - Options Market Data
 *
 * Provides access to options market data including:
 * - Historical and real-time bars (OHLCV)
 * - Quotes (bid/ask)
 * - Trades
 * - Snapshots
 * - Options chain data
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
import { buildQueryString } from './utils';

// ============================================================================
// Options-Specific Types
// ============================================================================

/**
 * Option contract type.
 */
export type OptionType = 'call' | 'put';

/**
 * Option contract style.
 */
export type OptionStyle = 'american' | 'european';

/**
 * Options bar data.
 */
export interface OptionBar extends Bar {
  /** Volume-weighted average price */
  vw?: number;
}

/**
 * Options trade data.
 */
export interface OptionTrade extends Trade {
  /** Exchange code */
  x: string;
}

/**
 * Options quote data.
 */
export interface OptionQuote extends Quote {
  /** Ask exchange code */
  ax: string;
  /** Bid exchange code */
  bx: string;
}

/**
 * Options snapshot with latest data.
 */
export interface OptionSnapshot extends Snapshot {
  latestBar?: OptionBar;
  latestQuote?: OptionQuote;
  latestTrade?: OptionTrade;
}

/**
 * Greeks for an option contract.
 */
export interface OptionGreeks {
  /** Delta - rate of change of option price with respect to underlying */
  delta: number;
  /** Gamma - rate of change of delta */
  gamma: number;
  /** Theta - time decay */
  theta: number;
  /** Vega - sensitivity to volatility */
  vega: number;
  /** Rho - sensitivity to interest rates */
  rho: number;
}

/**
 * Option contract details.
 */
export interface OptionContract {
  /** Option symbol (OCC format) */
  symbol: string;
  /** Underlying stock symbol */
  underlyingSymbol: string;
  /** Option type (call/put) */
  type: OptionType;
  /** Option style (american/european) */
  style: OptionStyle;
  /** Strike price */
  strikePrice: number;
  /** Expiration date (YYYY-MM-DD) */
  expirationDate: string;
  /** Contract size (typically 100) */
  size: number;
  /** Open interest */
  openInterest?: number;
  /** Greeks (if available) */
  greeks?: OptionGreeks;
  /** Implied volatility */
  impliedVolatility?: number;
}

/**
 * Options chain - all contracts for an underlying.
 */
export interface OptionsChain {
  /** Underlying symbol */
  underlyingSymbol: string;
  /** Available expiration dates */
  expirations: string[];
  /** Contracts grouped by expiration and strike */
  contracts: OptionContract[];
}

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Parameters for fetching option bars.
 */
export interface GetOptionBarsParams extends PaginationParams, TimeRangeParams {
  /** Option symbol(s) in OCC format */
  symbols: string | string[];
  /** Bar timeframe */
  timeframe: Timeframe;
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching option trades.
 */
export interface GetOptionTradesParams
  extends PaginationParams,
    TimeRangeParams {
  /** Option symbol(s) in OCC format */
  symbols: string | string[];
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching option quotes.
 */
export interface GetOptionQuotesParams
  extends PaginationParams,
    TimeRangeParams {
  /** Option symbol(s) in OCC format */
  symbols: string | string[];
  /** Sort order */
  sort?: SortOrder;
}

/**
 * Parameters for fetching option snapshots.
 */
export interface GetOptionSnapshotsParams {
  /** Option symbol(s) in OCC format */
  symbols: string | string[];
}

/**
 * Parameters for fetching options chain.
 */
export interface GetOptionsChainParams {
  /** Underlying stock symbol */
  underlyingSymbol: string;
  /** Filter by expiration date (YYYY-MM-DD) */
  expirationDate?: string;
  /** Filter by minimum expiration date */
  expirationDateGte?: string;
  /** Filter by maximum expiration date */
  expirationDateLte?: string;
  /** Filter by option type */
  type?: OptionType;
  /** Filter by minimum strike price */
  strikePriceGte?: number;
  /** Filter by maximum strike price */
  strikePriceLte?: number;
  /** Filter by root symbol */
  rootSymbol?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response for option bars request.
 */
export interface OptionBarsResponse {
  bars: MultiSymbolResponse<OptionBar[]>;
  nextPageToken?: string;
}

/**
 * Response for option trades request.
 */
export interface OptionTradesResponse {
  trades: MultiSymbolResponse<OptionTrade[]>;
  nextPageToken?: string;
}

/**
 * Response for option quotes request.
 */
export interface OptionQuotesResponse {
  quotes: MultiSymbolResponse<OptionQuote[]>;
  nextPageToken?: string;
}

/**
 * Response for option snapshots request.
 */
export interface OptionSnapshotsResponse {
  snapshots: MultiSymbolResponse<OptionSnapshot>;
}

/**
 * Response for options chain request.
 */
export interface OptionsChainResponse {
  /** Option contracts matching the query */
  optionContracts: OptionContract[];
  /** Next page token */
  nextPageToken?: string;
}

// ============================================================================
// Options Client Interface
// ============================================================================

/**
 * Client interface for Alpaca Options Market Data API.
 */
export interface OptionsClient {
  /**
   * Get historical bars for one or more option contracts.
   */
  getBars(
    params: GetOptionBarsParams,
    options?: RequestOptions
  ): Promise<OptionBarsResponse>;

  /**
   * Get historical trades for one or more option contracts.
   */
  getTrades(
    params: GetOptionTradesParams,
    options?: RequestOptions
  ): Promise<OptionTradesResponse>;

  /**
   * Get historical quotes for one or more option contracts.
   */
  getQuotes(
    params: GetOptionQuotesParams,
    options?: RequestOptions
  ): Promise<OptionQuotesResponse>;

  /**
   * Get current snapshots for one or more option contracts.
   */
  getSnapshots(
    params: GetOptionSnapshotsParams,
    options?: RequestOptions
  ): Promise<OptionSnapshotsResponse>;

  /**
   * Get the latest bar for a single option contract.
   */
  getLatestBar(
    symbol: string,
    options?: RequestOptions
  ): Promise<OptionBar | null>;

  /**
   * Get the latest trade for a single option contract.
   */
  getLatestTrade(
    symbol: string,
    options?: RequestOptions
  ): Promise<OptionTrade | null>;

  /**
   * Get the latest quote for a single option contract.
   */
  getLatestQuote(
    symbol: string,
    options?: RequestOptions
  ): Promise<OptionQuote | null>;

  /**
   * Get the options chain for an underlying symbol.
   */
  getOptionsChain(
    params: GetOptionsChainParams,
    options?: RequestOptions
  ): Promise<OptionsChainResponse>;
}

// ============================================================================
// Options Client Implementation
// ============================================================================

/**
 * Default options data API base URL.
 */
const DEFAULT_OPTIONS_BASE_URL = 'https://data.alpaca.markets';

/**
 * Create an Options Market Data client.
 */
export function createOptionsClient(config: AlpacaConfig): OptionsClient {
  const baseUrl = config.dataBaseUrl ?? DEFAULT_OPTIONS_BASE_URL;
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
          `Alpaca Options API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async getBars(
      params: GetOptionBarsParams,
      options?: RequestOptions
    ): Promise<OptionBarsResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<OptionBarsResponse>(
        '/v1beta1/options/bars',
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
      params: GetOptionTradesParams,
      options?: RequestOptions
    ): Promise<OptionTradesResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<OptionTradesResponse>(
        '/v1beta1/options/trades',
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
      params: GetOptionQuotesParams,
      options?: RequestOptions
    ): Promise<OptionQuotesResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<OptionQuotesResponse>(
        '/v1beta1/options/quotes',
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
      params: GetOptionSnapshotsParams,
      options?: RequestOptions
    ): Promise<OptionSnapshotsResponse> {
      const symbols = Array.isArray(params.symbols)
        ? params.symbols
        : [params.symbols];

      return request<OptionSnapshotsResponse>(
        '/v1beta1/options/snapshots',
        {
          symbols: symbols,
        },
        options
      );
    },

    async getLatestBar(
      symbol: string,
      options?: RequestOptions
    ): Promise<OptionBar | null> {
      const response = await request<{ bars: MultiSymbolResponse<OptionBar> }>(
        `/v1beta1/options/bars/latest`,
        { symbols: symbol },
        options
      );
      return response.bars?.[symbol] ?? null;
    },

    async getLatestTrade(
      symbol: string,
      options?: RequestOptions
    ): Promise<OptionTrade | null> {
      const response = await request<{
        trades: MultiSymbolResponse<OptionTrade>;
      }>(`/v1beta1/options/trades/latest`, { symbols: symbol }, options);
      return response.trades?.[symbol] ?? null;
    },

    async getLatestQuote(
      symbol: string,
      options?: RequestOptions
    ): Promise<OptionQuote | null> {
      const response = await request<{
        quotes: MultiSymbolResponse<OptionQuote>;
      }>(`/v1beta1/options/quotes/latest`, { symbols: symbol }, options);
      return response.quotes?.[symbol] ?? null;
    },

    async getOptionsChain(
      params: GetOptionsChainParams,
      options?: RequestOptions
    ): Promise<OptionsChainResponse> {
      return request<OptionsChainResponse>(
        '/v1beta1/options/contracts',
        {
          underlying_symbol: params.underlyingSymbol,
          expiration_date: params.expirationDate,
          expiration_date_gte: params.expirationDateGte,
          expiration_date_lte: params.expirationDateLte,
          type: params.type,
          strike_price_gte: params.strikePriceGte,
          strike_price_lte: params.strikePriceLte,
          root_symbol: params.rootSymbol,
        },
        options
      );
    },
  };
}
