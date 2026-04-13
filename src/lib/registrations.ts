import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getRedis } from "./redis";

const REDIS_KEY = "nse:registrations";

interface Registration {
  id: string;
  email: string;
  registeredAt: string;
  source?: string;
}

const DATA_DIR = join(process.cwd(), "data");
const REG_FILE = join(DATA_DIR, "registrations.json");

let memRegistrations: Registration[] | null = null;

function fsLoad(): void {
  if (memRegistrations !== null) return;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(REG_FILE)) {
      const data = JSON.parse(readFileSync(REG_FILE, "utf-8"));
      memRegistrations = Array.isArray(data) ? data : [];
      return;
    }
  } catch {
    /* corrupted */
  }
  memRegistrations = [];
}

function fsPersist(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(REG_FILE, JSON.stringify(memRegistrations ?? [], null, 2), "utf-8");
  } catch {
    /* write failed */
  }
}

async function load(): Promise<Registration[]> {
  const r = getRedis();
  if (r) return (await r.get<Registration[]>(REDIS_KEY)) ?? [];
  fsLoad();
  return [...memRegistrations!];
}

async function save(data: Registration[]): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(REDIS_KEY, data);
    return;
  }
  memRegistrations = data;
  fsPersist();
}

export async function addRegistration(
  email: string,
  source?: string
): Promise<{ registration: Registration; isNew: boolean }> {
  const registrations = await load();
  const existing = registrations.find(
    (r) => r.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) return { registration: existing, isNew: false };

  const registration: Registration = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: email.toLowerCase(),
    registeredAt: new Date().toISOString(),
    ...(source ? { source } : {}),
  };
  registrations.unshift(registration);
  await save(registrations);
  return { registration, isNew: true };
}

export async function getRegistrations(): Promise<Registration[]> {
  return load();
}
