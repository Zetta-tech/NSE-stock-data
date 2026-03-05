import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Alert, AlertRequest } from "@/lib/types";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Rocket, ArrowUpRight, Target, Crosshair, TrendingUp, TrendingDown, Sparkles, Activity, LucideIcon
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ── Per-type visual config ─────────────────────────────────────────── */

interface AlertTypeStyle {
  label: string;
  badge: string;
  ring: string;
  bg: string;
  dot: string;
  text: string;
  badgeBg: string;
  badgeRing: string;
  badgeText: string;
  hoverRing: string;
  hoverBg: string;
  hoverShadow: string;
  chipRing: string;
  chipBg: string;
  icon: LucideIcon;
  category: "breakouts" | "highs" | "dma" | "other";
}

const ALERT_STYLES: Record<string, AlertTypeStyle> = {
  breakout: {
    label: "True Breakout",
    badge: "BREAKOUT",
    ring: "ring-accent/12",
    bg: "bg-accent/[0.02]",
    dot: "bg-accent",
    text: "text-accent",
    badgeBg: "bg-accent/8",
    badgeRing: "ring-accent/15",
    badgeText: "text-accent/70",
    hoverRing: "hover:ring-accent/25",
    hoverBg: "hover:bg-accent/[0.04]",
    hoverShadow: "hover:shadow-[rgba(0,230,138,0.1)]",
    chipRing: "ring-accent/15",
    chipBg: "bg-accent/[0.04]",
    icon: Rocket,
    category: "breakouts",
  },
  "low-breakout": {
    label: "Low Breakout",
    badge: "LOW BREAK",
    ring: "ring-red-500/12",
    bg: "bg-red-500/[0.02]",
    dot: "bg-red-400",
    text: "text-red-400",
    badgeBg: "bg-red-500/8",
    badgeRing: "ring-red-500/15",
    badgeText: "text-red-400/70",
    hoverRing: "hover:ring-red-500/25",
    hoverBg: "hover:bg-red-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(239,68,68,0.1)]",
    chipRing: "ring-red-500/15",
    chipBg: "bg-red-500/[0.04]",
    icon: TrendingDown,
    category: "breakouts",
  },
  "week-high": {
    label: "52 Week High",
    badge: "52W HIGH",
    ring: "ring-purple-500/12",
    bg: "bg-purple-500/[0.02]",
    dot: "bg-purple-400",
    text: "text-purple-400",
    badgeBg: "bg-purple-500/8",
    badgeRing: "ring-purple-500/15",
    badgeText: "text-purple-400/70",
    hoverRing: "hover:ring-purple-500/25",
    hoverBg: "hover:bg-purple-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(168,85,247,0.1)]",
    chipRing: "ring-purple-500/15",
    chipBg: "bg-purple-500/[0.04]",
    icon: ArrowUpRight,
    category: "highs",
  },
  "ma200-touch": {
    label: "200 DMA Touch",
    badge: "200 DMA",
    ring: "ring-sky-500/12",
    bg: "bg-sky-500/[0.02]",
    dot: "bg-sky-400",
    text: "text-sky-400",
    badgeBg: "bg-sky-500/8",
    badgeRing: "ring-sky-500/15",
    badgeText: "text-sky-400/70",
    hoverRing: "hover:ring-sky-500/25",
    hoverBg: "hover:bg-sky-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(56,189,248,0.1)]",
    chipRing: "ring-sky-500/15",
    chipBg: "bg-sky-500/[0.04]",
    icon: Crosshair,
    category: "dma",
  },
  "ma100-touch": {
    label: "100 DMA Touch",
    badge: "100 DMA",
    ring: "ring-teal-500/12",
    bg: "bg-teal-500/[0.02]",
    dot: "bg-teal-400",
    text: "text-teal-400",
    badgeBg: "bg-teal-500/8",
    badgeRing: "ring-teal-500/15",
    badgeText: "text-teal-400/70",
    hoverRing: "hover:ring-teal-500/25",
    hoverBg: "hover:bg-teal-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(20,184,166,0.1)]",
    chipRing: "ring-teal-500/15",
    chipBg: "bg-teal-500/[0.04]",
    icon: Target,
    category: "dma",
  },
  "ma50-touch": {
    label: "50 DMA Touch",
    badge: "50 DMA",
    ring: "ring-indigo-500/12",
    bg: "bg-indigo-500/[0.02]",
    dot: "bg-indigo-400",
    text: "text-indigo-400",
    badgeBg: "bg-indigo-500/8",
    badgeRing: "ring-indigo-500/15",
    badgeText: "text-indigo-400/70",
    hoverRing: "hover:ring-indigo-500/25",
    hoverBg: "hover:bg-indigo-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(99,102,241,0.1)]",
    chipRing: "ring-indigo-500/15",
    chipBg: "bg-indigo-500/[0.04]",
    icon: Activity,
    category: "dma",
  },
  "ma5-touch": {
    label: "5 DMA Touch",
    badge: "5 DMA",
    ring: "ring-rose-500/12",
    bg: "bg-rose-500/[0.02]",
    dot: "bg-rose-400",
    text: "text-rose-400",
    badgeBg: "bg-rose-500/8",
    badgeRing: "ring-rose-500/15",
    badgeText: "text-rose-400/70",
    hoverRing: "hover:ring-rose-500/25",
    hoverBg: "hover:bg-rose-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(251,113,133,0.1)]",
    chipRing: "ring-rose-500/15",
    chipBg: "bg-rose-500/[0.04]",
    icon: Sparkles,
    category: "dma",
  },
};

