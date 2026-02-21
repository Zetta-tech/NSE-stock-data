import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getRedis } from "./redis";
import type { Alert, WatchlistStock } from "./types";

/* ── Default watchlist (used on first run) ──────────────────────────── */

const DEFAULT_WATCHLIST: WatchlistStock[] = [
  { symbol: "INFY", name: "Infosys", closeWatch: false },
  { symbol: "HDFCBANK", name: "HDFC Bank", closeWatch: false },
  { symbol: "SBIN", name: "SBI", closeWatch: false },
  { symbol: "HAL", name: "Hindustan Aeronautics", closeWatch: false },
  { symbol: "RELIANCE", name: "Reliance Industries", closeWatch: false },
];

const WATCHLIST_KEY = "nse:watchlist";
const ALERTS_KEY = "nse:alerts";

/* ── Filesystem backend (local development) ─────────────────────────── *
 * Falls back to JSON file persistence when Redis is not configured.
 * This path is NOT used on Vercel (read-only filesystem).
 * ──────────────────────────────────────────────────────────────────── */

const DATA_DIR = join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "state.json");

interface PersistedState {
  watchlist: WatchlistStock[];
  alerts: Alert[];
}

let memWatchlist: WatchlistStock[] | null = null;
let memAlerts: Alert[] | null = null;

function fsLoad(): void {
  if (memWatchlist !== null) return;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (existsSync(STATE_FILE)) {
    try {
      const raw = readFileSync(STATE_FILE, "utf-8");
      const state: PersistedState = JSON.parse(raw);
      memWatchlist = Array.isArray(state.watchlist)
        ? state.watchlist.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            closeWatch: s.closeWatch ?? false,
          }))
        : [...DEFAULT_WATCHLIST];
      memAlerts = Array.isArray(state.alerts) ? state.alerts : [];
      return;
    } catch {
      // corrupted file — fall through to defaults
    }
  }

  memWatchlist = [...DEFAULT_WATCHLIST];
  memAlerts = [];
}

function fsPersist(): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const state: PersistedState = {
      watchlist: memWatchlist ?? [],
      alerts: memAlerts ?? [],
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // filesystem write failed — state stays in-memory only
  }
}

/* ── Internal helpers ───────────────────────────────────────────────── */

async function loadWatchlist(): Promise<WatchlistStock[]> {
  const r = getRedis();
  if (r) {
    const data = await r.get<WatchlistStock[]>(WATCHLIST_KEY);
    if (!data) return [...DEFAULT_WATCHLIST];
    return data.map((s) => ({ ...s, closeWatch: s.closeWatch ?? false }));
  }
  fsLoad();
  return [...memWatchlist!];
}

async function saveWatchlist(list: WatchlistStock[]): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(WATCHLIST_KEY, list);
    return;
  }
  memWatchlist = list;
  fsPersist();
}

async function loadAlerts(): Promise<Alert[]> {
  const r = getRedis();
  if (r) {
    return (await r.get<Alert[]>(ALERTS_KEY)) ?? [];
  }
  fsLoad();
  return [...memAlerts!];
}

async function saveAlerts(list: Alert[]): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(ALERTS_KEY, list);
    return;
  }
  memAlerts = list;
  fsPersist();
}

/* ── Public API (all async) ─────────────────────────────────────────── */

export async function getWatchlist(): Promise<WatchlistStock[]> {
  return loadWatchlist();
}

export async function addToWatchlist(
  stock: WatchlistStock
): Promise<WatchlistStock[]> {
  const list = await loadWatchlist();
  if (!list.find((s) => s.symbol === stock.symbol)) {
    list.push({ ...stock, closeWatch: stock.closeWatch ?? false });
    await saveWatchlist(list);
  }
  return list;
}

export async function removeFromWatchlist(
  symbol: string
): Promise<WatchlistStock[]> {
  const list = (await loadWatchlist()).filter((s) => s.symbol !== symbol);
  await saveWatchlist(list);
  return list;
}

export async function toggleCloseWatch(
  symbol: string
): Promise<WatchlistStock[]> {
  const list = await loadWatchlist();
  const stock = list.find((s) => s.symbol === symbol);
  if (stock) {
    stock.closeWatch = !stock.closeWatch;
    await saveWatchlist(list);
  }
  return list;
}

export async function getCloseWatchStocks(): Promise<WatchlistStock[]> {
  return (await loadWatchlist()).filter((s) => s.closeWatch);
}

export async function getAlerts(): Promise<Alert[]> {
  const alerts = await loadAlerts();
  return alerts.sort(
    (a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  );
}

export async function addAlert(alert: Alert): Promise<void> {
  const alerts = await loadAlerts();
  const existing = alerts.find(
    (a) =>
      a.symbol === alert.symbol &&
      a.alertType === alert.alertType &&
      a.triggeredAt.slice(0, 10) === alert.triggeredAt.slice(0, 10)
  );
  if (!existing) {
    alerts.push(alert);
    await saveAlerts(alerts);
  }
}

export async function markAlertRead(id: string): Promise<void> {
  const alerts = await loadAlerts();
  const alert = alerts.find((a) => a.id === id);
  if (alert) {
    alert.read = true;
    await saveAlerts(alerts);
  }
}

export async function markAllAlertsRead(): Promise<void> {
  const alerts = await loadAlerts();
  alerts.forEach((a) => {
    a.read = true;
  });
  await saveAlerts(alerts);
}

export async function getUnreadAlertCount(): Promise<number> {
  return (await loadAlerts()).filter((a) => !a.read).length;
}
