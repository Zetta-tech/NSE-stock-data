---
name: alert-spec-parser
description: Parse natural-language alert requests from GitHub Issues into structured alert specifications
---

# Alert Spec Parser

## Purpose

When a GitHub Issue with label `agent:create-alert` is opened, extract the alert specification from the issue body and convert it into a structured format for implementation.

## Input Format

The issue body contains a YAML front matter block with the alert request:

```yaml
---
request_text: "Create Alert: notify me when RELIANCE drops 3% in a single day"
request_id: "1709234567890-abc12"
submitted_at: "2024-03-01T10:30:00.000Z"
---
```

## Parsing Steps

1. Extract the YAML front matter from the issue body
2. Get the `request_text` field
3. Strip the "Create Alert:" prefix
4. Identify:
   - **Symbol(s)**: Stock ticker(s) mentioned (e.g. RELIANCE, INFY)
   - **Condition**: What triggers the alert (drop, rise, crosses above/below, volume spike)
   - **Threshold**: Numeric value (percentage, price, multiplier)
   - **Timeframe**: Period for the condition (single day, intraday, week)
   - **Data needed**: Which NSE API methods are required

## Example Parses

| Request | Symbol | Condition | Threshold | Data Needed |
|---------|--------|-----------|-----------|-------------|
| "notify me when RELIANCE drops 3%" | RELIANCE | price_drop_percent | 3% | getEquityDetails (pChange) |
| "alert if TCS volume exceeds 5x average" | TCS | volume_spike | 5x | getEquityTradeInfo + getEquityHistoricalData |
| "tell me when INFY crosses above 1800" | INFY | price_above | 1800 | getEquityDetails (lastPrice) |
| "notify when any Nifty 50 stock drops 5%" | ALL_NIFTY50 | price_drop_percent | 5% | getEquityStockIndices |

## Output

After parsing, decide:
1. Which existing code paths can be reused (scanner.ts, baselines.ts)
2. What new detection logic is needed
3. Which NSE API methods to call (see `docs/api-capability-map.md`)
4. Whether this applies to watchlist stocks, Nifty 50, or specific symbols