const DEFAULT_STYLE = ALERT_STYLES.breakout;

function getStyle(alertType?: string): AlertTypeStyle {
  if (!alertType || alertType === "scan") return DEFAULT_STYLE;
  return ALERT_STYLES[alertType] ?? DEFAULT_STYLE;
}

function getTodayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function stripPrefix(text: string): string {
  return text.replace(/^Create Alert:\s*/i, "");
}

function deriveAlertName(text: string): string {
  const raw = stripPrefix(text).trim();
  const capped = raw.charAt(0).toUpperCase() + raw.slice(1);
  return capped.length > 30 ? capped.slice(0, 27) + "..." : capped;
}

/* ── Main Component ─────────────────────────────────────────────────── */

export function AlertsSection({ alerts, refreshTrigger }: { alerts: Alert[], refreshTrigger?: number }) {
  const [alertRequests, setAlertRequests] = useState<AlertRequest[]>([]);

  const inProgressRequests = alertRequests.filter(
    (r) => r.status !== "implemented" && r.status !== "rejected"
  );

  const activeAlertTypes = useMemo(() => {
    const included = new Set<string>();
    const types: { id: string; name: string }[] = [];

    for (const id of Object.keys(ALERT_STYLES)) {
      included.add(id);
      types.push({ id, name: ALERT_STYLES[id].label });
    }

    for (const alert of alerts) {
      const t = alert.alertType;
      if (!t || t === "scan" || included.has(t)) continue;
      included.add(t);
      const name = t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      types.push({ id: t, name });
    }

    return types;
  }, [alerts]);

  const groupedTodayAlerts = useMemo(() => {
    const today = getTodayIST();
    const todayList = alerts
      .filter((a) => a.triggeredAt.slice(0, 10) === today)
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

    const groups: Record<"breakouts" | "highs" | "dma" | "other", Alert[]> = {
      breakouts: [],
      highs: [],
      dma: [],
      other: [],
    };

    todayList.forEach((a) => {
      const s = getStyle(a.alertType);
      const cat = s.category || "other";
      groups[cat].push(a);
    });

    return { list: todayList, groups };
  }, [alerts]);

  const { list: todayAlerts, groups } = groupedTodayAlerts;

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/alert-requests");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAlertRequests(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshTrigger]);

  return (
    <div className="animate-fade-in w-full h-[calc(100vh-8rem)] max-h-[850px] min-h-[500px]">
      <div className="rounded-[2rem] border border-white/5 bg-[#101826] shadow-xl flex flex-col w-full h-full relative overflow-hidden">
        {/* Accent top edge */}
        <div
          className="h-[1px] rounded-t-2xl"
          style={{
            background: "linear-gradient(90deg, transparent 10%, rgba(0, 230, 138, 0.15) 50%, transparent 90%)",
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-3.5 pb-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <h2 className="font-display text-sm font-bold tracking-tight">Alert Types</h2>
          <span className="ml-auto font-mono text-[10px] font-bold tabular-nums text-accent/50">
            {activeAlertTypes.length + inProgressRequests.length}
          </span>
        </div>

        {/* Alert type chips — color-coded per type */}
        <div className="flex flex-wrap gap-2 px-5 pb-3 shrink-0">
          {activeAlertTypes.map((type) => {
            const s = ALERT_STYLES[type.id] ?? DEFAULT_STYLE;
            const Icon = s.icon || Rocket;
            return (
              <div
                key={type.id}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ${s.chipRing} ${s.chipBg}`}
              >
                <Icon className={`h-3 w-3 ${s.text}`} />
                <span className="text-[11px] font-medium text-text-primary/90">{type.name}</span>
              </div>
            );
          })}

          {inProgressRequests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ring-amber-500/15 bg-amber-500/[0.04]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70 animate-pulse" />
              <span className="text-[11px] font-medium text-text-primary/70">{deriveAlertName(req.text)}</span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400/50">building</span>
            </div>
          ))}
        </div>

        {/* Fired alerts feed — grouped */}
        {todayAlerts.length > 0 && (
          <div className="flex flex-col w-full pb-8 flex-1 overflow-y-auto scrollbar-hide alerts-scroll-container">
            <div className="mx-5 border-t border-surface-border/20 mb-2 shrink-0" />

            {groups.breakouts.length > 0 && (
              <AlertGroup category="Breakouts" count={groups.breakouts.length} alerts={groups.breakouts} offsetIndex={0} />
            )}
            {groups.highs.length > 0 && (
              <AlertGroup category="New Highs" count={groups.highs.length} alerts={groups.highs} offsetIndex={groups.breakouts.length} />
            )}
            {groups.dma.length > 0 && (
              <AlertGroup category="Moving Averages" count={groups.dma.length} alerts={groups.dma} offsetIndex={groups.breakouts.length + groups.highs.length} />
            )}
            {groups.other.length > 0 && (
              <AlertGroup category="Other Alerts" count={groups.other.length} alerts={groups.other} offsetIndex={groups.breakouts.length + groups.highs.length + groups.dma.length} />
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function AlertGroup({ category, count, alerts, offsetIndex = 0 }: { category: string, count: number, alerts: Alert[], offsetIndex?: number }) {
  let accentColor = "bg-surface-border/50";
  if (category === "Breakouts") accentColor = "bg-accent/50 box-glow-accent";
  else if (category === "New Highs") accentColor = "bg-purple-500/50 box-glow-purple";
  else if (category === "Moving Averages") accentColor = "bg-sky-500/50 box-glow-sky";

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-5 pt-3 pb-3 relative">
        {/* Subtle top border line for the group header */}
        <div className="absolute top-0 left-5 right-5 h-[1px] bg-gradient-to-r from-surface-border/30 via-surface-border/10 to-transparent" />

        <div className="flex items-center gap-2 relative z-10">
          <div className={`h-3 w-[2px] rounded-full ${accentColor.split(' ')[0]} shadow-[0_0_8px_rgba(currentColor,0.5)]`} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/80">
            {category}
          </span>
          <span className="ml-1 rounded-[4px] bg-surface-overlay ring-1 ring-surface-border/50 px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-text-muted">
            {count}
          </span>
        </div>
      </div>
      <div className="px-4 pb-1 w-full">
        <div className="flex flex-col gap-3 w-full">
          {alerts.map((alert, i) => (
            <FiredAlertCard key={alert.id} alert={alert} index={offsetIndex + i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Fired Alert Card ───────────────────────────────────────────────── */

function FiredAlertCard({ alert, index }: { alert: Alert; index: number }) {
  const s = getStyle(alert.alertType);
  const isUnread = !alert.read;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance animation (on wrapper)
      gsap.from(wrapperRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out",
        delay: index * 0.08,
      });

      // Scroll Spotlight animation (on the card itself)
      const scroller = document.querySelector(".alerts-scroll-container");
      if (scroller && cardRef.current && wrapperRef.current) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrapperRef.current,
            scroller: scroller,
            start: "top 95%",
            end: "bottom 5%",
            scrub: true,
          }
        });

        tl.fromTo(cardRef.current,
          { opacity: 0.25, scale: 0.94, filter: "blur(1px)" },
          { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.2, ease: "power1.out" }
        )
          .to(cardRef.current, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.6 })
          .to(cardRef.current, { opacity: 0.25, scale: 0.94, filter: "blur(1px)", duration: 0.2, ease: "power1.in" });
      }

    }, wrapperRef);
    return () => ctx.revert();
  }, [index]);

  const handleMouseEnter = () => {
    gsap.killTweensOf(effectRef.current);
    const ctx = gsap.context(() => {
      if (s.category === "breakouts") {
        gsap.fromTo(effectRef.current,
          { x: "-100%", opacity: 0 },
          { x: "100%", opacity: 0.15, duration: 1.5, ease: "power1.inOut", repeat: -1 }
        );
        gsap.to(iconRef.current, { y: -2, rotation: -15, scale: 1.1, duration: 0.3, ease: "back.out(2)" });
      } else if (s.category === "highs") {
        gsap.fromTo(effectRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 0.1, scale: 1.1, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: -1 }
        );
        gsap.to(iconRef.current, { y: -3, scale: 1.1, duration: 0.3, ease: "power2.out" });
      } else if (s.category === "dma") {
        gsap.fromTo(effectRef.current,
          { scale: 0.5, opacity: 0.6 },
          { scale: 2.5, opacity: 0, duration: 1.2, ease: "power2.out", repeat: -1 }
        );
        gsap.to(iconRef.current, { scale: 1.15, duration: 0.3, ease: "back.out(2)" });
      } else {
        gsap.to(iconRef.current, { scale: 1.1, duration: 0.3, ease: "power2.out" });
      }
    }, cardRef);
  };

  const handleMouseLeave = () => {
    gsap.killTweensOf(effectRef.current);
    const ctx = gsap.context(() => {
      gsap.to(iconRef.current, { y: 0, rotation: 0, scale: 1, duration: 0.4, ease: "power2.out" });
      if (effectRef.current) gsap.to(effectRef.current, { opacity: 0, duration: 0.4 });
    }, cardRef);
  };

  const Icon = s.icon || Rocket;

  let pattern = "";
  if (s.category === "breakouts") {
    pattern = `url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23ffffff' fill-opacity='0.15'/%3E%3C/svg%3E")`;
  } else if (s.category === "highs") {
    pattern = `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M-1 7L7 -1M-1 1L1 -1M5 7L7 5' stroke='%23ffffff' stroke-width='1' stroke-opacity='0.15'/%3E%3C/svg%3E")`;
  } else if (s.category === "dma") {
    pattern = `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h16v16H0V0zm1 1v14h14V1H1z' fill='%23ffffff' fill-opacity='0.1'/%3E%3C/svg%3E")`;
  }

  // The colored dot representation string (e.g. 'bg-accent' -> 'rgb(0,230,138)') is needed to correctly inject inline gradient colors if possible, but let's just use CSS classes dynamically with some predefined colors.
  const colorStr = s.category === "breakouts" ? (s.badge === "LOW BREAK" ? "rgba(239,68,68,0.5)" : "rgba(0,230,138,0.5)") :
    s.category === "highs" ? "rgba(168,85,247,0.5)" : "rgba(56,189,248,0.5)";

  return (
    <div ref={wrapperRef} className="w-full relative py-0.5">
      <div
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`group relative flex w-full flex-col rounded-[1.5rem] pl-5 pr-4 py-3.5 ring-1 ${s.ring} ${s.bg} ${s.hoverRing} ${s.hoverBg} transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:shadow-lg ${s.hoverShadow}`}
      >
        {/* Background texture */}
        {pattern && (
          <div
            className="absolute inset-0 rounded-[1.5rem] opacity-20 pointer-events-none mix-blend-overlay"
            style={{ backgroundImage: pattern, backgroundSize: s.category === "dma" ? "16px 16px" : "auto" }}
          />
        )}

        {/* GSAP Animation Effect Layer */}
        <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] pointer-events-none z-0">
          {s.category === "breakouts" && (
            <div ref={effectRef} className={`absolute inset-y-0 w-1/2 opacity-0 transform -translate-x-full`} style={{ background: `linear-gradient(to right, transparent, ${colorStr}, transparent)` }} />
          )}
          {s.category === "highs" && (
            <div ref={effectRef} className={`absolute inset-0 opacity-0`} style={{ background: colorStr }} />
          )}
          {s.category === "dma" && (
            <div ref={effectRef} className={`absolute top-[1.35rem] left-[1.35rem] w-6 h-6 rounded-full opacity-0`} style={{ border: `1px solid ${colorStr}` }} />
          )}
        </div>

        {/* Left color stripe */}
        <div className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full ${s.dot} opacity-40 z-10`} />

        {/* Unread pulse dot */}
        {isUnread && (
          <div className="absolute right-2.5 top-2.5 z-10">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-50`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
            </span>
          </div>
        )}

        {/* Symbol & Type Badge & Icon */}
        <div className="flex items-center gap-1.5 relative z-10">
          <div ref={iconRef} className="flex-shrink-0">
            <Icon className={`w-[14px] h-[14px] ${s.text}`} />
          </div>
          <span className={`font-display text-xs font-bold tracking-tight ${s.text}`}>
            {alert.symbol}
          </span>
          <span className={`rounded ${s.badgeBg} ring-1 ${s.badgeRing} px-1 py-px text-[8px] font-bold uppercase tracking-widest ${s.badgeText}`}>
            {s.badge}
          </span>
        </div>

        {/* Price & Change */}
        <div className="mt-2 flex items-baseline gap-2 relative z-10">
          <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-text-primary">
            {alert.todayClose > 0
              ? `\u20B9${alert.todayClose.toLocaleString("en-IN")}`
              : "\u2014"}
          </span>
          <span
            className={`font-mono text-[10px] font-semibold tabular-nums ${alert.todayChange >= 0 ? "text-accent" : "text-danger"
              }`}
          >
            {alert.todayChange >= 0 ? "+" : ""}
            {alert.todayChange.toFixed(2)}%
          </span>
        </div>

        {/* Type-Specific Metrics */}
        <div className="mt-2 space-y-1 relative z-10">
          <AlertMetrics alert={alert} s={s} />
        </div>

        {/* Timestamp */}
        <p className="mt-1.5 font-mono text-[9px] text-text-muted/60 relative z-10">
          {new Date(alert.triggeredAt).toLocaleString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

/* ── Type-specific metrics ──────────────────────────────────────────── */

function AlertMetrics({ alert, s }: { alert: Alert; s: AlertTypeStyle }) {
  const t = alert.alertType;

  if (!t || t === "scan" || t === "breakout") {
    const barPct = (v: number) => Math.min(Math.max(Math.abs(v) / 25 * 100, 10), 100);
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-text-muted w-2 text-right">H</span>
          <div className="h-[3px] w-12 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-accent animate-bar-fill"
              style={{ "--bar-width": `${barPct(alert.highBreakPercent)}%`, width: `${barPct(alert.highBreakPercent)}%` } as React.CSSProperties}
            />
          </div>
          <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
            +{alert.highBreakPercent.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-text-muted w-2 text-right">V</span>
          <div className="h-[3px] w-12 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400 animate-bar-fill"
              style={{ "--bar-width": `${barPct(alert.volumeBreakPercent)}%`, width: `${barPct(alert.volumeBreakPercent)}%` } as React.CSSProperties}
            />
          </div>
          <span className="font-mono text-[9px] font-bold tabular-nums text-blue-400">
            +{alert.volumeBreakPercent.toFixed(1)}%
          </span>
        </div>
      </>
    );
  }

  if (t === "low-breakout") {
    const barPct = (v: number) => Math.min(Math.max(Math.abs(v) / 25 * 100, 10), 100);
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-text-muted w-2 text-right">L</span>
          <div className="h-[3px] w-12 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-red-400 animate-bar-fill"
              style={{ "--bar-width": `${barPct(alert.lowBreakPercent ?? 0)}%`, width: `${barPct(alert.lowBreakPercent ?? 0)}%` } as React.CSSProperties}
            />
          </div>
          <span className="font-mono text-[9px] font-bold tabular-nums text-red-400">
            -{(alert.lowBreakPercent ?? 0).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-text-muted w-2 text-right">V</span>
          <div className="h-[3px] w-12 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400 animate-bar-fill"
              style={{ "--bar-width": `${barPct(alert.volumeBreakPercent)}%`, width: `${barPct(alert.volumeBreakPercent)}%` } as React.CSSProperties}
            />
          </div>
          <span className="font-mono text-[9px] font-bold tabular-nums text-blue-400">
            +{alert.volumeBreakPercent.toFixed(1)}%
          </span>
        </div>
        {alert.prev10DayLow != null && alert.prev10DayLow > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">10D Low</span>
            <span className="font-mono text-[9px] font-bold tabular-nums text-red-400">
              {"\u20B9"}{alert.prev10DayLow.toLocaleString("en-IN")}
            </span>
          </div>
        )}
      </>
    );
  }

  // 52 Week High
  if (t === "week-high") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">52W</span>
        <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
          {"\u20B9"}{(alert.yearHigh ?? alert.todayHigh).toLocaleString("en-IN")}
        </span>
      </div>
    );
  }

  // 200 DMA Touch
  if (t === "ma200-touch") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">DMA</span>
          <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
            {"\u20B9"}{(alert.ma200 ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
        {alert.ma200TouchPercent != null && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">Gap</span>
            <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
              {alert.ma200TouchPercent >= 0 ? "+" : ""}{alert.ma200TouchPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // 100 DMA Touch
  if (t === "ma100-touch") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">DMA</span>
          <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
            {"\u20B9"}{(alert.ma100 ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
        {alert.ma100TouchPercent != null && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">Gap</span>
            <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
              {alert.ma100TouchPercent >= 0 ? "+" : ""}{alert.ma100TouchPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // 50 DMA Touch
  if (t === "ma50-touch") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">DMA</span>
          <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
            {"\u20B9"}{(alert.ma50 ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
        {alert.ma50TouchPercent != null && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">Gap</span>
            <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
              {alert.ma50TouchPercent >= 0 ? "+" : ""}{alert.ma50TouchPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // 5 DMA Touch
  if (t === "ma5-touch") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">DMA</span>
          <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
            {"\u20B9"}{(alert.ma5 ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
        {alert.ma5TouchPercent != null && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">Gap</span>
            <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
              {alert.ma5TouchPercent >= 0 ? "+" : ""}{alert.ma5TouchPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
