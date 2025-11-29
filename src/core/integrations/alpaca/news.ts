/**
 * Alpaca Markets API - News Data
 *
 * Provides access to financial news including:
 * - Real-time news articles
 * - Historical news search
 * - News filtering by symbols, sources, and dates
 */

import type {
  AlpacaConfig,
  SortOrder,
  PaginationParams,
  TimeRangeParams,
  RequestOptions,
} from './types';

// ============================================================================
// News-Specific Types
// ============================================================================

/**
 * News article sentiment.
 */
export type NewsSentiment = 'positive' | 'negative' | 'neutral';

/**
 * News article image.
 */
export interface NewsImage {
  /** Image size variant */
  size: 'thumb' | 'small' | 'large';
  /** Image URL */
  url: string;
}

/**
 * News article data.
 */
export interface NewsArticle {
  /** Article ID */
  id: number;
  /** Article headline */
  headline: string;
  /** Article author */
  author: string;
  /** Article creation timestamp (RFC 3339) */
  createdAt: string;
  /** Article update timestamp (RFC 3339) */
  updatedAt: string;
  /** Article summary */
  summary: string;
  /** Article content (may be truncated) */
  content: string;
  /** Article URL */
  url: string;
  /** Associated symbols */
  symbols: string[];
  /** News source */
  source: string;
  /** Article images */
  images: NewsImage[];
}

/**
 * News article with sentiment analysis.
 */
export interface NewsArticleWithSentiment extends NewsArticle {
  /** Overall sentiment */
  sentiment?: NewsSentiment;
  /** Sentiment score (-1 to 1) */
  sentimentScore?: number;
  /** Per-symbol sentiment */
  symbolSentiments?: {
    symbol: string;
    sentiment: NewsSentiment;
    score: number;
  }[];
}

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Parameters for fetching news articles.
 */
export interface GetNewsParams extends PaginationParams, TimeRangeParams {
  /** Filter by stock symbol(s) */
  symbols?: string | string[];
  /** Sort order */
  sort?: SortOrder;
  /** Include content in response */
  includeContent?: boolean;
  /** Exclude articles without content */
  excludeContentless?: boolean;
}

/**
 * Parameters for searching news.
 */
export interface SearchNewsParams extends PaginationParams, TimeRangeParams {
  /** Search query */
  query: string;
  /** Filter by stock symbol(s) */
  symbols?: string | string[];
  /** Sort order */
  sort?: SortOrder;
  /** Include content in response */
  includeContent?: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response for news request.
 */
export interface NewsResponse {
  /** News articles */
  news: NewsArticle[];
  /** Next page token */
  nextPageToken?: string;
}

// ============================================================================
// News Client Interface
// ============================================================================

/**
 * Client interface for Alpaca News API.
 */
export interface NewsClient {
  /**
   * Get news articles, optionally filtered by symbols and time range.
   */
  getNews(
    params?: GetNewsParams,
    options?: RequestOptions
  ): Promise<NewsResponse>;

  /**
   * Get the latest news article for a symbol.
   */
  getLatestNews(
    symbol: string,
    options?: RequestOptions
  ): Promise<NewsArticle | null>;

  /**
   * Get news articles for multiple symbols.
   */
  getNewsForSymbols(
    symbols: string[],
    params?: Omit<GetNewsParams, 'symbols'>,
    options?: RequestOptions
  ): Promise<NewsResponse>;
}

// ============================================================================
// News Client Implementation
// ============================================================================

/**
 * Default news data API base URL.
 */
const DEFAULT_NEWS_BASE_URL = 'https://data.alpaca.markets';

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
 * Transform snake_case API response to camelCase.
 */
function transformNewsArticle(article: Record<string, unknown>): NewsArticle {
  return {
    id: article.id as number,
    headline: article.headline as string,
    author: article.author as string,
    createdAt: article.created_at as string,
    updatedAt: article.updated_at as string,
    summary: article.summary as string,
    content: (article.content as string) ?? '',
    url: article.url as string,
    symbols: (article.symbols as string[]) ?? [],
    source: article.source as string,
    images: ((article.images as NewsImage[]) ?? []).map((img) => ({
      size: img.size,
      url: img.url,
    })),
  };
}

/**
 * Create a News client.
 */
export function createNewsClient(config: AlpacaConfig): NewsClient {
  const baseUrl = config.dataBaseUrl ?? DEFAULT_NEWS_BASE_URL;
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
          `Alpaca News API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async getNews(
      params?: GetNewsParams,
      options?: RequestOptions
    ): Promise<NewsResponse> {
      const symbols = params?.symbols
        ? Array.isArray(params.symbols)
          ? params.symbols
          : [params.symbols]
        : undefined;

      const response = await request<{
        news: Record<string, unknown>[];
        next_page_token?: string;
      }>(
        '/v1beta1/news',
        {
          symbols: symbols,
          start: params?.start,
          end: params?.end,
          limit: params?.limit,
          page_token: params?.pageToken,
          sort: params?.sort,
          include_content: params?.includeContent,
          exclude_contentless: params?.excludeContentless,
        },
        options
      );

      return {
        news: response.news.map(transformNewsArticle),
        nextPageToken: response.next_page_token,
      };
    },

    async getLatestNews(
      symbol: string,
      options?: RequestOptions
    ): Promise<NewsArticle | null> {
      const response = await this.getNews(
        {
          symbols: [symbol],
          limit: 1,
          sort: 'desc',
        },
        options
      );
      return response.news[0] ?? null;
    },

    async getNewsForSymbols(
      symbols: string[],
      params?: Omit<GetNewsParams, 'symbols'>,
      options?: RequestOptions
    ): Promise<NewsResponse> {
      return this.getNews(
        {
          ...params,
          symbols,
        },
        options
      );
    },
  };
}
