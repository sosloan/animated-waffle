/**
 * Alpaca Markets API Client
 *
 * Unified client for accessing Alpaca's market data APIs:
 * - Equities (stocks) - historical and real-time stock market data
 * - Crypto - cryptocurrency market data
 * - Options - options market data and chains
 * - News - financial news articles
 *
 * @example
 * ```typescript
 * import { createAlpacaClient } from './core/integrations/alpaca';
 *
 * const client = createAlpacaClient({
 *   credentials: {
 *     apiKeyId: process.env.ALPACA_API_KEY_ID!,
 *     apiSecretKey: process.env.ALPACA_API_SECRET_KEY!,
 *   },
 *   paper: true, // Use paper trading endpoint
 * });
 *
 * // Get stock bars
 * const bars = await client.equities.getBars({
 *   symbols: ['AAPL', 'GOOGL'],
 *   timeframe: '1Day',
 *   start: '2024-01-01',
 * });
 *
 * // Get crypto snapshot
 * const crypto = await client.crypto.getSnapshots({
 *   symbols: ['BTC/USD', 'ETH/USD'],
 * });
 *
 * // Get options chain
 * const options = await client.options.getOptionsChain({
 *   underlyingSymbol: 'AAPL',
 *   expirationDateGte: '2024-12-01',
 * });
 *
 * // Get news
 * const news = await client.news.getNews({
 *   symbols: ['AAPL'],
 *   limit: 10,
 * });
 * ```
 */

// Re-export all types
export * from './types';
export * from './equities';
export * from './crypto';
export * from './options';
export * from './news';
export * from './utils';

// Import client creators
import type { AlpacaConfig } from './types';
import { createEquitiesClient, type EquitiesClient } from './equities';
import { createCryptoClient, type CryptoClient } from './crypto';
import { createOptionsClient, type OptionsClient } from './options';
import { createNewsClient, type NewsClient } from './news';

// ============================================================================
// Unified Client
// ============================================================================

/**
 * Unified Alpaca API client with access to all market data endpoints.
 */
export interface AlpacaClient {
  /** Equities (stocks) market data client */
  equities: EquitiesClient;
  /** Crypto market data client */
  crypto: CryptoClient;
  /** Options market data client */
  options: OptionsClient;
  /** News data client */
  news: NewsClient;
  /** Original configuration */
  config: AlpacaConfig;
}

/**
 * Create a unified Alpaca API client.
 *
 * @param config - API configuration including credentials
 * @returns Unified client with access to all market data endpoints
 *
 * @example
 * ```typescript
 * const client = createAlpacaClient({
 *   credentials: {
 *     apiKeyId: 'your-api-key',
 *     apiSecretKey: 'your-secret-key',
 *   },
 * });
 *
 * // Access different market data
 * const stockBars = await client.equities.getBars({...});
 * const cryptoQuotes = await client.crypto.getQuotes({...});
 * const optionChain = await client.options.getOptionsChain({...});
 * const newsArticles = await client.news.getNews({...});
 * ```
 */
export function createAlpacaClient(config: AlpacaConfig): AlpacaClient {
  // Validate required configuration
  if (!config.credentials?.apiKeyId || !config.credentials?.apiSecretKey) {
    throw new Error(
      'Alpaca API credentials required: apiKeyId and apiSecretKey must be provided'
    );
  }

  // Create individual clients with shared config
  const equities = createEquitiesClient(config);
  const crypto = createCryptoClient(config);
  const options = createOptionsClient(config);
  const news = createNewsClient(config);

  return {
    equities,
    crypto,
    options,
    news,
    config,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create an Alpaca client from environment variables.
 *
 * Reads configuration from:
 * - ALPACA_API_KEY_ID
 * - ALPACA_API_SECRET_KEY
 * - ALPACA_PAPER (optional, defaults to 'true')
 *
 * @returns Alpaca client configured from environment
 * @throws Error if required environment variables are missing
 */
export function createAlpacaClientFromEnv(): AlpacaClient {
  const apiKeyId = process.env.ALPACA_API_KEY_ID;
  const apiSecretKey = process.env.ALPACA_API_SECRET_KEY;
  const paper = process.env.ALPACA_PAPER !== 'false';

  if (!apiKeyId || !apiSecretKey) {
    throw new Error(
      'Missing required environment variables: ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY'
    );
  }

  return createAlpacaClient({
    credentials: { apiKeyId, apiSecretKey },
    paper,
  });
}

/**
 * Validate Alpaca API credentials by making a simple request.
 *
 * @param config - API configuration to validate
 * @returns true if credentials are valid
 * @throws Error if credentials are invalid or request fails
 */
export async function validateCredentials(
  config: AlpacaConfig
): Promise<boolean> {
  const client = createAlpacaClient(config);

  try {
    // Try to get a simple snapshot - this will validate credentials
    await client.equities.getLatestTrade('AAPL');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('401') || message.includes('403')) {
      throw new Error('Invalid Alpaca API credentials');
    }
    throw error;
  }
}
