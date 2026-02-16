import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getRedis } from "./redis";
import type { ActivityEvent, ActivityCategory, ScanMeta } from "./types";

/* ── Keys & limits ──────────────────────────────────────────────────── */

const ACTIVITY_KEY = "nse:activity";
const SCAN_META_KEY = "nse:scan-meta";
const MAX_EVENTS = 200;

/* ── Filesystem fallback (local dev) ────────────────────────────────── */

const DATA_DIR = join(process.cwd(), "data");
const ACTIVITY_FILE = join(DATA_DIR, "activity.json");

interface PersistedActivity {
  events: ActivityEvent[];
  scanMeta: ScanMeta | null;
}

let memEvents: ActivityEvent[] | null = null;
let memScanMeta: ScanMeta | null = null;

function fsLoad(): void {
  if (memEvents !== null) return;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(ACTIVITY_FILE)) {
      const state: PersistedActivity = JSON.parse(
        readFileSync(ACTIVITY_FILE, "utf-8")
      );
      memEvents = Array.isArray(state.events) ? state.events : [];
      memScanMeta = state.scanMeta ?? null;
      return;
    }
  } catch {
    /* corrupted */
  }
  memEvents = [];
  memScanMeta = null;
}

function fsPersist(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      ACTIVITY_FILE,
      JSON.stringify(
        { events: memEvents ?? [], scanMeta: memScanMeta ?? null },
        null,
        2
      ),
      "utf-8"
    );
  } catch {
    /* write failed */
  }
}

/* ── Internal helpers ───────────────────────────────────────────────── */

async function loadEvents(): Promise<ActivityEvent[]> {
  const r = getRedis();
  if (r) return (await r.get<ActivityEvent[]>(ACTIVITY_KEY)) ?? [];
  fsLoad();
  return [...memEvents!];
}

async function saveEvents(events: ActivityEvent[]): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(ACTIVITY_KEY, events);
    return;
  }
  memEvents = events;
  fsPersist();
}

/* ── Public API ─────────────────────────────────────────────────────── */

export async function addActivity(
  cat: ActivityCategory,
  action: string,
  label: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const event: ActivityEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    cat,
    action,
    label,
    ...(detail ? { detail } : {}),
  };
  const events = await loadEvents();
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  await saveEvents(events);
}

export async function getActivity(limit = 50): Promise<ActivityEvent[]> {
  const events = await loadEvents();
  return events.slice(0, limit);
}

export async function setScanMeta(meta: ScanMeta): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(SCAN_META_KEY, meta);
    return;
  }
  memScanMeta = meta;
  fsPersist();
}

export async function getScanMeta(): Promise<ScanMeta | null> {
  const r = getRedis();
  if (r) return (await r.get<ScanMeta>(SCAN_META_KEY)) ?? null;
  fsLoad();
  return memScanMeta ? { ...memScanMeta } : null;
}
