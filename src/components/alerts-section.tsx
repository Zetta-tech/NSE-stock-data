"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import gsap from "gsap";
import type { Alert, AlertRequest } from "@/lib/types";
import { AlertBuilder } from "./alert-builder";

/* ── Built-in alert types (pre-date the request system) ────────────── */

const BUILTIN_ALERT_TYPES = [
  { id: "true-breakout", name: "True Breakout", status: "active" as const },
  { id: "low-breakout", name: "Low Breakout", status: "active" as const },
  { id: "week-high", name: "52 Week High", status: "active" as const },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */

function stripPrefix(text: string): string {
  return text.replace(/^Create Alert:\s*/i, "");
}

/** Derive a concise alert type name from a raw user prompt */
function deriveAlertName(text: string): string {
  const raw = stripPrefix(text).trim();
  // Capitalise first letter, truncate to a reasonable display length
  const capped = raw.charAt(0).toUpperCase() + raw.slice(1);
  return capped.length > 40 ? capped.slice(0, 37) + "..." : capped;
}

/* ── Main Component ─────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const [alertRequests, setAlertRequests] = useState<AlertRequest[]>([]);
  const [configuredOpen, setConfiguredOpen] = useState(false);
  const [inProgressOpen, setInProgressOpen] = useState(false);
  const configuredWrapperRef = useRef<HTMLDivElement>(null);
  const configuredBubbleRef = useRef<HTMLDivElement>(null);
  const inProgressWrapperRef = useRef<HTMLDivElement>(null);
  const inProgressBubbleRef = useRef<HTMLDivElement>(null);

  const inProgressRequests = alertRequests.filter(
    (r) => r.status !== "implemented" && r.status !== "rejected"
  );

  const configuredAlertTypes = [
    ...BUILTIN_ALERT_TYPES,
    ...alertRequests
      .filter((r) => r.status !== "rejected")
      .map((r) => ({
        id: r.id,
        name: deriveAlertName(r.text),
        status: r.status === "implemented" ? ("active" as const) : ("building" as const),
      })),
  ];

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
  }, [fetchRequests]);

  const handleRequestSubmitted = useCallback(() => {
    setTimeout(fetchRequests, 500);
  }, [fetchRequests]);

  /* ── GSAP bubble animations ───────────────────────────────────────── */

  const animateOpen = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.set(el, { visibility: "visible" });
    gsap.fromTo(
      el,
      { opacity: 0, y: -6, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "power2.out" }
    );
  }, []);

  const animateClose = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 0,
      y: -4,
      scale: 0.97,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => { gsap.set(el, { visibility: "hidden" }); },
    });
  }, []);

  useEffect(() => {
    if (configuredOpen) {
      animateOpen(configuredBubbleRef.current);
    } else {
      animateClose(configuredBubbleRef.current);
    }
  }, [configuredOpen, animateOpen, animateClose]);

  useEffect(() => {
    if (inProgressOpen) {
      animateOpen(inProgressBubbleRef.current);
    } else {
      animateClose(inProgressBubbleRef.current);
    }
  }, [inProgressOpen, animateOpen, animateClose]);

  /* ── Click-outside dismissal ──────────────────────────────────────── */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        configuredWrapperRef.current &&
        !configuredWrapperRef.current.contains(e.target as Node)
      ) {
        setConfiguredOpen(false);
      }
      if (
        inProgressWrapperRef.current &&
        !inProgressWrapperRef.current.contains(e.target as Node)
      ) {
        setInProgressOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in">
      <div
        className="rounded-2xl ring-1 ring-surface-border/50 card-elevated overflow-visible"
        style={{
          background: "linear-gradient(180deg, rgba(14, 16, 23, 1) 0%, rgba(11, 13, 18, 1) 100%)",
        }}
      >
        {/* Subtle accent top edge */}
        <div
          className="h-[1px] rounded-t-2xl"
          style={{
            background: "linear-gradient(90deg, transparent 10%, rgba(0, 230, 138, 0.15) 50%, transparent 90%)",
          }}
        />

        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h2 className="font-display text-sm font-bold tracking-tight">Alert Types</h2>
          </div>

          {/* Counter badges */}
          <div className="flex items-center gap-2">
            {/* Configured types counter */}
            <div className="relative" ref={configuredWrapperRef}>
              <button
                onClick={() => {
                  const next = !configuredOpen;
                  setConfiguredOpen(next);
                  if (next && inProgressOpen) setInProgressOpen(false);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold tabular-nums cursor-pointer transition-all duration-200 ring-1 ${
                  configuredOpen
                    ? "bg-accent/15 ring-accent/30 text-accent"
                    : "bg-accent/8 ring-accent/15 text-accent hover:ring-accent/25 hover:bg-accent/12"
                }`}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                {configuredAlertTypes.length}
                <span className="text-[8px] font-semibold uppercase tracking-wider opacity-60">cfg</span>
              </button>

              {/* Configured types popover */}
              <div
                ref={configuredBubbleRef}
                className="absolute right-0 top-full mt-2 z-40 w-[210px] overflow-hidden rounded-xl bg-surface-overlay ring-1 ring-surface-border-bright/60 shadow-2xl shadow-black/60"
                style={{ opacity: 0, visibility: "hidden" }}
              >
                <div className="px-3 py-2.5 space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Alert Types</p>
                  {configuredAlertTypes.map((type) => (
                    <div key={type.id} className="flex items-center gap-2 py-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          type.status === "active"
                            ? "bg-accent shadow-[0_0_4px_rgba(0,230,138,0.4)]"
                            : "bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.3)]"
                        }`}
                      />
                      <span className="text-[11px] font-medium text-text-primary truncate">{type.name}</span>
                      <span
                        className={`ml-auto flex-shrink-0 text-[8px] font-bold uppercase tracking-wider ${
                          type.status === "active" ? "text-accent/60" : "text-amber-400/60"
                        }`}
                      >
                        {type.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* In-progress counter (only visible when > 0) */}
            {inProgressRequests.length > 0 && (
              <div className="relative" ref={inProgressWrapperRef}>
                <button
                  onClick={() => {
                    const next = !inProgressOpen;
                    setInProgressOpen(next);
                    if (next && configuredOpen) setConfiguredOpen(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold tabular-nums cursor-pointer transition-all duration-200 ring-1 ${
                    inProgressOpen
                      ? "bg-amber-500/15 ring-amber-500/30 text-amber-400"
                      : "bg-amber-500/8 ring-amber-500/15 text-amber-400 hover:ring-amber-500/25 hover:bg-amber-500/12"
                  }`}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {inProgressRequests.length}
                  <span className="text-[8px] font-semibold uppercase tracking-wider opacity-60">wip</span>
                </button>

                {/* In-progress popover */}
                <div
                  ref={inProgressBubbleRef}
                  className="absolute right-0 top-full mt-2 z-40 w-[250px] overflow-hidden rounded-xl bg-surface-overlay ring-1 ring-surface-border-bright/60 shadow-2xl shadow-black/60"
                  style={{ opacity: 0, visibility: "hidden" }}
                >
                  <div className="px-3 py-2.5 space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Building</p>
                    {inProgressRequests.map((req) => (
                      <div key={req.id} className="flex items-start gap-2 py-1">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/60" />
                        <p className="text-[11px] font-medium text-text-primary leading-snug line-clamp-2">
                          {stripPrefix(req.text)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="mx-5 border-t border-surface-border/30" />

        {/* Alert Builder */}
        <div className="px-5 pt-3 pb-4">
          <AlertBuilder onSubmitted={handleRequestSubmitted} />
        </div>
      </div>
    </div>
  );
}
