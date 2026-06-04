# NSE API Capability Map

Data source: `stock-nse-india` v1.4.0 (NPM package wrapping NSE India's unofficial API; requires Node.js 20+).

## Currently Used Methods

| Method | Returns | Used In | Purpose |
|--------|---------|---------|---------|
| `getEquityHistoricalData(symbol, { start, end })` | Array of `{ data: [{ mtimestamp, chTradeHighPrice, chTradeLowPrice, chOpeningPrice, chClosingPrice, chTotTradedQty }] }` | `nse-client.ts` → `getHistoricalData()` | Daily OHLCV for baseline computation + breakout analysis |
| `getEquityDetails(symbol)` | `{ priceInfo: { lastPrice, intraDayHighLow: { max }, pChange, close } }` | `nse-client.ts` → `getCurrentDayData()` | Live intraday high, price, change |
| `getEquityTradeInfo(symbol)` | `{ marketDeptOrderBook: { tradeInfo: { totalTradedVolume } } }` | `nse-client.ts` → `getCurrentDayData()` | Live intraday volume |
| `getEquityStockIndices("NIFTY 50")` | `{ metadata: { last, change, percChange, ... }, data: [{ symbol, lastPrice, change, pChange, dayHigh, totalTradedVolume, ... }] }` | `nse-client.ts` → `getNifty50Index()`, `getNifty50Snapshot()` | Index value + all 50 constituent stocks in one call |
| `getMarketStatus()` | `{ marketState: [{ market, marketStatus }] }` | `nse-client.ts` → `getMarketStatus()` | Determine if Capital Market is open/closed |
| `getDataByEndpoint("/api/search/autocomplete?q=...")` | `{ symbols: [{ symbol, symbol_info, result_type }] }` | `nse-client.ts` → `searchStocks()` | Stock symbol search |

## Available But Not Currently Used

These methods are available in the `stock-nse-india` package and could be used for new alert types:

| Method | Returns | Potential Use |
|--------|---------|---------------|
| `getEquityIntradayData(symbol)` | Tick-level intraday price data | Price movement alerts (e.g. "dropped X% today") |
| `getEquityOptionChain(symbol)` | Options chain data (calls/puts, OI, strike prices) | Options activity alerts |
| `getGainersAndLosersByIndex(index)` | Top gainers/losers for an index | Market sentiment alerts |
| `getMostActiveEquities()` | Most actively traded stocks by volume | Unusual volume alerts |
| `getAllStockSymbols()` | Complete list of NSE-listed symbols | Symbol validation |

## Rate Limiting & Session Handling

- The `NseIndia` class manages cookies/sessions internally
- On API failure, `withRetry()` resets the singleton (clears stale cookies) and retries once
- Outside extended hours (before 09:00 or after 16:00 IST), most API calls are skipped
- Batch operations use `Promise.allSettled()` with batch size 5 to avoid overwhelming NSE

## Data Freshness

| Time Period | Data Available | Strategy |
|-------------|---------------|----------|
| 09:15–15:30 IST (market hours) | Live intraday | Use `getEquityDetails` + `getEquityTradeInfo` |
| 09:00–16:00 IST (extended) | Live + closing session | API calls allowed, stale-aware |
| 16:00–09:00 IST (after hours) | Previous day close | Serve cached data, skip API calls |
| Weekends | Last Friday close | Serve cached data, skip API calls |
