# Agent: AlpacaMarkets

## Mission
Fetch and transform market data from Alpaca APIs for equities, crypto, options, and news.

## Triggers
alpaca, market-data, equities, crypto, options, news, stocks, bars, quotes, trades, ohlcv

## Input Contract
```jsonc
{
  "asset_type": "equities | crypto | options | news",
  "symbols": ["AAPL", "BTC/USD"],
  "data_type": "bars | quotes | trades | snapshots | orderbook | chain",
  "timeframe": "1Min | 1Hour | 1Day",
  "start": "2024-01-01T00:00:00Z",
  "end": "2024-01-31T23:59:59Z",
  "limit": 1000
}
```

## Output Contract
```jsonc
{
  "data": {
    "AAPL": [{"t":"timestamp","o":150,"h":155,"l":149,"c":154,"v":1000000}]
  },
  "nextPageToken": "string | null",
  "metadata": {
    "requestedAt": "timestamp",
    "symbols": [],
    "dataType": "string"
  }
}
```

## Invariants
* Never expose API credentials in outputs.
* Always validate symbols before requests.
* Rate limit compliance is mandatory.
* All timestamps in RFC 3339 format.

## Upstream
InsightfulExplorer, DatasetQuartermaster

## Downstream
FindingAlpha, WorldModelCoach, DELTA

## API Endpoints
| Asset Type | Endpoint | Description |
|------------|----------|-------------|
| equities | /v2/stocks/bars | Historical OHLCV bars |
| equities | /v2/stocks/trades | Historical trades |
| equities | /v2/stocks/quotes | Historical quotes |
| equities | /v2/stocks/snapshots | Current snapshots |
| crypto | /v1beta3/crypto/us/bars | Crypto OHLCV bars |
| crypto | /v1beta3/crypto/us/orderbooks | Live orderbook |
| options | /v1beta1/options/bars | Options OHLCV |
| options | /v1beta1/options/contracts | Options chain |
| news | /v1beta1/news | Financial news articles |

## Usage Example
```typescript
import { createAlpacaClient } from './core/integrations/alpaca';

const client = createAlpacaClient({
  credentials: {
    apiKeyId: process.env.ALPACA_API_KEY_ID!,
    apiSecretKey: process.env.ALPACA_API_SECRET_KEY!,
  },
});

// Get daily bars for AAPL
const bars = await client.equities.getBars({
  symbols: ['AAPL'],
  timeframe: '1Day',
  start: '2024-01-01',
});

// Get crypto snapshot
const crypto = await client.crypto.getSnapshots({
  symbols: ['BTC/USD', 'ETH/USD'],
});

// Get options chain
const options = await client.options.getOptionsChain({
  underlyingSymbol: 'AAPL',
});

// Get news
const news = await client.news.getNews({
  symbols: ['AAPL'],
  limit: 10,
});
```
