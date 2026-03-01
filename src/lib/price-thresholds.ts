import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getRedis } from "./redis";

export interface PriceThresholdConfig {
  symbol: string;
  name: string;
  threshold: number;
  direction: "below" | "above";
}

const REDIS_KEY = "nse:price-thresholds";
const DATA_DIR = join(process.cwd(), "data");
const THRESHOLDS_FILE = join(DATA_DIR, "price-thresholds.json");

const DEFAULT_THRESHOLDS: PriceThresholdConfig[] = [
  { symbol: "WIPRO", name: "Wipro", threshold: 400, direction: "below" },
];

let memThresholds: PriceThresholdConfig[] | null = null;

function fsLoad(): PriceThresholdConfig[] {
  if (memThresholds !== null) return memThresholds;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(THRESHOLDS_FILE)) {
      const data = JSON.parse(readFileSync(THRESHOLDS_FILE, "utf-8"));
      memThresholds = Array.isArray(data) ? data : [...DEFAULT_THRESHOLDS];
      return memThresholds;
    }
  } catch {
    // corrupted — fall through to defaults
  }
  memThresholds = [...DEFAULT_THRESHOLDS];
  return memThresholds;
}

async function load(): Promise<PriceThresholdConfig[]> {
  const r = getRedis();
  if (r) {
    const data = await r.get<PriceThresholdConfig[]>(REDIS_KEY);
    return data ?? [...DEFAULT_THRESHOLDS];
  }
  return fsLoad();
}

export async function getPriceThresholds(): Promise<PriceThresholdConfig[]> {
  return load();
}
