'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LogEntry, LogLevel } from '@/lib/logger';

/* ─── Stat Card ──────────────────────────────────────────────────────── */
/**
 * Displays a single metric in the stats grid at the top of the console.
 * Each card surfaces a key health indicator at a glance.
 */
function StatCard({
    label,
    value,
    icon,
    color,
    subtext,
}: {
    label: string;
    value: string | number;
    icon: string;
    color: string;
    subtext?: string;
}) {
    return (
        <div className="bg-surface-raised border border-surface-border rounded-xl p-5 flex items-start gap-4 group hover:border-opacity-60 transition-all duration-300">
            <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${color}`}
            >
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">
                    {label}
                </p>
                <p className="text-2xl font-bold text-text-primary tabular-nums leading-none">
                    {value}
                </p>
                {subtext && (
                    <p className="text-[11px] text-text-muted mt-1.5">{subtext}</p>
                )}
            </div>
        </div>
    );
}

/* ─── Context Descriptions ───────────────────────────────────────────── */
/**
 * Maps each subsystem context to a short, jargon-free explanation
 * shown as a tooltip when hovering the context badge.
 */
const CONTEXT_DESCRIPTIONS: Record<string, string> = {
    'NSE Data Service': 'Handles all communication with the National Stock Exchange (fetching prices, historical data, and search results).',
    'Stock Scanner': 'Analyzes each stock to detect breakout signals — situations where both price and volume exceed recent highs.',
    'Scan API': 'The system endpoint that triggers a scan cycle and returns results to the dashboard.',
    'Stock Search': 'Handles requests to find new stock symbols and company names from the NSE database.',
    'Watchlist': 'Manages your saved stocks, including adding, removing, and toggling focus for the live ticker.',
    'Live Ticker': 'The background service that keeps the dashboard ticker bar updated with real-time price movements.',
};

/* ─── JSON Modal ─────────────────────────────────────────────────────── */
function JsonModal({
    data,
    onClose,
}: {
    data: any;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in-fast"
            onClick={onClose}
        >
            <div
                ref={ref}
                className="bg-surface border border-surface-border rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl animate-scale-in flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center px-5 py-3.5 border-b border-surface-border bg-surface-raised">
                    <div className="flex items-center gap-2">
                        <span className="text-accent text-sm">{'{ }'}</span>
                        <span className="font-semibold text-text-primary text-sm">
                            Log Payload
                        </span>
                    </div>
                    <button
                        className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors text-xs"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>
                <div className="p-5 overflow-auto scrollbar-thin bg-surface/50">
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}

/* ─── Level Badge ────────────────────────────────────────────────────── */
/**
 * Visual styles for each log level so severity is immediately
 * recognisable by colour, even at a glance.
 */
const LEVEL_STYLES: Record<LogLevel, string> = {
    INFO: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    WARN: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    ERROR: 'text-red-400 bg-red-500/10 border-red-500/20',
    DEBUG: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    API: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

/** Human-readable labels for each log level. */
const LEVEL_LABELS: Record<LogLevel, string> = {
    INFO: 'Info',
    WARN: 'Warning',
    ERROR: 'Error',
    DEBUG: 'Debug',
    API: 'API Call',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
    INFO: 'ℹ',
    WARN: '⚠',
    ERROR: '✕',
    DEBUG: '⚙',
    API: '↗',
};

/* ─── Main Dashboard ─────────────────────────────────────────────────── */
export default function DevDashboard() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [modalData, setModalData] = useState<any>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch('/api/logs?limit=500');
            const data = await res.json();
            if (data.success) setLogs(data.logs);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const clearLogs = async () => {
        await fetch('/api/logs', { method: 'DELETE' });
        setLogs([]);
    };

    useEffect(() => {
        fetchLogs();
        if (autoRefresh) {
            const interval = setInterval(fetchLogs, 2500);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, fetchLogs]);

    /* ── Derived data ─────────────────────────────────────────────────── */
    const filteredLogs = logs.filter((log) => {
        const matchLevel = filterLevel === 'ALL' || log.level === filterLevel;
        const matchSearch =
            !searchQuery ||
            log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.context || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchLevel && matchSearch;
    });

    const counts: Record<string, number> = {
        ALL: logs.length,
        API: 0,
        ERROR: 0,
        WARN: 0,
        INFO: 0,
        DEBUG: 0,
    };
    logs.forEach((l) => counts[l.level]++);

    const latestScan = logs.find(
        (l) => l.context === 'Scan API' && l.level === 'INFO'
    );

    return (
        <div className="min-h-screen bg-surface text-text-primary font-body">
            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-surface-border">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-sm font-bold">
                            {'</>'}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-text-primary leading-tight">
                                Developer Console
                            </h1>
                            <p className="text-[11px] text-text-muted">
                                System telemetry · API logs · Scanner alerts
                            </p>
                            <p className="text-[10px] text-text-muted/50 mt-0.5">
                                Hover over any row to see a plain-English explanation
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Auto-refresh toggle */}
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${autoRefresh
                                ? 'bg-accent/10 border-accent/20 text-accent'
                                : 'bg-surface-raised border-surface-border text-text-muted'
                                }`}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-accent animate-pulse' : 'bg-text-muted'
                                    }`}
                            />
                            Live
                        </button>

                        <button
                            onClick={fetchLogs}
                            className="px-3 py-1.5 bg-surface-raised hover:bg-surface-overlay border border-surface-border rounded-lg text-xs font-medium transition-colors"
                        >
                            ↻ Refresh
                        </button>

                        <button
                            onClick={clearLogs}
                            className="px-3 py-1.5 bg-red-500/8 hover:bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors"
                        >
                            Clear
                        </button>

                        <a
                            href="/"
                            className="px-3 py-1.5 bg-surface-raised hover:bg-surface-overlay border border-surface-border rounded-lg text-xs font-medium text-text-secondary transition-colors"
                        >
                            ← Dashboard
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
                {/* ── Stats Grid ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <StatCard
                        label="Total Logs"
                        value={logs.length}
                        icon="📋"
                        color="bg-blue-500/10"
                        subtext={`${filteredLogs.length} shown`}
                    />
                    <StatCard
                        label="API Calls"
                        value={counts.API}
                        icon="↗"
                        color="bg-emerald-500/10"
                    />
                    <StatCard
                        label="Errors"
                        value={counts.ERROR}
                        icon="✕"
                        color="bg-red-500/10"
                        subtext={
                            counts.ERROR > 0
                                ? 'Needs attention'
                                : 'All clear'
                        }
                    />
                    <StatCard
                        label="Warnings"
                        value={counts.WARN}
                        icon="⚠"
                        color="bg-amber-500/10"
                    />
                    <StatCard
                        label="Last Scan"
                        value={
                            latestScan
                                ? new Date(latestScan.timestamp).toLocaleTimeString()
                                : '—'
                        }
                        icon="🔍"
                        color="bg-violet-500/10"
                        subtext={
                            latestScan?.data?.durationMs
                                ? `${latestScan.data.durationMs}ms · ${latestScan.data.stockCount} stocks`
                                : undefined
                        }
                    />
                </div>

                {/* ── Toolbar: Filters + Search ──────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    {/* Level filters */}
                    <div className="flex gap-1.5 flex-wrap">
                        {(
                            ['ALL', 'API', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const
                        ).map((lvl) => {
                            const isActive = filterLevel === lvl;
                            const count = counts[lvl];
                            return (
                                <button
                                    key={lvl}
                                    onClick={() => setFilterLevel(lvl)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all duration-200 flex items-center gap-1.5 ${isActive
                                        ? 'bg-text-primary text-surface border-text-primary shadow-sm'
                                        : 'bg-surface-raised text-text-muted border-surface-border hover:text-text-secondary hover:border-text-muted'
                                        }`}
                                >
                                    {lvl}
                                    <span
                                        className={`text-[9px] tabular-nums ${isActive ? 'opacity-60' : 'opacity-40'
                                            }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 max-w-md ml-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                            🔎
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search logs by message or context…"
                            className="w-full bg-surface-raised border border-surface-border rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Logs Table ─────────────────────────────────────────────── */}
                <div className="bg-surface-raised border border-surface-border rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-surface-border text-[11px] uppercase tracking-wider text-text-muted font-semibold">
                                    <th className="px-5 py-3.5 w-[140px]">When</th>
                                    <th className="px-5 py-3.5 w-[90px]">Severity</th>
                                    <th className="px-5 py-3.5 w-[160px]">Source</th>
                                    <th className="px-5 py-3.5">What Happened</th>
                                    <th className="px-5 py-3.5 w-[90px] text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border/60">
                                {loading && logs.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-5 py-16 text-center text-text-muted"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                                                <span className="text-xs">Loading logs…</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-5 py-16 text-center text-text-muted"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-3xl opacity-30">📭</span>
                                                <span className="text-xs">
                                                    {searchQuery
                                                        ? 'No logs match your search'
                                                        : 'No logs recorded yet. Run a scan to see activity.'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log, i) => {
                                        const isExpanded = expandedRow === log.id;
                                        return (
                                            <tr
                                                key={log.id}
                                                className={`group transition-colors duration-150 cursor-default ${log.level === 'ERROR'
                                                    ? 'bg-red-500/[0.03] hover:bg-red-500/[0.06]'
                                                    : log.level === 'WARN'
                                                        ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.04]'
                                                        : 'hover:bg-surface-overlay/30'
                                                    }`}
                                                style={{
                                                    animationDelay: `${Math.min(i * 15, 300)}ms`,
                                                }}
                                                onClick={() =>
                                                    setExpandedRow(isExpanded ? null : log.id)
                                                }
                                            >
                                                {/* Timestamp */}
                                                <td className="px-5 py-3 font-mono text-xs whitespace-nowrap text-text-muted">
                                                    {new Date(log.timestamp).toLocaleTimeString(
                                                        'en-US',
                                                        { hour12: false }
                                                    )}
                                                    <span className="text-[10px] opacity-40 ml-0.5">
                                                        .
                                                        {new Date(log.timestamp)
                                                            .getMilliseconds()
                                                            .toString()
                                                            .padStart(3, '0')}
                                                    </span>
                                                </td>

                                                {/* Level badge */}
                                                <td className="px-5 py-3">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border cursor-help ${LEVEL_STYLES[log.level]
                                                            }`}
                                                        title={`${LEVEL_LABELS[log.level]} — ${log.level === 'ERROR' ? 'A failure occurred' : log.level === 'WARN' ? 'Something unusual was detected' : log.level === 'API' ? 'An outgoing API call was made' : log.level === 'DEBUG' ? 'Low-level diagnostic detail' : 'General informational event'}`}
                                                    >
                                                        <span className="text-[9px]">
                                                            {LEVEL_ICONS[log.level]}
                                                        </span>
                                                        {log.level}
                                                    </span>
                                                </td>

                                                {/* Context / Source */}
                                                <td className="px-5 py-3 text-xs">
                                                    {log.context ? (
                                                        <span
                                                            className="bg-surface-overlay/60 px-2 py-1 rounded text-[11px] text-text-secondary cursor-help inline-block"
                                                            title={CONTEXT_DESCRIPTIONS[log.context] || `Events from the "${log.context}" subsystem.`}
                                                        >
                                                            {log.context}
                                                        </span>
                                                    ) : (
                                                        <span className="opacity-20">—</span>
                                                    )}
                                                </td>

                                                {/* Message + Description */}
                                                <td className="px-5 py-3 text-xs text-text-primary leading-relaxed">
                                                    {/* Technical summary */}
                                                    <span className="font-mono break-words">{log.message}</span>

                                                    {/* Human-friendly description (always visible when present) */}
                                                    {log.description && (
                                                        <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted/80 font-sans break-words">
                                                            {log.description}
                                                        </p>
                                                    )}

                                                    {/* Inline expanded raw data (toggled by row click) */}
                                                    {isExpanded && log.data && (
                                                        <div className="mt-2 p-3 bg-surface/60 rounded-lg border border-surface-border text-[11px] text-text-secondary font-mono animate-fade-in">
                                                            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-sans font-semibold">Raw Data Payload</p>
                                                            <pre className="whitespace-pre-wrap leading-relaxed">
                                                                {JSON.stringify(log.data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Data action */}
                                                <td className="px-5 py-3 text-right">
                                                    {log.data ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setModalData(log.data);
                                                            }}
                                                            className="text-[10px] uppercase font-bold tracking-wider text-accent/70 hover:text-accent transition-colors"
                                                        >
                                                            {'{ } JSON'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-text-muted opacity-15">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer bar */}
                    {filteredLogs.length > 0 && (
                        <div className="px-5 py-3 border-t border-surface-border bg-surface-overlay/20 flex items-center justify-between text-[11px] text-text-muted">
                            <span>
                                Showing <strong className="text-text-secondary">{filteredLogs.length}</strong> of{' '}
                                <strong className="text-text-secondary">{logs.length}</strong> logs
                            </span>
                            <span>
                                {autoRefresh && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                        Polling every 2.5s
                                    </span>
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </main>

            {/* ── JSON Modal ─────────────────────────────────────────────── */}
            {modalData && (
                <JsonModal data={modalData} onClose={() => setModalData(null)} />
            )}
        </div>
    );
}
