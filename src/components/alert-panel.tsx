"use client";

import type { Alert } from "@/lib/types";

export function AlertPanel({ alerts }: { alerts: Alert[] }) {
  const recentAlerts = alerts.filter((a) => {
    const age = Date.now() - new Date(a.triggeredAt).getTime();
    return age < 7 * 24 * 60 * 60 * 1000;
  });

  if (recentAlerts.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/8 ring-1 ring-accent/15">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-secondary">
          Recent Breakout Alerts
        </h2>
        <span className="rounded-full bg-accent/8 ring-1 ring-accent/15 px-2.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-accent">
          {recentAlerts.length}
        </span>
        <div className="flex-1 border-t border-surface-border/30" />
      </div>
      <div className="overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border/50 card-elevated">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border/40 bg-surface-overlay/20 text-left text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-4 py-3.5 text-right">Today High</th>
                <th className="px-4 py-3.5 text-right">5d Max High</th>
                <th className="px-4 py-3.5 text-right">High Break</th>
                <th className="px-4 py-3.5 text-right">Today Vol</th>
                <th className="px-4 py-3.5 text-right">5d Max Vol</th>
                <th className="px-4 py-3.5 text-right">Vol Break</th>
                <th className="px-4 py-3.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAlerts.map((alert, i) => (
                <tr
                  key={alert.id}
                  className="animate-fade-in border-b border-surface-border/20 transition-colors duration-200 hover:bg-surface-overlay/15"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/8 ring-1 ring-accent/15 font-display text-[10px] font-bold text-accent">
                        {alert.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-display font-bold">{alert.symbol}</div>
                        <div className="text-[11px] text-text-muted">{alert.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-accent">
                    &#x20B9;{alert.todayHigh.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-secondary">
                    &#x20B9;{alert.prevMaxHigh.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/8 ring-1 ring-accent/15 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-accent">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                      {alert.highBreakPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-accent">
                    {formatVolume(alert.todayVolume)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-secondary">
                    {formatVolume(alert.prevMaxVolume)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/8 ring-1 ring-accent/15 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-accent">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                      {alert.volumeBreakPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-text-muted">
                    {new Date(alert.triggeredAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
