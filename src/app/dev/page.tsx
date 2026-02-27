'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import gsap from 'gsap';
import type { LogEntry, LogLevel } from '@/lib/logger';
import type { ActivityEvent, ActivityCategory, ActivityActor, ActivityChange, ScanMeta, NiftyIndex } from '@/lib/types';
import { AdminControls } from '@/components/admin-controls';

interface ApiCallRecord {
  ts: number;
  type: "api" | "cache";
  method: string;
  symbol?: string;
}

interface ApiStatsData {
  total: number;
  apiCalls: number;
  cacheHits: number;
  recentRate: number;
  last60s: ApiCallRecord[];
}

interface Nifty50StatsData {
  lastRefreshTime: string | null;
  snapshotFetchSuccess: boolean;
  snapshotFetchCount: number;
  snapshotFailCount: number;
  baselines: {
    available: number;
    missing: number;
    date: string;
    symbols: string[];
  };
}

interface CacheLayersData {
  historical: { size: number; symbols: string[]; date: string; scope?: string };
  snapshot: {
    lastRefreshTime: string | null;
    snapshotFetchSuccess: boolean;
    snapshotFetchCount: number;
    snapshotFailCount: number;
    scope?: string;
  };
  apiThrottle: {
    total: number;
    apiCalls: number;
    cacheHits: number;
    hitRate: number;
    scope?: string;
  };
  persisted?: {
    apiCalls: number;
    cacheHits: number;
    lastFlushed: string | null;
    methodBreakdown: Record<string, { api: number; cache: number }>;
    scope?: string;
  };
}

interface SystemState {
  market: { open: boolean };
  watchlist: { total: number; closeWatch: number; closeWatchSymbols: string[] };
  alerts: { total: number; unread: number; nifty50Alerts?: number; scanAlerts?: number; recentSymbols?: string[] };
  scan: ScanMeta | null;
  cache: { size: number; symbols: string[]; date: string };
  cacheLayers?: CacheLayersData;
  nifty: NiftyIndex | null;
  apiStats: ApiStatsData | null;
  nifty50Stats: Nifty50StatsData | null;
  serverTime: string;
}

type TimelineFilter = 'all' | ActivityCategory;

