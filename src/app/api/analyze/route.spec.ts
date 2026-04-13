import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import * as nseClient from "@/lib/nse-client";
import { NextRequest } from "next/server";

// Mock the dependencies
vi.mock("@/lib/nse-client", () => ({
  getHistoricalData: vi.fn(),
}));

describe("POST /api/analyze", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "test-key" };
  });

  function createMockRequest(body: any): NextRequest {
    return new NextRequest("http://localhost:3000/api/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("should return 400 if symbol is missing", async () => {
    const req = createMockRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request body");
  });

  it("should return 400 if less than 15 days of data is returned", async () => {
    vi.mocked(nseClient.getHistoricalData).mockResolvedValue(
      Array(14).fill({ date: "2023-01-01", open: 100, high: 105, low: 95, close: 102, volume: 10000 })
    );

    const req = createMockRequest({ symbol: "RELIANCE" });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Not enough trading history");
  });

  it("should return 503 if no LLM API keys are configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    vi.mocked(nseClient.getHistoricalData).mockResolvedValue(
      Array(20).fill({ date: "2023-01-01", open: 100, high: 105, low: 95, close: 102, volume: 10000 })
    );

    const req = createMockRequest({ symbol: "RELIANCE" });
    const res = await POST(req);
    
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("All LLM providers failed. Try again shortly.");
  });

  it("should return 200 with analysis and metadata on happy path (Anthropic)", async () => {
    vi.mocked(nseClient.getHistoricalData).mockResolvedValue(
      Array(20).fill({ date: "2023-01-01", open: 100, high: 105, low: 95, close: 102, volume: 10000 })
    );

    const mockAnthropicResponse = {
      model: "claude-4-sonnet-20250514",
      content: [{ text: '```json\n{"verdict": "Bullish", "stop_loss_price": 95, "reasoning": "Looks good"}\n```' }],
      usage: { input_tokens: 300, output_tokens: 50 }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnthropicResponse),
    } as any);

    const req = createMockRequest({ symbol: "RELIANCE" });
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.analysis.verdict).toBe("Bullish");
    expect(json.analysis.stop_loss_price).toBe(95);
    expect(json.metadata.provider).toBe("anthropic");
    expect(json.metadata.model).toBe("claude-4-sonnet-20250514");
    expect(json.metadata.promptTokens).toBe(300);
    expect(json.metadata.completionTokens).toBe(50);
    expect(json.metadata.totalTokens).toBe(350);
    expect(json.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should fall back to OpenAI when Anthropic fails", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    
    vi.mocked(nseClient.getHistoricalData).mockResolvedValue(
      Array(20).fill({ date: "2023-01-01", open: 100, high: 105, low: 95, close: 102, volume: 10000 })
    );

    const mockOpenAIResponse = {
      model: "gpt-4o",
      choices: [{ message: { content: '{"verdict": "Neutral", "stop_loss_price": 90, "reasoning": "Mixed signals"}' } }],
      usage: { prompt_tokens: 280, completion_tokens: 45, total_tokens: 325 }
    };

    // First call (Anthropic) fails, second call (OpenAI) succeeds
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("Internal Error") } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockOpenAIResponse) } as any);

    const req = createMockRequest({ symbol: "RELIANCE" });
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.analysis.verdict).toBe("Neutral");
    expect(json.analysis.reasoning).toBe("Mixed signals");
    expect(json.metadata.provider).toBe("openai");
    expect(json.metadata.model).toBe("gpt-4o");
    expect(json.metadata.promptTokens).toBe(280);
    expect(json.metadata.completionTokens).toBe(45);
    expect(json.metadata.totalTokens).toBe(325);
    expect(json.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should return 408 if AbortError occurs (timeout)", async () => {
    vi.mocked(nseClient.getHistoricalData).mockResolvedValue(
      Array(20).fill({ date: "2023-01-01", open: 100, high: 105, low: 95, close: 102, volume: 10000 })
    );

    const abortError = new Error("AbortError");
    abortError.name = "AbortError";

    global.fetch = vi.fn().mockRejectedValue(abortError);

    const req = createMockRequest({ symbol: "RELIANCE" });
    const res = await POST(req);
    
    expect(res.status).toBe(408);
    const json = await res.json();
    expect(json.error).toBe("Analysis timed out");
  });
});
