/**
 * Alpaca Markets API - Shared Utilities
 *
 * Common utility functions used across all Alpaca API clients.
 */

/**
 * Build URL query string from parameters object.
 *
 * - Filters out undefined and null values
 * - Joins array values with commas
 * - URL-encodes all values
 *
 * @param params - Key-value pairs to convert to query string
 * @returns URL-encoded query string (without leading '?')
 */
export function buildQueryString(params: Record<string, unknown>): string {
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
 * Create authenticated fetch headers for Alpaca API.
 *
 * @param apiKeyId - API Key ID
 * @param apiSecretKey - API Secret Key
 * @param additionalHeaders - Optional additional headers
 * @returns Headers object for fetch request
 */
export function createAuthHeaders(
  apiKeyId: string,
  apiSecretKey: string,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'APCA-API-KEY-ID': apiKeyId,
    'APCA-API-SECRET-KEY': apiSecretKey,
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
}
