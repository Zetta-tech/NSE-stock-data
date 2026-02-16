import "server-only";
import type { Alert, WatchlistStock } from "./types";

const DEFAULT_WATCHLIST: WatchlistStock[] = [
  { symbol: "INFY", name: "Infosys", closeWatch: false },
  { symbol: "HDFCBANK", name: "HDFC Bank", closeWatch: false },
  { symbol: "SBIN", name: "SBI", closeWatch: false },
  { symbol: "HAL", name: "Hindustan Aeronautics", closeWatch: false },
  { symbol: "RELIANCE", name: "Reliance Industries", closeWatch: false },
];

let watchlist: WatchlistStock[] = [...DEFAULT_WATCHLIST];
let alerts: Alert[] = [];

export function getWatchlist(): WatchlistStock[] {
  return [...watchlist];
}

export function addToWatchlist(stock: WatchlistStock): WatchlistStock[] {
  if (!watchlist.find((s) => s.symbol === stock.symbol)) {
    watchlist.push({ ...stock, closeWatch: stock.closeWatch ?? false });
  }
  return getWatchlist();
}

export function removeFromWatchlist(symbol: string): WatchlistStock[] {
  watchlist = watchlist.filter((s) => s.symbol !== symbol);
  return getWatchlist();
}

export function toggleCloseWatch(symbol: string): WatchlistStock[] {
  const stock = watchlist.find((s) => s.symbol === symbol);
  if (stock) {
    stock.closeWatch = !stock.closeWatch;
  }
  return getWatchlist();
}

export function getCloseWatchStocks(): WatchlistStock[] {
  return watchlist.filter((s) => s.closeWatch);
}

export function getAlerts(): Alert[] {
  return [...alerts].sort(
    (a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  );
}

export function addAlert(alert: Alert): void {
  const existing = alerts.find(
    (a) =>
      a.symbol === alert.symbol &&
      a.triggeredAt.slice(0, 10) === alert.triggeredAt.slice(0, 10)
  );
  if (!existing) {
    alerts.push(alert);
  }
}

export function markAlertRead(id: string): void {
  const alert = alerts.find((a) => a.id === id);
  if (alert) {
    alert.read = true;
  }
}

export function markAllAlertsRead(): void {
  alerts.forEach((a) => {
    a.read = true;
  });
}

export function getUnreadAlertCount(): number {
  return alerts.filter((a) => !a.read).length;
}
