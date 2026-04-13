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

  const [expandedReasoning, setExpandedReasoning] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initialize TradingView Advanced Chart widget
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

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
      if (container) container.innerHTML = '';
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
        if ((res.status === 408 || res.status === 529 || res.status === 503) && retries < 2) {
          setRetryCount(retries + 1);
          setTimeout(() => fetchAnalysis(retries + 1), 3000 * (retries + 1));
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
        setTimeout(() => fetchAnalysis(retries + 1), 3000 * (retries + 1));
        return;
      }
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  // Generate Narrative Sequencer Animations
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length);
      gsap.fromTo(".loading-text", 
        { opacity: 0, y: 5 }, 
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // Stagger GSAP Entry Animations when data arrives
  useEffect(() => {
    if (analysis && !loading && wrapperRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(".gsap-reveal", 
          { y: 20, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out", delay: 0.1 }
        );
      }, wrapperRef);
      return () => ctx.revert();
    }
  }, [analysis, loading]);

  useEffect(() => {
    fetchAnalysis();
  }, [symbol]);

  const isBullish = analysis?.verdict === 'Bullish';
  const isBearish = analysis?.verdict === 'Bearish';
  const formatLatency = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="w-full h-full min-h-[100dvh] relative text-[#fafafa] bg-[#09090b] selection:bg-[#10b981]/30 font-[family-name:var(--font-inter)]" ref={wrapperRef}>
      
      {/* Chart Layer: Fixed Base */}
      <div className="absolute inset-0 md:fixed md:inset-0 md:h-[100vh] h-[50vh] sticky top-0 z-0 border-b border-[#27272a] md:border-none">
        <div ref={chartContainerRef} className="absolute inset-0" />
      </div>

      {/* Floating AI Panel Layer */}
      <aside 
        aria-label="AI Stock Analysis" 
        className="relative z-10 md:absolute md:top-6 md:right-6 w-full md:w-[420px] md:max-h-[calc(100vh-3rem)] bg-[#09090b] md:bg-[#18181b]/65 md:backdrop-blur-2xl md:border md:border-[#27272a] md:rounded-2xl flex flex-col overflow-hidden md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] min-h-[50vh] mt-[50vh] md:mt-0"
      >
        
        {/* HEADER */}
        <header className="p-6 border-b border-[#27272a]/50">
          <h1 className="text-xs uppercase tracking-widest text-[#a1a1aa] mb-2 font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-2">
            {symbol} <ChevronRight size={12} className="opacity-50" /> AI VERDICT
          </h1>
          
          {loading ? (
            <div className="flex flex-col gap-2 mt-4">
              <div className="h-10 w-48 bg-[#27272a]/50 rounded animate-pulse" />
            </div>
          ) : error ? (
            <div className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-[#ef4444] tracking-tight uppercase shadow-[#ef4444]/60 drop-shadow-md">
              Analysis Failed
            </div>
          ) : (
            <div className={`gsap-reveal font-[family-name:var(--font-space-grotesk)] text-5xl font-bold uppercase leading-none tracking-tight ${isBullish ? 'text-[#10b981] drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]' : isBearish ? 'text-[#ef4444] drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-white'}`}>
              {analysis?.verdict}
            </div>
          )}
        </header>

        {/* BODY */}
        <main className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col justify-center items-start h-40">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-4 w-4 rounded-full border-2 border-[#10b981] border-r-transparent animate-spin" />
                <span className="text-[#10b981] font-medium text-sm">Processing Model</span>
                {retryCount > 0 && <span className="text-xs px-2 py-1 bg-[#27272a] rounded text-[#a1a1aa] ml-2">Try {retryCount} of 3</span>}
              </div>
              <p className="loading-text text-lg text-[#fafafa]">
                {loadingMessages[loadingMsgIdx]}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-start pt-2">
              <div className="p-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg w-full mb-6">
                <div className="flex items-center gap-2 text-[#ef4444] mb-2">
                  <AlertCircle size={18} />
                  <span className="font-medium text-sm">System Error</span>
                </div>
                <p className="text-[#a1a1aa] text-sm leading-relaxed mb-4">{error}</p>
              </div>
              <button 
                onClick={() => fetchAnalysis(0)}
                className="w-full min-h-[44px] bg-[#27272a] hover:bg-[#27272a]/80 text-[#fafafa] rounded-lg text-sm transition-colors uppercase tracking-widest font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#10b981]"
              >
                Retry Analysis
              </button>
            </div>
          ) : analysis ? (
            <div className="flex flex-col gap-6 pb-2">
              
              {/* KEY LIMITS GRID */}
              <div className="gsap-reveal grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] uppercase text-[#a1a1aa] mb-1 font-[family-name:var(--font-jetbrains-mono)] tracking-widest">Stop Loss</div>
                  <div className="font-[family-name:var(--font-jetbrains-mono)] text-xl text-[#fafafa]">
                    {analysis.stop_loss_price ? `₹${analysis.stop_loss_price.toFixed(2)}` : 'N/A'}
                  </div>
                </div>
                {(isBullish || analysis.target_price) && (
                  <div className="p-4 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20">
                    <div className="text-[10px] uppercase text-[#10b981] mb-1 font-[family-name:var(--font-jetbrains-mono)] tracking-widest">Target Price</div>
                    <div className="font-[family-name:var(--font-jetbrains-mono)] text-xl text-[#10b981]">
                      {analysis.target_price ? `₹${analysis.target_price.toFixed(2)}` : 'N/A'}
                    </div>
                  </div>
                )}
              </div>

              {/* REASONING */}
              <div className="gsap-reveal pt-2">
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                  <h3 className="text-xs font-[family-name:var(--font-jetbrains-mono)] uppercase text-[#a1a1aa] tracking-widest">AI Reasoning</h3>
                </div>
                <article className={`text-[15px] text-[#a1a1aa] leading-relaxed font-[family-name:var(--font-inter)] relative ${expandedReasoning ? '' : 'max-h-24 overflow-hidden mask-fade-bottom'}`}>
                  {analysis.reasoning}
                  {!expandedReasoning && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#09090b] md:from-[#18181b] to-transparent pointer-events-none" />
                  )}
                </article>
                
                <button 
                  onClick={() => setExpandedReasoning(!expandedReasoning)}
                  className="gsap-reveal w-full min-h-[44px] rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-xs font-[family-name:var(--font-jetbrains-mono)] tracking-widest text-[#fafafa] mt-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#10b981]"
                >
                  {expandedReasoning ? 'COLLAPSE TEXT' : 'READ FULL REPORT'}
                </button>
              </div>

              {/* METADATA DIAGNOSTICS */}
              {metadata && (
                <div className="gsap-reveal mt-2 pt-4 border-t border-white/5 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-between text-[11px] text-[#a1a1aa] font-[family-name:var(--font-jetbrains-mono)]">
                  <span className="flex items-center gap-1"><Cpu size={12} /> {metadata.model}</span>
                  <span className="flex items-center gap-1"><Zap size={12} /> {formatLatency(metadata.latencyMs)}</span>
                  {metadata.promptTokens && <span className="flex items-center gap-1"><Database size={12} /> {metadata.promptTokens}t</span>}
                </div>
              )}

            </div>
          ) : null}
        </main>
      </aside>
    </div>
  );
}
