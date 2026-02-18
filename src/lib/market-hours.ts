/* ── NSE Market Hours (IST) ──────────────────────────────────────────
 * Pre-open:  09:00
 * Open:      09:15
 * Close:     15:30
 * Closing session ends: 16:00
 *
 * We treat 09:15 – 15:30 as "live trading" hours.
 * We treat 09:00 – 16:00 as "extended" hours (data still fresh-ish).
 * Outside 16:00 – 09:00 next day: fully closed, no point polling.
 *
 * This file is safe for both server and client (no "server-only").
 */

const MARKET_OPEN_H = 9;
const MARKET_OPEN_M = 15;
const MARKET_CLOSE_H = 15;
const MARKET_CLOSE_M = 30;
const EXTENDED_CLOSE_H = 16;
const EXTENDED_CLOSE_M = 0;

function getISTDate(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

function toMinutes(h: number, m: number): number {
  return h * 60 + m;
}

/** True during 09:15 – 15:30 IST on weekdays */
export function isMarketHours(): boolean {
  const now = getISTDate();
  const day = now.getDay();
  if (day === 0 || day === 6) return false; // weekend
  const mins = toMinutes(now.getHours(), now.getMinutes());
  return mins >= toMinutes(MARKET_OPEN_H, MARKET_OPEN_M) &&
         mins < toMinutes(MARKET_CLOSE_H, MARKET_CLOSE_M);
}

/** True during 09:00 – 16:00 IST on weekdays (includes closing session) */
export function isExtendedHours(): boolean {
  const now = getISTDate();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const mins = toMinutes(now.getHours(), now.getMinutes());
  return mins >= toMinutes(MARKET_OPEN_H, 0) &&
         mins < toMinutes(EXTENDED_CLOSE_H, EXTENDED_CLOSE_M);
}

/** Minutes until market opens (09:15 IST). 0 if already open. */
export function minutesUntilOpen(): number {
  const now = getISTDate();
  const mins = toMinutes(now.getHours(), now.getMinutes());
  const openMins = toMinutes(MARKET_OPEN_H, MARKET_OPEN_M);
  if (mins >= openMins && mins < toMinutes(MARKET_CLOSE_H, MARKET_CLOSE_M)) return 0;
  if (mins < openMins) return openMins - mins;
  // After close: minutes until next day's open
  return (24 * 60 - mins) + openMins;
}
