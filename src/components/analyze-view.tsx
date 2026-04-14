"use client";

import { useEffect, useRef, useState } from "react";
import { SemanticAnalysisResult, AIMetadata, DayData } from "@/lib/types";
import { AlertCircle, Activity, ChevronRight, BarChart2, Cpu, Zap, Database, Minimize2, Maximize2, GripHorizontal } from "lucide-react";
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
  
  // Draggable & Minimized State
  const [isMinimized, setIsMinimized] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow drag on desktop
    if (window.innerWidth < 768) return; 
    
    // Ignore clicks on buttons inside header
    if ((e.target as HTMLElement).closest('button')) return;
    
    isDragging.current = true;
    dragStartPos.current = { 
      x: e.clientX - dragPos.current.x, 
      y: e.clientY - dragPos.current.y 
    };
    
    const headerEl = e.currentTarget as HTMLElement;
    headerEl.setPointerCapture(e.pointerId);
    headerEl.style.cursor = 'grabbing';
    
    if (panelRef.current) {
      panelRef.current.style.transition = 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'; // preserve width transiton, drop transform transition
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !panelRef.current) return;
    
    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;
    
    // Prevent dragging completely off screen
    const maxX = window.innerWidth - 100;
    const maxY = window.innerHeight - 100;
    const clampedX = Math.min(Math.max(newX, -maxX), maxX);
    const clampedY = Math.min(Math.max(newY, -maxY), maxY);
    
    dragPos.current = { x: clampedX, y: clampedY };
    panelRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    const headerEl = e.currentTarget as HTMLElement;
    headerEl.releasePointerCapture(e.pointerId);
    headerEl.style.cursor = 'grab';
  };

  const [chartData, setChartData] = useState<DayData[]>([]);

  // Initialize lightweight-charts with our own NSE data
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || chartData.length === 0) return;

    // Load lightweight-charts from CDN if not already loaded
    const LW_CDN = 'https://unpkg.com/lightweight-charts@4.1.7/dist/lightweight-charts.standalone.production.js';
    const initChart = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const LightweightCharts = (window as any).LightweightCharts;
      if (!LightweightCharts) return;

      container.innerHTML = '';

      const chart = LightweightCharts.createChart(container, {
        layout: {
          background: { type: 'solid', color: 'transparent' },
          textColor: '#8b92a5',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 3 },
          horzLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 3 },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.06)',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.06)',
          timeVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00e68a',
        downColor: '#ff4757',
        borderDownColor: '#ff4757',
        borderUpColor: '#00e68a',
        wickDownColor: '#ff4757',
        wickUpColor: '#00e68a',
      });

      const ohlcData = chartData.map(d => ({
        time: d.date.split('T')[0].split(' ')[0],
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      candleSeries.setData(ohlcData);

      const volumeSeries = chart.addHistogramSeries({
        color: 'rgba(0, 230, 138, 0.15)',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      chart.priceScale('').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volumeSeries.setData(
        chartData.map(d => ({
          time: d.date.split('T')[0].split(' ')[0],
          value: d.volume,
          color: d.close >= d.open ? 'rgba(0, 230, 138, 0.2)' : 'rgba(255, 71, 87, 0.2)',
        }))
      );

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      });
      ro.observe(container);

      return () => { ro.disconnect(); chart.remove(); };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).LightweightCharts) {
      const cleanup = initChart();
      return cleanup;
    }

    // Load script from CDN
    const existing = document.querySelector(`script[src="${LW_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => initChart());
      return;
    }
    const script = document.createElement('script');
    script.src = LW_CDN;
    script.async = true;
    script.onload = () => initChart();
    document.head.appendChild(script);
  }, [chartData]);

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
      if (data.chartData) setChartData(data.chartData);
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
        ref={panelRef}
        aria-label="AI Stock Analysis" 
        className={`
          relative z-10 md:absolute md:top-8 md:right-8 
          w-full md:max-h-[calc(100vh-4rem)] 
          bg-[#09090b] md:bg-[#121214]/75 md:backdrop-blur-3xl md:border md:border-white/[0.08] md:rounded-3xl 
          flex flex-col overflow-hidden md:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] 
          min-h-[50vh] mt-[50vh] md:mt-0 md:min-h-0
          transition-[width] duration-500 will-change-transform
          ${isMinimized ? 'md:w-[280px]' : 'md:w-[420px]'}
        `}
      >
        
        {/* HEADER / DRAG HANDLE */}
        <header 
          className="p-6 md:p-8 md:pb-6 border-b border-white/[0.04] md:cursor-grab active:cursor-grabbing select-none relative group"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[10px] uppercase tracking-[0.2em] text-[#8b92a5] font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-2">
              <GripHorizontal size={12} className="opacity-20 hidden md:block group-hover:opacity-60 transition-opacity" />
              {symbol} <ChevronRight size={10} className="opacity-40" /> AI VERDICT
            </h1>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="text-[#8b92a5] hover:text-[#f0f2f7] transition-colors p-1.5 rounded-md hover:bg-white/[0.04] hidden md:block"
              title={isMinimized ? "Expand Panel" : "Minimize to Pill"}
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          </div>
          
          {loading ? (
            <div className="flex flex-col gap-2 mt-4">
              <div className="h-10 w-48 bg-white/[0.04] rounded-md animate-pulse" />
            </div>
          ) : error ? (
            <div className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-[#ef4444] tracking-tight uppercase shadow-[#ef4444]/60 drop-shadow-md">
              Analysis Failed
            </div>
          ) : (
            <div className={`gsap-reveal font-[family-name:var(--font-space-grotesk)] font-bold uppercase leading-none mix-blend-screen transition-all duration-500
              ${isBullish ? 'text-[#00e68a] drop-shadow-[0_0_30px_rgba(0,230,138,0.4)]' : isBearish ? 'text-[#ff4757] drop-shadow-[0_0_30px_rgba(255,71,87,0.4)]' : 'text-[#f0f2f7] drop-shadow-md'}
              ${isMinimized ? 'text-4xl tracking-tight' : 'text-6xl tracking-tighter'}
            `}>
              {analysis?.verdict}
            </div>
          )}
        </header>

        {/* BODY */}
        <main className={`p-6 md:p-8 pt-6 overflow-y-auto flex-1 custom-scrollbar transition-opacity duration-300 ${isMinimized ? 'hidden md:opacity-0 md:h-0 md:p-0' : 'opacity-100'}`}>
          {loading ? (
            <div className="flex flex-col justify-center items-start h-40">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-4 w-4 rounded-full border-[2px] border-[#00e68a] border-r-transparent animate-spin" />
                <span className="text-[#00e68a] font-medium text-xs tracking-wide uppercase">Processing Model</span>
                {retryCount > 0 && <span className="text-[10px] px-2 py-1 bg-white/[0.04] rounded text-[#8b92a5] ml-2 uppercase tracking-wider">Try {retryCount} of 3</span>}
              </div>
              <p className="loading-text text-lg text-[#f0f2f7] font-[family-name:var(--font-space-grotesk)]">
                {loadingMessages[loadingMsgIdx]}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-start pt-2">
              <div className="p-5 bg-[#ff4757]/10 border border-[#ff4757]/20 rounded-2xl w-full mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ff4757]" />
                <div className="flex items-center gap-2 text-[#ff4757] mb-2">
                  <AlertCircle size={16} />
                  <span className="font-semibold text-xs uppercase tracking-wider">System Error</span>
                </div>
                <p className="text-[#8b92a5] text-sm leading-relaxed mb-4">{error}</p>
              </div>
              <button 
                onClick={() => fetchAnalysis(0)}
                className="w-full min-h-[48px] bg-white/[0.04] hover:bg-white/[0.08] text-[#f0f2f7] rounded-xl text-xs transition-colors uppercase tracking-[0.1em] font-semibold focus-visible:outline-none ring-1 ring-inset ring-white/[0.05]"
              >
                Retry Analysis
              </button>
            </div>
          ) : analysis ? (
            <div className="flex flex-col gap-8 pb-2">
              
              {/* KEY LIMITS GRID */}
              <div className="gsap-reveal grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-inner transition-colors hover:bg-white/[0.04]">
                  <div className="text-[9px] uppercase text-[#8b92a5] mb-2 font-[family-name:var(--font-jetbrains-mono)] tracking-[0.15em]">Stop Loss</div>
                  <div className="font-[family-name:var(--font-jetbrains-mono)] text-2xl text-[#f0f2f7] font-medium tracking-tight">
                    {analysis.stop_loss_price ? `₹${analysis.stop_loss_price.toFixed(2)}` : 'N/A'}
                  </div>
                </div>
                {(isBullish || analysis.target_price) && (
                  <div className="p-5 rounded-2xl bg-[#00e68a]/[0.05] border border-[#00e68a]/10 shadow-inner transition-colors hover:bg-[#00e68a]/10">
                    <div className="text-[9px] uppercase text-[#00e68a] mb-2 font-[family-name:var(--font-jetbrains-mono)] tracking-[0.15em]">Target Price</div>
                    <div className="font-[family-name:var(--font-jetbrains-mono)] text-2xl text-[#00e68a] font-medium tracking-tight">
                      {analysis.target_price ? `₹${analysis.target_price.toFixed(2)}` : 'N/A'}
                    </div>
                  </div>
                )}
              </div>

              {/* REASONING */}
              <div className="gsap-reveal">
                <div className="flex items-center justify-between mb-4 border-b border-white/[0.04] pb-3">
                  <h3 className="text-[10px] font-[family-name:var(--font-jetbrains-mono)] uppercase text-[#8b92a5] tracking-[0.2em]">AI Reasoning</h3>
                </div>
                <article className={`text-[14px] text-[#8b92a5] leading-[1.8] font-[family-name:var(--font-inter)] relative ${expandedReasoning ? '' : 'max-h-28 overflow-hidden'}`}>
                  {analysis.reasoning}
                  {!expandedReasoning && (
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#09090b] md:from-[#121214] to-transparent pointer-events-none" />
                  )}
                </article>
                
                <button 
                  onClick={() => setExpandedReasoning(!expandedReasoning)}
                  className="gsap-reveal w-full min-h-[44px] rounded-xl border border-white/[0.06] hover:bg-white/[0.04] hover:text-[#f0f2f7] transition-all duration-300 text-[10px] font-[family-name:var(--font-jetbrains-mono)] tracking-[0.2em] text-[#8b92a5] mt-5 focus-visible:outline-none"
                >
                  {expandedReasoning ? 'COLLAPSE TEXT' : 'READ FULL REPORT'}
                </button>
              </div>

              {/* METADATA DIAGNOSTICS */}
              {metadata && (
                <div className="gsap-reveal mt-2 pt-5 border-t border-white/[0.04] opacity-40 hover:opacity-100 transition-opacity flex items-center justify-between text-[10px] text-[#8b92a5] font-[family-name:var(--font-jetbrains-mono)] tracking-wider">
                  <span className="flex items-center gap-1.5"><Cpu size={10} /> {metadata.model}</span>
                  <span className="flex items-center gap-1.5"><Zap size={10} /> {formatLatency(metadata.latencyMs)}</span>
                  {metadata.promptTokens && <span className="flex items-center gap-1.5"><Database size={10} /> {metadata.promptTokens}t</span>}
                </div>
              )}

            </div>
          ) : null}
        </main>
      </aside>
    </div>
  );
}
