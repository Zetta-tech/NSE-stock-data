import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHistoricalData } from "@/lib/nse-client";
import { generateSemanticPrompt } from "@/lib/semantic-translator";
import { AIMetadata } from "@/lib/types";

export const maxDuration = 60; // 60 seconds maximum duration
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
});

/** Extract JSON from LLM text response (handles markdown fences) */
function extractJSON(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse JSON from LLM response");
  return JSON.parse(match[0]);
}

/** LLM call result with parsed payload and provider metadata */
interface LLMResult {
  payload: Record<string, unknown>;
  metadata: Omit<AIMetadata, 'latencyMs'>;
}

/** Call Anthropic with exponential backoff on 429/529 */
async function callAnthropic(prompt: string, signal: AbortSignal): Promise<LLMResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const MAX_RETRIES = 3;
  const BACKOFF_BASE_MS = 2000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-4-sonnet-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });

    if ((response.status === 529 || response.status === 429) && attempt < MAX_RETRIES - 1) {
      const delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.warn(`Anthropic ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API Error:", response.status, errorText);
      return null; // Signal failure so we can fall through to OpenAI
    }

    const raw = await response.json();
    const inputTokens = raw.usage?.input_tokens ?? null;
    const outputTokens = raw.usage?.output_tokens ?? null;

    return {
      payload: extractJSON(raw.content[0].text),
      metadata: {
        provider: 'anthropic',
        model: raw.model ?? 'unknown',
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens != null && outputTokens != null
          ? inputTokens + outputTokens
          : null,
      },
    };
  }

  console.warn("Anthropic exhausted all retries");
  return null;
}

/** Call OpenAI as fallback provider */
async function callOpenAI(prompt: string, signal: AbortSignal): Promise<LLMResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OpenAI fallback skipped: OPENAI_API_KEY not configured");
    return null;
  }

  console.info("Falling back to OpenAI...");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API Error:", response.status, errorText);
    return null;
  }

  const raw = await response.json();
  return {
    payload: extractJSON(raw.choices[0].message.content),
    metadata: {
      provider: 'openai',
      model: raw.model ?? 'unknown',
      promptTokens: raw.usage?.prompt_tokens ?? null,
      completionTokens: raw.usage?.completion_tokens ?? null,
      totalTokens: raw.usage?.total_tokens ?? null,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = RequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 }
      );
    }

    const { symbol } = result.data;

    // Fetch up to 30 days of data
    let chartData;
    try {
      chartData = await getHistoricalData(symbol, 30);
    } catch (error) {
      console.error(`Failed to fetch historical data for ${symbol}:`, error);
      return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 });
    }

    // Enforce 15-day minimum threshold
    if (!chartData || chartData.length < 15) {
      return NextResponse.json({ error: "Not enough trading history" }, { status: 400 });
    }

    const prompt = generateSemanticPrompt(chartData);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const startMs = Date.now();

    try {
      // Primary: Anthropic (with backoff)
      let llmResult = await callAnthropic(prompt, controller.signal);

      // Fallback: OpenAI (if Anthropic failed)
      if (!llmResult) {
        llmResult = await callOpenAI(prompt, controller.signal);
      }

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startMs;

      if (!llmResult) {
        return NextResponse.json(
          { error: "All LLM providers failed. Try again shortly." },
          { status: 503 }
        );
      }

      const metadata: AIMetadata = {
        ...llmResult.metadata,
        latencyMs,
      };

      return NextResponse.json({ analysis: llmResult.payload, metadata, chartData });
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        return NextResponse.json({ error: "Analysis timed out" }, { status: 408 });
      }
      console.error("Analysis Pipeline Error:", error);
      return NextResponse.json({ error: "Unexpected error during analysis" }, { status: 500 });
    }
  } catch (err) {
    console.error("API Analyze Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
