import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Alert, WatchlistStock } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "state.json");

const DEFAULT_WATCHLIST: WatchlistStock[] = [
  { symbol: "INFY", name: "Infosys", closeWatch: false },
  { symbol: "HDFCBANK", name: "HDFC Bank", closeWatch: false },
  { symbol: "SBIN", name: "SBI", closeWatch: false },
  { symbol: "HAL", name: "Hindustan Aeronautics", closeWatch: false },
  { symbol: "RELIANCE", name: "Reliance Industries", closeWatch: false },
];

interface PersistedState {
  watchlist: WatchlistStock[];
  alerts: Alert[];
}

let watchlist: WatchlistStock[] | null = null;
let alerts: Alert[] | null = null;

function ensureLoaded(): void {
  if (watchlist !== null) return;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (existsSync(STATE_FILE)) {
    try {
      const raw = readFileSync(STATE_FILE, "utf-8");
      const state: PersistedState = JSON.parse(raw);
      watchlist = Array.isArray(state.watchlist)
        ? state.watchlist.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            closeWatch: s.closeWatch ?? false,
          }))
        : [...DEFAULT_WATCHLIST];
      alerts = Array.isArray(state.alerts) ? state.alerts : [];
      return;
    } catch {
      // corrupted file — fall through to defaults
    }
  }

  watchlist = [...DEFAULT_WATCHLIST];
  alerts = [];
}

function persist(): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const state: PersistedState = {
      watchlist: watchlist ?? [],
      alerts: alerts ?? [],
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // filesystem write failed — state stays in-memory only
  }
}

export function getWatchlist(): WatchlistStock[] {
  ensureLoaded();
  return [...watchlist!];
}

export function addToWatchlist(stock: WatchlistStock): WatchlistStock[] {
  ensureLoaded();
  if (!watchlist!.find((s) => s.symbol === stock.symbol)) {
    watchlist!.push({ ...stock, closeWatch: stock.closeWatch ?? false });
    persist();
  }
  return getWatchlist();
}

export function removeFromWatchlist(symbol: string): WatchlistStock[] {
  ensureLoaded();
  watchlist = watchlist!.filter((s) => s.symbol !== symbol);
  persist();
  return getWatchlist();
}

export function toggleCloseWatch(symbol: string): WatchlistStock[] {
  ensureLoaded();
  const stock = watchlist!.find((s) => s.symbol === symbol);
  if (stock) {
    stock.closeWatch = !stock.closeWatch;
    persist();
  }
  return getWatchlist();
}

export function getCloseWatchStocks(): WatchlistStock[] {
  ensureLoaded();
  return watchlist!.filter((s) => s.closeWatch);
}

export function getAlerts(): Alert[] {
  ensureLoaded();
  return [...alerts!].sort(
    (a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  );
}

export function addAlert(alert: Alert): void {
  ensureLoaded();
  const existing = alerts!.find(
    (a) =>
      a.symbol === alert.symbol &&
      a.triggeredAt.slice(0, 10) === alert.triggeredAt.slice(0, 10)
  );
  if (!existing) {
    alerts!.push(alert);
    persist();
  }
}

export function markAlertRead(id: string): void {
  ensureLoaded();
  const alert = alerts!.find((a) => a.id === id);
  if (alert) {
    alert.read = true;
    persist();
  }
}

export function markAllAlertsRead(): void {
  ensureLoaded();
  alerts!.forEach((a) => {
    a.read = true;
  });
  persist();
}

export function getUnreadAlertCount(): number {
  ensureLoaded();
  return alerts!.filter((a) => !a.read).length;
}
