"use client";

import { useEffect, useRef, useState } from "react";
import { SemanticAnalysisResult, AIMetadata } from "@/lib/types";
import { AlertCircle, Activity, ChevronRight, BarChart2, Cpu, Zap, Database } from "lucide-react";
import gsap from "gsap";

export function AnalyzeView({ 
  symbol 
}: { 
  symbol: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const [analysis, setAnalysis] = useState<SemanticAnalysisResult | null>(null);
  const [metadata, setMetadata] = useState<AIMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const loadingMessages = [
    "Evaluating Technical Action...",
    "Reviewing 30-day price action...",
    "Applying VCP heuristics...",
    "Calculating risk/reward ratios...",
    "Finalizing technical verdict..."
  ];

  // Initialize TradingView Advanced Chart widget
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Clear any existing widget (React StrictMode / hot reload safety)
    container.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = 'calc(100% - 32px)';
    widgetInner.style.width = '100%';
    widgetContainer.appendChild(widgetInner);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.textContent = JSON.stringify({
      symbol: `NSE:${symbol}`,
      width: "100%",
      height: "100%",
      autosize: true,
      theme: "dark",
      style: "1",
      timezone: "Asia/Kolkata",
      allow_symbol_change: true,
      backgroundColor: "rgba(0,0,0,0)",
      gridColor: "rgba(255, 255, 255, 0.05)",
      hide_side_toolbar: false,
      studies: [],
      support_host: "https://www.tradingview.com"
    });

    widgetContainer.appendChild(script);
    container.appendChild(widgetContainer);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol]);

  // Perform Analysis Fetch
  const fetchAnalysis = async (retries = 0) => {
    setLoading(true);
    setError(null);
    setLoadingMsgIdx(0);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });

      const data = await res.json();

      if (!res.ok) {
        // Retry on timeout (408) or overload (529/503) — server already retried with backoff
        if ((res.status === 408 || res.status === 529 || res.status === 503) && retries < 2) {
          setRetryCount(retries + 1);
          const delay = 3000 * (retries + 1); // 3s, 6s
          setTimeout(() => fetchAnalysis(retries + 1), delay);
          return;
        }
        
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysis(data.analysis);
      setMetadata(data.metadata ?? null);
      setLoading(false);
    } catch (err: any) {
      if (retries < 2) {
        setRetryCount(retries + 1);
        const delay = 3000 * (retries + 1);
        setTimeout(() => fetchAnalysis(retries + 1), delay);
        return;
      }
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  // On Mount Cycle loading text
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length);
        
        // Slight pulse animation on text change
        gsap.fromTo(".loading-text", 
          { opacity: 0, y: 5 }, 
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
        );
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Initial fetch trigger
  useEffect(() => {
    fetchAnalysis();
  }, [symbol]);


  const getVerdictStyle = (verdict?: string) => {
    if (verdict === 'Bullish') return "bg-green-500/10 text-green-500 border-green-500/20";
    if (verdict === 'Bearish') return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  /** Format latency for display */
  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex flex-col md:flex-row w-full h-full md:h-[100dvh]">
      
      {/* 70% Chart Area */}
      <div className="w-full md:w-[70%] h-[50vh] md:h-full relative border-b md:border-b-0 md:border-r border-surface-border">
        <div ref={chartContainerRef} className="absolute inset-0" />
      </div>

      {/* 30% Fact Sheet Area */}
      <div className="w-full md:w-[30%] h-[50vh] md:h-full bg-surface-background p-6 md:p-8 flex flex-col relative overflow-y-auto">
        
        <h1 className="text-2xl font-bold tracking-tight mb-2 uppercase text-surface-text">{symbol}</h1>
        <p className="text-surface-text-secondary mb-8 text-sm flex items-center gap-2">
          AI Technical Evaluation <ChevronRight size={14} />
        </p>
        
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col justify-center items-start">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-4 w-4 rounded-full border-2 border-accent border-r-transparent animate-spin" />
                <span className="text-accent font-medium text-sm">Processing</span>
                {retryCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-surface-border rounded text-surface-text-secondary ml-2">
                    Try {retryCount} of 3
                  </span>
                )}
              </div>
              <p className="loading-text text-xl font-medium text-surface-text">
                {loadingMessages[loadingMsgIdx]}
              </p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col justify-center items-start">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-full">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <AlertCircle size={18} />
                  <span className="font-medium">Analysis Failed</span>
                </div>
                <p className="text-surface-text-secondary text-sm leading-relaxed mb-4">
                  {error}
                </p>
                <button 
                  onClick={() => fetchAnalysis(0)}
                  className="px-4 py-2 bg-surface-border hover:bg-surface-border/80 text-surface-text rounded-md text-sm transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : analysis ? (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
              
              {/* 1. Primary Focal Point: Verdict Badge */}
              <div className="mb-6">
                <h2 className="text-sm text-surface-text-secondary uppercase tracking-widest font-semibold mb-3">Verdict</h2>
                <div className={`inline-flex items-center px-4 py-2 rounded-md border text-lg font-bold tracking-wide ${getVerdictStyle(analysis.verdict)}`}>
                  <Activity size={18} className="mr-2" />
                  {analysis.verdict}
                </div>
              </div>

              {/* 2. Secondary Focal Point: Stop Loss */}
              <div className="mb-8">
                <h2 className="text-sm text-surface-text-secondary uppercase tracking-widest font-semibold mb-2">Recommended Invalid Level</h2>
                <div className="text-3xl font-bold font-mono tracking-tight text-surface-text">
                  {analysis.stop_loss_price ? `₹${analysis.stop_loss_price.toFixed(2)}` : 'N/A'}
                </div>
                <p className="text-xs text-surface-text-secondary mt-1">If price falls below this, the technical setup is aborted.</p>
              </div>

              {/* 3. Tertiary Focal Point: Reasoning */}
              <div className="flex-1">
                <h2 className="text-sm text-surface-text-secondary uppercase tracking-widest font-semibold mb-3">Technical Reasoning</h2>
                <p className="text-surface-text-secondary leading-relaxed text-[15px]">
                  {analysis.reasoning}
                </p>
              </div>

              {/* 4. Model Diagnostics Footer */}
              {metadata && (
                <div 
                  className="mt-6 pt-4 border-t border-surface-border animate-fade-in opacity-60 hover:opacity-100 transition-opacity duration-200"
                  style={{ animationDelay: '300ms' }}
                >
                  <div className="flex items-center gap-4 text-xs text-surface-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <Cpu size={12} />
                      <span>{metadata.model}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Zap size={12} />
                      <span className="font-mono">{formatLatency(metadata.latencyMs)}</span>
                    </span>
                    {metadata.promptTokens != null && metadata.completionTokens != null && (
                      <span className="flex items-center gap-1.5">
                        <Database size={12} />
                        <span className="font-mono">{metadata.promptTokens}/{metadata.completionTokens}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}
