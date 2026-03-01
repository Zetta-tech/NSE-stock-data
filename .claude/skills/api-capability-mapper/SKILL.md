---
name: api-capability-mapper
description: Map parsed alert specifications to available NSE API methods and existing code paths
---

# API Capability Mapper

## Purpose

Given a parsed alert spec, determine which NSE API methods and existing code paths to use for implementation.

## Available NSE API Methods

The app uses `stock-nse-india` v1.3.0. The NSE client is in `src/lib/nse-client.ts`.

### Already Wrapped (ready to use)

| Wrapper Function | NSE Method | Returns |
|-----------------|------------|---------|
| `getHistoricalData(symbol, days)` | `getEquityHistoricalData` | `DayData[]` — daily OHLCV, sorted by date |
| `getCurrentDayData(symbol)` | `getEquityDetails` + `getEquityTradeInfo` | `{ high, volume, close, change }` or null |
| `getMarketStatus()` | `getMarketStatus` | `boolean` (is Capital Market open?) |
| `getNifty50Index()` | `getEquityStockIndices("NIFTY 50")` | `NiftyIndex` (value, change, %) |
| `getNifty50Snapshot()` | `getEquityStockIndices("NIFTY 50")` | `Nifty50Snapshot` (all 50 stocks) |
| `searchStocks(query)` | `getDataByEndpoint("/api/search/autocomplete")` | `NseSearchResult[]` |

### Available But Not Wrapped (need new wrapper)

| NSE Method | Returns | Use For |
|------------|---------|---------|
| `getEquityIntradayData(symbol)` | Tick-level price data | Intraday price movement alerts |
| `getEquityOptionChain(symbol)` | Options chain | Options activity alerts |
| `getGainersAndLosersByIndex(index)` | Top movers | Market sentiment |
| `getMostActiveEquities()` | Highest volume stocks | Volume-based alerts |
| `getAllStockSymbols()` | All NSE symbols | Symbol validation |

## Mapping Rules

### Price drop/rise percentage
- **Single stock**: Use `getCurrentDayData()` → check `change` field (already a percentage)
- **Nifty 50**: Use `getNifty50Snapshot()` → check `pChange` on each stock
- **Historical**: Use `getHistoricalData()` → compare close prices

### Price crosses threshold
- **Live**: Use `getCurrentDayData()` → check `close` (lastPrice) against threshold
- **Nifty 50**: Use `getNifty50Snapshot()` → check `lastPrice`

### Volume spike
- **Existing**: `analyzeBreakout()` already checks volume >= 3x 5-day avg
- **Custom multiplier**: Reuse `getBaseline()` from baselines.ts, apply custom multiplier

### High/low break
- **Existing**: `analyzeBreakout()` checks high > 5-day max high
- **Custom period**: Modify lookback in `getHistoricalData()` call

## Important Constraints

1. Always check `dataSource` — suppress triggers when `"stale"`
2. Batch API calls using `Promise.allSettled()` with batch size 5
3. Use `withRetry()` pattern for resilience (already in nse-client.ts)
4. Cache results when possible — follow existing TTL patterns
5. Outside extended hours, skip API calls (check `isExtendedHours()`)
