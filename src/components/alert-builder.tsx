"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";

type FeedbackState = { type: "success" | "error"; message: string } | null;

export function AlertBuilder({ onSubmitted }: { onSubmitted?: () => void } = {}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHint) return;
    const handler = (e: MouseEvent) => {
      if (hintRef.current && !hintRef.current.contains(e.target as Node)) {
        setShowHint(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHint]);

  const showFeedback = (type: "success" | "error", message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFeedback({ type, message });
    timerRef.current = setTimeout(() => setFeedback(null), 5000);
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const fullText = `Create Alert: ${trimmed}`;
    if (fullText.length < 15) {
      showFeedback("error", "Please provide a more detailed description.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/alert-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setText("");
      showFeedback("success", "Alert submitted — a GitHub Issue has been created for review.");
      onSubmitted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      showFeedback("error", message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="animate-fade-in relative" ref={hintRef}>
      <div
        className="rounded-[1.8rem] p-[1.5px] shadow-lg shadow-black/30"
        style={{
          background: "linear-gradient(135deg, rgba(0, 230, 138, 0.15), rgba(0, 120, 255, 0.08), rgba(0, 230, 138, 0.05))",
        }}
      >
        <div
          className="rounded-[1.8rem] px-5 py-3.5"
          style={{ background: "var(--surface-raised)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles size={14} style={{ color: "var(--accent)" }} />
              <span
                className="text-xs font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                Create Alert
              </span>
              <button
                onClick={() => setShowHint((v) => !v)}
                className="flex items-center justify-center w-4 h-4 rounded-full opacity-40 hover:opacity-80 transition-opacity"
                style={{ color: "var(--text-muted)" }}
                aria-label="Alert tips"
                tabIndex={-1}
              >
                <Info size={12} />
              </button>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. notify me when RELIANCE drops 3%"
              disabled={loading}
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:opacity-50"
              style={{ color: "var(--text-primary)" }}
            />

            <button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 disabled:opacity-30"
              style={{
                background: text.trim() && !loading ? "var(--accent)" : "var(--surface-overlay)",
                color: text.trim() && !loading ? "var(--surface)" : "var(--text-muted)",
              }}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>

      {showHint && (
        <div
          className="mt-2 px-4 py-3 rounded-2xl text-xs space-y-2 animate-slide-down"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--surface-border)" }}
        >
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Tips for best results</p>
          <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
            <li>• Include the <span className="font-medium" style={{ color: "var(--text-primary)" }}>stock symbol</span> — e.g. RELIANCE, HDFCBANK, NIFTY50</li>
            <li>• Describe the <span className="font-medium" style={{ color: "var(--text-primary)" }}>condition</span> — price breakout, volume spike, % drop, MA cross</li>
            <li>• Add a <span className="font-medium" style={{ color: "var(--text-primary)" }}>threshold</span> where relevant — e.g. "drops 3%", "volume 2× average"</li>
          </ul>
          <div className="pt-1 space-y-0.5" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--surface-border)" }}>
            <p className="font-medium text-[11px] pt-1" style={{ color: "var(--text-secondary)" }}>Examples</p>
            <p className="font-mono text-[10px]">"HDFCBANK breaks 52-week high with volume confirmation"</p>
            <p className="font-mono text-[10px]">"INFY drops more than 4% intraday"</p>
          </div>
          <p className="text-[10px] pt-0.5" style={{ color: "var(--text-muted)" }}>
            Desktop notifications fire automatically for all alerts when the app is open — no need to request them separately.
          </p>
        </div>
      )}

      {feedback && (
        <div
          className="mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-xl animate-slide-down"
          style={{
            background: feedback.type === "success" ? "var(--accent-muted)" : "var(--danger-muted)",
            color: feedback.type === "success" ? "var(--accent)" : "var(--danger)",
          }}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={13} />
          ) : (
            <AlertCircle size={13} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
