/**
 * Alpaca Markets API - Unit Tests
 *
 * Tests for the Alpaca API client modules.
 * Uses mocked fetch to test client behavior without real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAlpacaClient,
  createAlpacaClientFromEnv,
  type AlpacaConfig,
  type StockBar,
  type StockQuote,
  type StockTrade,
  type CryptoBar,
  type NewsArticle,
} from './index';

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig: AlpacaConfig = {
  credentials: {
    apiKeyId: 'test-api-key',
    apiSecretKey: 'test-secret-key',
  },
  paper: true,
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Client Creation Tests
// ============================================================================

describe('createAlpacaClient', () => {
  it('should create a client with all sub-clients', () => {
    const client = createAlpacaClient(mockConfig);

    expect(client).toBeDefined();
    expect(client.equities).toBeDefined();
    expect(client.crypto).toBeDefined();
    expect(client.options).toBeDefined();
    expect(client.news).toBeDefined();
    expect(client.config).toEqual(mockConfig);
  });

  it('should throw error when credentials are missing', () => {
    expect(() =>
      createAlpacaClient({
        credentials: { apiKeyId: '', apiSecretKey: '' },
      })
    ).toThrow('Alpaca API credentials required');
  });

  it('should throw error when apiKeyId is missing', () => {
    expect(() =>
      createAlpacaClient({
        credentials: { apiKeyId: '', apiSecretKey: 'secret' },
      })
    ).toThrow('Alpaca API credentials required');
  });

  it('should throw error when apiSecretKey is missing', () => {
    expect(() =>
      createAlpacaClient({
        credentials: { apiKeyId: 'key', apiSecretKey: '' },
      })
    ).toThrow('Alpaca API credentials required');
  });
});

describe('createAlpacaClientFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create client from environment variables', () => {
    process.env.ALPACA_API_KEY_ID = 'env-api-key';
    process.env.ALPACA_API_SECRET_KEY = 'env-secret-key';

    const client = createAlpacaClientFromEnv();

    expect(client).toBeDefined();
    expect(client.config.credentials.apiKeyId).toBe('env-api-key');
    expect(client.config.credentials.apiSecretKey).toBe('env-secret-key');
  });

  it('should throw when environment variables are missing', () => {
    delete process.env.ALPACA_API_KEY_ID;
    delete process.env.ALPACA_API_SECRET_KEY;

    expect(() => createAlpacaClientFromEnv()).toThrow(
      'Missing required environment variables'
    );
  });

  it('should default to paper trading', () => {
    process.env.ALPACA_API_KEY_ID = 'env-api-key';
    process.env.ALPACA_API_SECRET_KEY = 'env-secret-key';
    delete process.env.ALPACA_PAPER;

    const client = createAlpacaClientFromEnv();
    expect(client.config.paper).toBe(true);
  });

  it('should respect ALPACA_PAPER=false', () => {
    process.env.ALPACA_API_KEY_ID = 'env-api-key';
    process.env.ALPACA_API_SECRET_KEY = 'env-secret-key';
    process.env.ALPACA_PAPER = 'false';

    const client = createAlpacaClientFromEnv();
    expect(client.config.paper).toBe(false);
  });
});

// ============================================================================
// Equities Client Tests
// ============================================================================

describe('EquitiesClient', () => {
  const client = createAlpacaClient(mockConfig);

  describe('getBars', () => {
    it('should fetch stock bars', async () => {
      const mockBars: Record<string, StockBar[]> = {
        AAPL: [
          { t: '2024-01-01T00:00:00Z', o: 150, h: 155, l: 149, c: 154, v: 1000000, vw: 152.5 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bars: mockBars }),
      });

      const result = await client.equities.getBars({
        symbols: 'AAPL',
        timeframe: '1Day',
        start: '2024-01-01',
      });

      expect(result.bars).toEqual(mockBars);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v2/stocks/bars');
      expect(url).toContain('symbols=AAPL');
      expect(url).toContain('timeframe=1Day');
      expect(options.headers['APCA-API-KEY-ID']).toBe('test-api-key');
      expect(options.headers['APCA-API-SECRET-KEY']).toBe('test-secret-key');
    });

    it('should handle multiple symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bars: {} }),
      });

      await client.equities.getBars({
        symbols: ['AAPL', 'GOOGL'],
        timeframe: '1Hour',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('symbols=AAPL%2CGOOGL');
    });
  });

  describe('getLatestTrade', () => {
    it('should fetch latest trade for a symbol', async () => {
      const mockTrade: StockTrade = {
        t: '2024-01-01T12:00:00Z',
        p: 155.5,
        s: 100,
        x: 'NASDAQ',
        i: 'trade-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ trades: { AAPL: mockTrade } }),
      });

      const result = await client.equities.getLatestTrade('AAPL');

      expect(result).toEqual(mockTrade);
    });

    it('should return null when no trade exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ trades: {} }),
      });

      const result = await client.equities.getLatestTrade('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getLatestQuote', () => {
    it('should fetch latest quote for a symbol', async () => {
      const mockQuote: StockQuote = {
        t: '2024-01-01T12:00:00Z',
        ap: 155.6,
        as: 100,
        bp: 155.4,
        bs: 200,
        ax: 'NASDAQ',
        bx: 'NYSE',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ quotes: { AAPL: mockQuote } }),
      });

      const result = await client.equities.getLatestQuote('AAPL');

      expect(result).toEqual(mockQuote);
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      });

      await expect(
        client.equities.getBars({ symbols: 'AAPL', timeframe: '1Day' })
      ).rejects.toThrow('Alpaca API error: 401 Unauthorized');
    });
  });
});

// ============================================================================
// Crypto Client Tests
// ============================================================================

describe('CryptoClient', () => {
  const client = createAlpacaClient(mockConfig);

  describe('getBars', () => {
    it('should fetch crypto bars', async () => {
      const mockBars: Record<string, CryptoBar[]> = {
        'BTC/USD': [
          { t: '2024-01-01T00:00:00Z', o: 42000, h: 43000, l: 41500, c: 42500, v: 1000, vw: 42250 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bars: mockBars }),
      });

      const result = await client.crypto.getBars({
        symbols: 'BTC/USD',
        timeframe: '1Hour',
      });

      expect(result.bars).toEqual(mockBars);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1beta3/crypto/us/bars');
    });
  });

  describe('getOrderbook', () => {
    it('should fetch orderbook', async () => {
      const mockOrderbook = {
        t: '2024-01-01T12:00:00Z',
        b: [{ p: 42000, s: 1.5 }],
        a: [{ p: 42100, s: 2.0 }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orderbooks: { 'BTC/USD': mockOrderbook } }),
      });

      const result = await client.crypto.getOrderbook({ symbol: 'BTC/USD' });

      expect(result).toEqual(mockOrderbook);
    });

    it('should throw when orderbook not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orderbooks: {} }),
      });

      await expect(
        client.crypto.getOrderbook({ symbol: 'UNKNOWN/USD' })
      ).rejects.toThrow('No orderbook data for symbol: UNKNOWN/USD');
    });
  });
});

// ============================================================================
// Options Client Tests
// ============================================================================

describe('OptionsClient', () => {
  const client = createAlpacaClient(mockConfig);

  describe('getBars', () => {
    it('should fetch option bars', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bars: {} }),
      });

      await client.options.getBars({
        symbols: 'AAPL240119C00150000',
        timeframe: '1Day',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1beta1/options/bars');
    });
  });

  describe('getOptionsChain', () => {
    it('should fetch options chain', async () => {
      const mockContracts = [
        {
          symbol: 'AAPL240119C00150000',
          underlyingSymbol: 'AAPL',
          type: 'call',
          style: 'american',
          strikePrice: 150,
          expirationDate: '2024-01-19',
          size: 100,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ optionContracts: mockContracts }),
      });

      const result = await client.options.getOptionsChain({
        underlyingSymbol: 'AAPL',
      });

      expect(result.optionContracts).toEqual(mockContracts);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1beta1/options/contracts');
      expect(url).toContain('underlying_symbol=AAPL');
    });

    it('should support filtering options chain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ optionContracts: [] }),
      });

      await client.options.getOptionsChain({
        underlyingSymbol: 'AAPL',
        type: 'call',
        strikePriceGte: 140,
        strikePriceLte: 160,
        expirationDateGte: '2024-01-01',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('type=call');
      expect(url).toContain('strike_price_gte=140');
      expect(url).toContain('strike_price_lte=160');
    });
  });
});

// ============================================================================
// News Client Tests
// ============================================================================

describe('NewsClient', () => {
  const client = createAlpacaClient(mockConfig);

  describe('getNews', () => {
    it('should fetch news articles', async () => {
      const mockNews = [
        {
          id: 1,
          headline: 'Apple Announces New Product',
          author: 'John Doe',
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          summary: 'Apple has announced...',
          content: 'Full article content...',
          url: 'https://example.com/article',
          symbols: ['AAPL'],
          source: 'Example News',
          images: [{ size: 'thumb', url: 'https://example.com/thumb.jpg' }],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ news: mockNews }),
      });

      const result = await client.news.getNews({ symbols: 'AAPL' });

      expect(result.news).toHaveLength(1);
      expect(result.news[0].headline).toBe('Apple Announces New Product');
      expect(result.news[0].createdAt).toBe('2024-01-01T12:00:00Z');
    });

    it('should handle pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          news: [],
          next_page_token: 'token123',
        }),
      });

      const result = await client.news.getNews({ limit: 10 });

      expect(result.nextPageToken).toBe('token123');
    });
  });

  describe('getLatestNews', () => {
    it('should fetch latest news for a symbol', async () => {
      const mockNews = [
        {
          id: 1,
          headline: 'Latest AAPL News',
          author: 'Jane Doe',
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          summary: 'Summary',
          content: 'Content',
          url: 'https://example.com',
          symbols: ['AAPL'],
          source: 'News Source',
          images: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ news: mockNews }),
      });

      const result = await client.news.getLatestNews('AAPL');

      expect(result).not.toBeNull();
      expect(result?.headline).toBe('Latest AAPL News');
    });

    it('should return null when no news exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ news: [] }),
      });

      const result = await client.news.getLatestNews('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getNewsForSymbols', () => {
    it('should fetch news for multiple symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ news: [] }),
      });

      await client.news.getNewsForSymbols(['AAPL', 'GOOGL'], { limit: 20 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('symbols=AAPL%2CGOOGL');
      expect(url).toContain('limit=20');
    });
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('Type definitions', () => {
  it('should have correct Bar type structure', () => {
    const bar: StockBar = {
      t: '2024-01-01T00:00:00Z',
      o: 100,
      h: 110,
      l: 95,
      c: 105,
      v: 1000000,
      vw: 102.5,
    };

    expect(bar.t).toBeDefined();
    expect(bar.o).toBeDefined();
    expect(bar.h).toBeDefined();
    expect(bar.l).toBeDefined();
    expect(bar.c).toBeDefined();
    expect(bar.v).toBeDefined();
    expect(bar.vw).toBeDefined();
  });

  it('should have correct NewsArticle type structure', () => {
    const article: NewsArticle = {
      id: 1,
      headline: 'Test',
      author: 'Author',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      summary: 'Summary',
      content: 'Content',
      url: 'https://example.com',
      symbols: ['AAPL'],
      source: 'Source',
      images: [],
    };

    expect(article.id).toBeDefined();
    expect(article.headline).toBeDefined();
    expect(article.createdAt).toBeDefined();
  });
});