const CAT_STYLES: Record<ActivityCategory, { border: string; bg: string; text: string; label: string }> = {
  user:    { border: 'border-blue-500/25',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    label: 'User' },
  system:  { border: 'border-emerald-500/25', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'System' },
  warning: { border: 'border-amber-500/25',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Warning' },
};

function ActionIcon({ action }: { action: string }) {
  const cls = 'w-3.5 h-3.5';
  switch (action) {
    case 'scan-manual':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
    case 'scan-auto':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 18.1-4.5"/><path d="M21.5 12.5a10 10 0 0 1-18.1 4.5"/></svg>;
    case 'alert-fired':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
    case 'stock-added':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>;
    case 'stock-removed':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>;
    case 'closewatch-on':
      return <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'closewatch-off':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'autocheck-started':
      return <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
    case 'autocheck-stopped':
      return <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
    case 'intraday-on': case 'intraday-off':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx={action === 'intraday-on' ? '16' : '8'} cy="12" r="3"/></svg>;
    case 'data-stale':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>;
    case 'scan-error':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>;
    case 'nifty50-discovery':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    default:
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function MiniCard({ label, children, accent, warning }: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-all duration-200 ${
      warning ? 'border-amber-500/15 bg-amber-500/[0.03]' :
      accent ? 'border-accent/15 bg-accent/[0.03]' :
      'border-surface-border/60 bg-surface-raised/50'
    }`}>
      <p className="text-[9px] uppercase tracking-wider font-semibold text-text-muted mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function DataHealthBar({ live, historical, stale }: { live: number; historical: number; stale: number }) {
  const total = live + historical + stale;
  if (total === 0) return <span className="text-[10px] text-text-muted">No data</span>;
  const pLive = (live / total) * 100;
  const pHist = (historical / total) * 100;
  const pStale = (stale / total) * 100;
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
        {pLive > 0 && <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${pLive}%` }} />}
        {pHist > 0 && <div className="bg-blue-400 transition-all duration-500" style={{ width: `${pHist}%` }} />}
        {pStale > 0 && <div className="bg-amber-400 transition-all duration-500" style={{ width: `${pStale}%` }} />}
      </div>
      <div className="mt-1 flex gap-2 text-[9px] text-text-muted">
        {live > 0 && <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400" />{live}</span>}
        {historical > 0 && <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-blue-400" />{historical}</span>}
        {stale > 0 && <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-amber-400" />{stale}</span>}
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope?: string }) {
  if (!scope) return null;
  const isPerInstance = scope === 'per-instance';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[7px] font-bold uppercase tracking-wider ${
      isPerInstance
        ? 'bg-blue-500/10 text-blue-400/70 border border-blue-500/15'
        : 'bg-violet-500/10 text-violet-400/70 border border-violet-500/15'
    }`}>
      {isPerInstance ? 'Per-Instance' : 'Cross-Instance'}
    </span>
  );
}

const ACTOR_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  dad:        { bg: 'bg-blue-500/10',    text: 'text-blue-400',    label: 'Dad' },
  system:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'System' },
  'auto-check': { bg: 'bg-amber-500/10',  text: 'text-amber-400',  label: 'Auto' },
};

function ActorBadge({ actor }: { actor?: ActivityActor }) {
  if (!actor) return null;
  const style = ACTOR_STYLES[actor] ?? ACTOR_STYLES.system;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
      {actor === 'dad' && (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      )}
      {actor === 'auto-check' && (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" /><path d="M2.5 11.5a10 10 0 0 1 18.1-4.5" /><path d="M21.5 12.5a10 10 0 0 1-18.1 4.5" />
        </svg>
      )}
      {actor === 'system' && (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
      )}
      {style.label}
    </span>
  );
}

function ChangePills({ changes }: { changes: ActivityChange[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {changes.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-surface-overlay/60 border border-surface-border/60 px-2 py-0.5 text-[10px] font-mono">
          <span className="text-text-muted">{c.field}:</span>
          {c.from !== undefined && (
            <span className="text-red-400/80 line-through">{String(c.from)}</span>
          )}
          {c.from !== undefined && c.to !== undefined && (
            <svg className="w-2.5 h-2.5 text-text-muted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          )}
          {c.to !== undefined && (
            <span className="text-accent">{String(c.to)}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function TimelineEntry({ event, expanded, onToggle, supportMode }: {
  event: ActivityEvent;
  expanded: boolean;
  onToggle: () => void;
  supportMode: boolean;
}) {
  const cat = CAT_STYLES[event.cat];
  const isError = event.action === 'scan-error' || event.action === 'data-stale';

  return (
    <div
      className={`timeline-entry group relative flex gap-3.5 rounded-xl border px-4 py-3.5 transition-all duration-200 cursor-pointer hover:bg-surface-overlay/30 ${
        isError ? 'border-amber-500/15 bg-amber-500/[0.02]' : 'border-surface-border/50 bg-surface-raised/40'
      }`}
      onClick={onToggle}
    >
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cat.bg} ${cat.text}`}>
        <ActionIcon action={event.action} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${cat.border} ${cat.bg} ${cat.text}`}>
            {cat.label}
          </span>
          {event.actor && <ActorBadge actor={event.actor} />}
          <span className="text-[10px] text-text-muted font-mono tabular-nums ml-auto">
            {formatTime(event.ts)}
          </span>
          <span className="text-[10px] text-text-muted/40">
            {timeAgo(event.ts)}
          </span>
        </div>
        <p className="text-[13px] text-text-primary leading-relaxed font-medium">{event.label}</p>

        {event.changes && event.changes.length > 0 && (
          <ChangePills changes={event.changes} />
        )}

        {expanded && (
          <div className="mt-2.5 space-y-2">
            {event.snapshot && (
              <div className="rounded-lg border border-surface-border/60 bg-surface/60 p-3">
                <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">System saw</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(event.snapshot).map(([k, v]) => (
                    <span key={k} className="text-[10px]">
                      <span className="text-text-muted">{k}: </span>
                      <span className="text-text-primary font-mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {event.detail && supportMode && (
              <div className="rounded-lg border border-surface-border/60 bg-surface/60 p-3">
                <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">Raw detail</p>
                <pre className="text-[10px] text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(event.detail, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  INFO:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  WARN:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ERROR: 'text-red-400 bg-red-500/10 border-red-500/20',
  DEBUG: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  API:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

function LogsTable({ logs, loading }: { logs: LogEntry[]; loading: boolean }) {
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => logs.filter((l) => {
    if (filter !== 'ALL' && l.level !== filter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !(l.context || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [logs, filter, search]);

  const counts: Record<string, number> = { ALL: logs.length, API: 0, ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
  logs.forEach((l) => counts[l.level]++);

  return (
    <div className="rounded-xl border border-surface-border/60 bg-surface-raised/50 overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center px-4 py-3 border-b border-surface-border/40">
        <div className="flex gap-1.5 flex-wrap">
          {(['ALL', 'API', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((lvl) => (
            <button key={lvl} onClick={() => setFilter(lvl)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                filter === lvl ? 'bg-text-primary text-surface border-text-primary' : 'bg-surface-raised text-text-muted border-surface-border hover:text-text-secondary'
              }`}>{lvl} <span className="opacity-50">{counts[lvl]}</span></button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter logs..."
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/40" />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-raised z-10">
            <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              <th className="px-4 py-2.5 w-[120px]">Time</th>
              <th className="px-4 py-2.5 w-[70px]">Level</th>
              <th className="px-4 py-2.5 w-[110px]">Context</th>
              <th className="px-4 py-2.5">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/40">
            {loading && logs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-text-muted text-xs">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-text-muted text-xs">No logs match</td></tr>
            ) : filtered.slice(0, 200).map((log) => (
              <tr key={log.id} className={`cursor-default ${log.level === 'ERROR' ? 'bg-red-500/[0.03]' : log.level === 'WARN' ? 'bg-amber-500/[0.02]' : 'hover:bg-surface-overlay/20'}`}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                <td className="px-4 py-2 font-mono text-[10px] text-text-muted whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${LOG_LEVEL_STYLES[log.level]}`}>{log.level}</span>
                </td>
                <td className="px-4 py-2 text-[10px] text-text-secondary font-mono">{log.context || '—'}</td>
                <td className="px-4 py-2 text-[10px] text-text-primary font-mono">
                  <span className="break-words">{log.message}</span>
                  {expandedId === log.id && log.data && (
                    <pre className="mt-1.5 p-2 rounded bg-surface/60 border border-surface-border text-[9px] text-text-secondary whitespace-pre-wrap">{JSON.stringify(log.data, null, 2)}</pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-surface-border text-[10px] text-text-muted">
        {filtered.length} of {logs.length} logs
      </div>
    </div>
  );
}

const ACTION_FLOW_COLORS: Record<string, { dot: string; line: string; label: string }> = {
  'scan-manual':       { dot: 'bg-blue-400',    line: 'bg-blue-400/20',    label: 'Manual Scan' },
  'scan-auto':         { dot: 'bg-amber-400',   line: 'bg-amber-400/20',   label: 'Auto Scan' },
  'alert-fired':       { dot: 'bg-accent',      line: 'bg-accent/20',      label: 'Alert' },
  'stock-added':       { dot: 'bg-emerald-400', line: 'bg-emerald-400/20', label: 'Added Stock' },
  'stock-removed':     { dot: 'bg-red-400',     line: 'bg-red-400/20',     label: 'Removed Stock' },
  'closewatch-on':     { dot: 'bg-amber-400',   line: 'bg-amber-400/20',   label: 'Star On' },
  'closewatch-off':    { dot: 'bg-slate-400',   line: 'bg-slate-400/20',   label: 'Star Off' },
  'autocheck-started': { dot: 'bg-emerald-400', line: 'bg-emerald-400/20', label: 'Auto On' },
  'autocheck-stopped': { dot: 'bg-red-400',     line: 'bg-red-400/20',     label: 'Auto Off' },
  'intraday-on':       { dot: 'bg-cyan-400',    line: 'bg-cyan-400/20',    label: 'Intra On' },
  'intraday-off':      { dot: 'bg-slate-400',   line: 'bg-slate-400/20',   label: 'Intra Off' },
  'nifty50-discovery': { dot: 'bg-blue-400',    line: 'bg-blue-400/20',    label: 'N50' },
  'data-stale':        { dot: 'bg-amber-400',   line: 'bg-amber-400/20',   label: 'Stale' },
  'scan-error':        { dot: 'bg-red-400',     line: 'bg-red-400/20',     label: 'Error' },
};

function CompactActionFlow({ events }: { events: ActivityEvent[] }) {
  const flowEvents = useMemo(() => {
    return events
      .filter((e) => ACTION_FLOW_COLORS[e.action])
      .slice(0, 16);
  }, [events]);

  if (flowEvents.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 py-1">
      {flowEvents.map((event, ei) => {
        const colors = ACTION_FLOW_COLORS[event.action] ?? { dot: 'bg-slate-400', line: 'bg-slate-400/20', label: event.action };
        const isAlert = event.action === 'alert-fired';
        return (
          <div key={event.id} className="flex items-center">
            {ei > 0 && <div className={`h-px w-2 ${colors.line}`} />}
            <div className="group relative" title={`${event.label} (${formatTime(event.ts)})`}>
              <div className={`flex h-5 w-5 items-center justify-center rounded-md border border-surface-border/50 bg-surface-overlay/60 transition-all group-hover:scale-110 ${
                isAlert ? 'ring-1 ring-accent/25' : ''
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${colors.dot} ${isAlert ? 'animate-pulse' : ''}`} />
              </div>
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                <div className="rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 shadow-xl shadow-black/40 text-[9px] whitespace-nowrap">
                  <p className="font-semibold text-text-primary">{colors.label}</p>
                  <p className="text-text-muted font-mono tabular-nums">{formatTime(event.ts)}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollapsibleSection({ title, icon, badge, badgeColor, defaultOpen, scopeBadge, children }: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  scopeBadge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-xl border border-surface-border/50 bg-surface-raised/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left transition-colors hover:bg-surface-overlay/20"
      >
        <span className="text-text-muted">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex-1">{title}</span>
        {scopeBadge && <ScopeBadge scope={scopeBadge} />}
        {badge && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor || 'bg-surface-overlay text-text-muted'}`}>
            {badge}
          </span>
        )}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-text-muted/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-3.5 pb-3 border-t border-surface-border/30">
          {children}
        </div>
      )}
    </div>
  );
}

const GRID_BG_STYLE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40' fill='none' stroke='%23f0f2f7' stroke-opacity='0.035' stroke-width='0.5'/%3E%3C/svg%3E")`,
  backgroundSize: '40px 40px',
  maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 80%)',
  WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 80%)',
};

export default function DevDashboard() {
  const [state, setState] = useState<SystemState | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [supportMode, setSupportMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('support') === 'true' || params.get('support') === '1';
    const fromStorage = localStorage.getItem('nse-support-mode') === '1';
    if (fromUrl || fromStorage) {
      setSupportMode(true);
      if (fromUrl) localStorage.setItem('nse-support-mode', '1');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('nse-support-mode', supportMode ? '1' : '0');
  }, [supportMode]);

  const fetchAll = useCallback(async () => {
    try {
      const [stateRes, activityRes] = await Promise.all([
        fetch('/api/state'),
        fetch('/api/activity?limit=100'),
      ]);
      const [stateData, activityData] = await Promise.all([
        stateRes.json(),
        activityRes.json(),
      ]);
      setState(stateData);
      setEvents(activityData.events || []);
    } catch { }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs?limit=500');
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch { }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    if (supportMode) fetchLogs();
  }, [fetchAll, fetchLogs, supportMode]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAll();
      if (supportMode) fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll, fetchLogs, supportMode]);

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current.children,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [state !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timelineRef.current) return;
    const entries = timelineRef.current.querySelectorAll('.timeline-entry');
    const newCount = events.length;
    const added = newCount - prevEventCountRef.current;
    if (added > 0 && prevEventCountRef.current > 0) {
      const newEntries = Array.from(entries).slice(0, Math.min(added, 5));
      gsap.fromTo(newEntries, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' });
    } else if (prevEventCountRef.current === 0 && entries.length > 0) {
      gsap.fromTo(entries, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out' });
    }
    prevEventCountRef.current = newCount;
  }, [events]);

  const filteredEvents = useMemo(() =>
    timelineFilter === 'all' ? events : events.filter((e) => e.cat === timelineFilter),
    [events, timelineFilter]
  );

  const catCounts = useMemo(() => {
    const c = { all: events.length, user: 0, system: 0, warning: 0 };
    events.forEach((e) => c[e.cat]++);
    return c;
  }, [events]);

  const scan = state?.scan;
  const hasStale = (scan?.staleCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-surface text-text-primary font-body relative">
      <div className="fixed inset-0 pointer-events-none" style={GRID_BG_STYLE} aria-hidden="true" />

      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-border/60">
        <div className="max-w-[1480px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/[0.08] ring-1 ring-accent/15">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-sm font-bold tracking-tight leading-tight">Dev Console</h1>
              <p className="text-[9px] text-text-muted font-medium">Activity · State · Audit</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSupportMode(!supportMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-200 ${
                supportMode
                  ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                  : 'bg-surface-raised border-surface-border text-text-muted hover:text-text-secondary'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              Support
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-200 ${
                autoRefresh
                  ? 'bg-accent/10 border-accent/20 text-accent'
                  : 'bg-surface-raised border-surface-border text-text-muted'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-accent animate-pulse' : 'bg-text-muted'}`} />
              Live
            </button>

            <button onClick={fetchAll}
              className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface-overlay border border-surface-border rounded-lg text-[10px] font-semibold transition-colors text-text-secondary">
              Refresh
            </button>

            <a href="/"
              className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface-overlay border border-surface-border rounded-lg text-[10px] font-semibold text-text-secondary transition-colors">
              Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1480px] mx-auto px-6 py-6 relative z-10">
        <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 140px)' }}>

          <div className="flex-1 min-w-0" style={{ flexBasis: '62%' }}>
            {events.length > 0 && (
              <div className="mb-4 rounded-xl border border-surface-border/50 bg-surface-raised/30 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Action Flow</span>
                  </div>
                  <span className="text-[9px] text-text-muted/40 font-mono tabular-nums">
                    {events.filter(e => ACTION_FLOW_COLORS[e.action]).length} actions
                  </span>
                </div>
                <CompactActionFlow events={events} />
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {Object.entries(ACTION_FLOW_COLORS).slice(0, 8).map(([action, colors]) => (
                    <span key={action} className="flex items-center gap-1 text-[7px] text-text-muted/40">
                      <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
                      {colors.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-sm font-bold tracking-tight text-text-primary">Activity Timeline</h2>
                <span className="text-[10px] text-text-muted/50 font-mono tabular-nums">{events.length} events</span>
              </div>
              <div className="flex gap-1.5">
                {(['all', 'user', 'system', 'warning'] as const).map((f) => {
                  const isActive = timelineFilter === f;
                  const count = catCounts[f];
                  const label = f === 'all' ? 'All' : CAT_STYLES[f as ActivityCategory].label;
                  return (
                    <button key={f} onClick={() => setTimelineFilter(f)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                        isActive ? 'bg-text-primary text-surface border-text-primary' : 'bg-surface-raised text-text-muted border-surface-border/60 hover:text-text-secondary'
                      }`}>
                      {label} <span className="opacity-50">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={timelineRef} className="space-y-2 overflow-y-auto pr-1 scrollbar-thin" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {filteredEvents.length === 0 ? (
                <div className="rounded-xl border border-surface-border/50 bg-surface-raised/30 px-6 py-16 text-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-text-muted/30">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                  <p className="text-xs text-text-muted">No activity recorded yet</p>
                  <p className="text-[10px] text-text-muted/50 mt-1">Use the main dashboard to trigger events</p>
                </div>
              ) : filteredEvents.map((event) => (
                <TimelineEntry
                  key={event.id}
                  event={event}
                  expanded={expandedEvent === event.id}
                  onToggle={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                  supportMode={supportMode}
                />
              ))}
            </div>

            {supportMode && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm font-bold tracking-tight text-violet-400 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    Raw Logs
                  </h2>
                  <button onClick={async () => { await fetch('/api/logs', { method: 'DELETE' }); setLogs([]); }}
                    className="px-2 py-1 bg-red-500/[0.08] hover:bg-red-500/15 text-red-400 border border-red-500/20 rounded text-[10px] font-semibold transition-colors">
                    Clear
                  </button>
                </div>
                <LogsTable logs={logs} loading={logsLoading} />
              </div>
            )}
          </div>

          <div ref={sidebarRef} className="space-y-3" style={{ flexBasis: '38%', maxWidth: '420px', minWidth: '320px' }}>
            <div className="sticky top-[60px] space-y-3 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 100px)' }}>

              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-text-muted/60 mb-2 px-0.5">Security</p>
                <AdminControls variant="inline" />
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-text-muted/60 mb-2 px-0.5">System Status</p>
                <div className="grid grid-cols-2 gap-2">
                  <MiniCard label="Nifty 50" accent={!!state?.nifty && state.nifty.change >= 0} warning={!!state?.nifty && state.nifty.change < 0}>
                    {state?.nifty ? (
                      <div>
                        <p className="text-sm font-bold tabular-nums">{state.nifty.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                        <span className={`text-[9px] font-semibold tabular-nums ${state.nifty.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {state.nifty.change >= 0 ? '+' : ''}{state.nifty.change.toFixed(2)} ({state.nifty.changePercent >= 0 ? '+' : ''}{state.nifty.changePercent.toFixed(2)}%)
                        </span>
                      </div>
                    ) : <span className="text-[10px] text-text-muted">...</span>}
                  </MiniCard>

                  <MiniCard label="Market">
                    {state ? (
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${state.market.open ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
                        <span className={`text-sm font-bold ${state.market.open ? 'text-emerald-400' : 'text-red-400'}`}>
                          {state.market.open ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                    ) : <span className="text-[10px] text-text-muted">...</span>}
                  </MiniCard>

                  <MiniCard label="Last Scan">
                    {scan ? (
                      <div>
                        <p className="text-sm font-bold tabular-nums">{formatTime(scan.scannedAt)}</p>
                        <span className={`inline-flex mt-0.5 px-1 py-px rounded text-[8px] font-bold uppercase ${
                          scan.scanType === 'auto'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}>{scan.scanType}</span>
                      </div>
                    ) : <span className="text-[10px] text-text-muted">None</span>}
                  </MiniCard>

                  <MiniCard label="Close Watch" accent={!!state && state.watchlist.closeWatch > 0}>
                    {state ? (
                      <div>
                        <p className="text-sm font-bold tabular-nums">{state.watchlist.closeWatch} <span className="text-text-muted text-[10px] font-normal">/ {state.watchlist.total}</span></p>
                        {state.watchlist.closeWatch > 0 && (
                          <p className="mt-0.5 text-[9px] text-text-muted truncate" title={state.watchlist.closeWatchSymbols.join(', ')}>
                            {state.watchlist.closeWatchSymbols.join(', ')}
                          </p>
                        )}
                      </div>
                    ) : <span className="text-[10px] text-text-muted">...</span>}
                  </MiniCard>

                  <MiniCard label="Data Health" warning={hasStale}>
                    {scan ? (
                      <DataHealthBar live={scan.liveCount} historical={scan.historicalCount} stale={scan.staleCount} />
                    ) : <span className="text-[10px] text-text-muted">No data</span>}
                  </MiniCard>

                  <MiniCard label="Alerts" accent={!!state && state.alerts.unread > 0}>
                    {state ? (
                      <div>
                        <p className="text-sm font-bold tabular-nums">
                          {state.alerts.unread > 0 ? (
                            <><span className="text-accent">{state.alerts.unread}</span> <span className="text-text-muted text-[10px] font-normal">unread</span></>
                          ) : (
                            <span className="text-text-muted text-[10px] font-normal">0 unread</span>
                          )}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[9px] text-text-muted">
                          <span>{state.alerts.total} total</span>
                          {(state.alerts.nifty50Alerts ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <span className="h-1 w-1 rounded-full bg-blue-400" />{state.alerts.nifty50Alerts}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : <span className="text-[10px] text-text-muted">...</span>}
                  </MiniCard>

                  <MiniCard label="Cache" accent={!!state?.cacheLayers && state.cacheLayers.apiThrottle.hitRate > 60}>
                    {state ? (
                      <div>
                        <p className="text-sm font-bold tabular-nums">{state.cache.size} <span className="text-text-muted text-[10px] font-normal">entries</span></p>
                        {state.cacheLayers && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <div className="h-1 w-10 rounded-full bg-surface-overlay overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                                style={{ width: `${state.cacheLayers.apiThrottle.hitRate}%` }} />
                            </div>
                            <span className="text-[8px] text-emerald-400 font-semibold tabular-nums">{state.cacheLayers.apiThrottle.hitRate}%</span>
                          </div>
                        )}
                      </div>
                    ) : <span className="text-[10px] text-text-muted">...</span>}
                  </MiniCard>
                </div>
              </div>

              {state?.nifty50Stats && (() => {
                const n = state.nifty50Stats;
                const bl = n.baselines;
                const fetchOk = n.snapshotFetchSuccess;
                const totalFetches = n.snapshotFetchCount + n.snapshotFailCount;
                const successRate = totalFetches > 0 ? Math.round((n.snapshotFetchCount / totalFetches) * 100) : 0;
                return (
                  <CollapsibleSection
                    title="Nifty 50 Table"
                    icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                    badge={fetchOk ? 'Healthy' : 'Degraded'}
                    badgeColor={fetchOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                  >
                    <div className="grid grid-cols-2 gap-3 pt-2.5">
                      <div>
                        <p className="text-[9px] text-text-muted font-semibold mb-1">Last Refresh</p>
                        <p className="text-xs font-bold tabular-nums">{n.lastRefreshTime ? formatTime(n.lastRefreshTime) : '—'}</p>
                        <p className="text-[8px] text-text-muted/40 mt-0.5">{n.lastRefreshTime ? timeAgo(n.lastRefreshTime) : 'Never'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-text-muted font-semibold mb-1">Fetches</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold tabular-nums text-emerald-400">{n.snapshotFetchCount}</span>
                          <span className="text-[8px] text-text-muted">ok</span>
                          <span className="text-xs font-bold tabular-nums text-red-400">{n.snapshotFailCount}</span>
                          <span className="text-[8px] text-text-muted">fail</span>
                        </div>
                        <p className="text-[8px] text-text-muted/40 mt-0.5">{successRate}% success</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-text-muted font-semibold mb-1">Baselines</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold tabular-nums text-emerald-400">{bl.available}</span>
                          <span className="text-[8px] text-text-muted">ready</span>
                          <span className="text-xs font-bold tabular-nums text-text-muted">{bl.missing}</span>
                          <span className="text-[8px] text-text-muted">pending</span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-surface-overlay overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                            style={{ width: `${bl.available + bl.missing > 0 ? (bl.available / (bl.available + bl.missing)) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] text-text-muted font-semibold mb-1">Date</p>
                        <p className="text-xs font-bold tabular-nums font-mono">{bl.date}</p>
                        <p className="text-[8px] text-text-muted/40 mt-0.5">Recomputes daily</p>
                      </div>
                    </div>
                  </CollapsibleSection>
                );
              })()}

              {state?.cacheLayers && (() => {
                const cl = state.cacheLayers;
                const snTotal = cl.snapshot.snapshotFetchCount + cl.snapshot.snapshotFailCount;
                const snRate = snTotal > 0 ? Math.round((cl.snapshot.snapshotFetchCount / snTotal) * 100) : 0;
                return (
                  <CollapsibleSection
                    title="Cache Layers"
                    icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>}
                    badge={`${cl.apiThrottle.hitRate}% hit`}
                    badgeColor={cl.apiThrottle.hitRate >= 50 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                  >
                    <div className="space-y-2.5 pt-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          <span className="text-[10px] font-semibold text-blue-400">Historical</span>
                          <ScopeBadge scope={cl.historical.scope} />
                        </div>
                        <span className="text-xs font-bold tabular-nums">{cl.historical.size} <span className="text-text-muted text-[9px] font-normal">symbols</span></span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${cl.snapshot.snapshotFetchSuccess ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="text-[10px] font-semibold text-emerald-400">Snapshot</span>
                          <ScopeBadge scope={cl.snapshot.scope} />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold tabular-nums">{cl.snapshot.snapshotFetchCount}</span>
                          <span className="text-[9px] text-text-muted">fetches</span>
                          {cl.snapshot.snapshotFailCount > 0 && (
                            <span className="text-[9px] text-red-400">{cl.snapshot.snapshotFailCount} fail</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${cl.apiThrottle.hitRate >= 50 ? 'bg-violet-400' : 'bg-amber-400'}`} />
                          <span className="text-[10px] font-semibold text-violet-400">API Throttle</span>
                          <ScopeBadge scope={cl.apiThrottle.scope} />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold tabular-nums text-cyan-400">{cl.apiThrottle.apiCalls}</span>
                          <span className="text-[9px] text-text-muted">api</span>
                          <span className="text-xs font-bold tabular-nums text-emerald-400">{cl.apiThrottle.cacheHits}</span>
                          <span className="text-[9px] text-text-muted">cache</span>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-surface-overlay overflow-hidden flex">
                        {cl.apiThrottle.total > 0 && (
                          <>
                            <div className="h-full bg-cyan-400 transition-all duration-500"
                              style={{ width: `${((cl.apiThrottle.apiCalls / cl.apiThrottle.total) * 100)}%` }} />
                            <div className="h-full bg-emerald-400 transition-all duration-500"
                              style={{ width: `${((cl.apiThrottle.cacheHits / cl.apiThrottle.total) * 100)}%` }} />
                          </>
                        )}
                      </div>
                      <p className="text-[8px] text-text-muted/40">{cl.apiThrottle.total} total · {cl.historical.date} · TTL: midnight IST</p>
                      {cl.persisted && (
                        <>
                          <div className="border-t border-surface-border/30 pt-2.5 mt-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                <span className="text-[10px] font-semibold text-violet-400">Cumulative</span>
                                <ScopeBadge scope={cl.persisted.scope} />
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs font-bold tabular-nums text-cyan-400">{cl.persisted.apiCalls.toLocaleString()}</span>
                                <span className="text-[9px] text-text-muted">api</span>
                                <span className="text-xs font-bold tabular-nums text-emerald-400">{cl.persisted.cacheHits.toLocaleString()}</span>
                                <span className="text-[9px] text-text-muted">cache</span>
                              </div>
                            </div>
                            {cl.persisted.lastFlushed && (
                              <p className="text-[8px] text-text-muted/40 mt-1">Last synced {timeAgo(cl.persisted.lastFlushed)}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </CollapsibleSection>
                );
              })()}

              {state?.apiStats && (() => {
                const s = state.apiStats;
                const total = s.apiCalls + s.cacheHits;
                const cachePercent = total > 0 ? ((s.cacheHits / total) * 100) : 0;
                const rateOk = s.recentRate <= 3;
                const recentApiCalls = s.last60s.filter((r) => r.type === 'api');
                return (
                  <CollapsibleSection
                    title="API Rate"
                    icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
                    scopeBadge="per-instance"
                    badge={`${s.recentRate}/s ${rateOk ? 'OK' : 'HIGH'}`}
                    badgeColor={rateOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                  >
                    <div className="space-y-2.5 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">Rate (60s)</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 rounded-full bg-surface-overlay overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${s.recentRate <= 1 ? 'bg-emerald-400' : s.recentRate <= 2 ? 'bg-blue-400' : s.recentRate <= 3 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min((s.recentRate / 3) * 100, 100)}%` }} />
                          </div>
                          <span className="text-xs font-bold tabular-nums">{s.recentRate}<span className="text-[9px] text-text-muted font-normal">/s</span></span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">API / Cache</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold tabular-nums text-cyan-400">{s.apiCalls}</span>
                          <span className="text-[9px] text-text-muted">/</span>
                          <span className="text-xs font-bold tabular-nums text-emerald-400">{s.cacheHits}</span>
                          <span className="text-[9px] text-text-muted">({cachePercent.toFixed(0)}%)</span>
                        </div>
                      </div>
                      {recentApiCalls.length > 0 && (
                        <div>
                          <p className="text-[9px] text-text-muted/50 mb-1">Recent calls</p>
                          <div className="space-y-0.5 max-h-[48px] overflow-y-auto scrollbar-thin">
                            {recentApiCalls.slice(-4).reverse().map((r, i) => (
                              <div key={i} className="flex items-center gap-1 text-[9px]">
                                <span className="w-1 h-1 rounded-full bg-cyan-400 flex-shrink-0" />
                                <span className="text-text-secondary font-mono truncate">{r.method}{r.symbol ? ` (${r.symbol})` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                );
              })()}


            </div>
          </div>

        </div>

        <div className="flex items-center justify-between pt-4 pb-2 text-[10px] text-text-muted/30 border-t border-surface-border/20 mt-6">
          <span>Server: {state?.serverTime ? formatTime(state.serverTime) : '...'}</span>
          <span>{supportMode ? 'Support mode active' : 'Tip: ?support=true for debug'}</span>
        </div>
      </main>
    </div>
  );
}
