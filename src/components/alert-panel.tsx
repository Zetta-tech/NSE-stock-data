"use client";

import type { Alert } from "@/lib/types";

export function AlertPanel({ alerts }: { alerts: Alert[] }) {
  const recentAlerts = alerts.filter((a) => {
    const age = Date.now() - new Date(a.triggeredAt).getTime();
    return age < 7 * 24 * 60 * 60 * 1000;
  });

  if (recentAlerts.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Recent Breakout Alerts
      </h2>
      <div className="overflow-hidden rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50 text-left text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Today High</th>
              <th className="px-4 py-3 font-medium text-right">5d Max High</th>
              <th className="px-4 py-3 font-medium text-right">High Break</th>
              <th className="px-4 py-3 font-medium text-right">Today Vol</th>
              <th className="px-4 py-3 font-medium text-right">5d Max Vol</th>
              <th className="px-4 py-3 font-medium text-right">Vol Break</th>
              <th className="px-4 py-3 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentAlerts.map((alert, i) => (
              <tr
                key={alert.id}
                className="border-b border-surface-border/50 transition-colors hover:bg-surface-overlay/30"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{alert.symbol}</div>
                  <div className="text-xs text-text-muted">{alert.name}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-accent">
                  ₹{alert.todayHigh.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                  ₹{alert.prevMaxHigh.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded bg-accent-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-accent">
                    +{alert.highBreakPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-accent">
                  {formatVolume(alert.todayVolume)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                  {formatVolume(alert.prevMaxVolume)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded bg-accent-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-accent">
                    +{alert.volumeBreakPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-text-muted">
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
    </section>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
