import "server-only";
import { DayData } from "./types";

export function generateSemanticPrompt(data: DayData[]): string {
  if (!data || data.length === 0) {
    throw new Error('No DayData provided');
  }

  // Extract summary stats
  const recentDays = data.slice(-10); // Look at last 10 days
  const currentPrice = data[data.length - 1].close;
  const recentHigh = Math.max(...recentDays.map((d) => d.high));
  const recentLow = Math.min(...recentDays.map((d) => d.low));

  let rawDataStr = "Date | Open | High | Low | Close | Volume\n";
  rawDataStr += "--------------------------------------------\n";
  data.slice(-30).forEach((d) => { // Send last 30 days of data to save tokens
    rawDataStr += `${d.date} | ${d.open} | ${d.high} | ${d.low} | ${d.close} | ${d.volume}\n`;
  });

  return `
You are an expert stock market technical analyst specializing in the "Science of Stock Price Action".
Analyze the provided daily price data for a typical "Volatility Compression Pattern" (VCP) or related setup.

Current Price: ${currentPrice}
10-Day High: ${recentHigh}
10-Day Low: ${recentLow}

Here is the OHLCV data for the last 30 trading days:
${rawDataStr}

INSTRUCTIONS:
Determine if the recent action indicates a high probability buy setup based on volatility compression and volume drying up followed by a breakout.

Provide your output EXACTLY as a JSON object matching this schema:
{
  "verdict": "Bullish" | "Bearish" | "Neutral",
  "stop_loss_price": <number or null>,
  "reasoning": "<Concise paragraph explaining your technical read>"
}

Do not include any other text, markdown formatting, or trailing commas. Output the pure JSON payload ONLY.
  `.trim();
}
