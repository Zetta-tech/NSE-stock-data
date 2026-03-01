import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getRedis } from "./redis";
import type { AlertRequest, AlertRequestStatus } from "./types";

const REDIS_KEY = "nse:alert-requests";
const MAX_REQUESTS = 50;

const DATA_DIR = join(process.cwd(), "data");
const FILE_PATH = join(DATA_DIR, "alert-requests.json");

let memRequests: AlertRequest[] | null = null;

function fsLoad(): void {
  if (memRequests !== null) return;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(FILE_PATH)) {
      const data = JSON.parse(readFileSync(FILE_PATH, "utf-8"));
      memRequests = Array.isArray(data) ? data : [];
      return;
    }
  } catch {
    /* corrupted */
  }
  memRequests = [];
}

function fsPersist(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE_PATH, JSON.stringify(memRequests ?? [], null, 2), "utf-8");
  } catch {
    /* write failed */
  }
}

async function loadRequests(): Promise<AlertRequest[]> {
  const r = getRedis();
  if (r) return (await r.get<AlertRequest[]>(REDIS_KEY)) ?? [];
  fsLoad();
  return [...memRequests!];
}

async function saveRequests(requests: AlertRequest[]): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(REDIS_KEY, requests);
    return;
  }
  memRequests = requests;
  fsPersist();
}

export async function getAlertRequests(): Promise<AlertRequest[]> {
  return loadRequests();
}

export async function addAlertRequest(req: AlertRequest): Promise<void> {
  const requests = await loadRequests();
  requests.unshift(req);
  if (requests.length > MAX_REQUESTS) requests.length = MAX_REQUESTS;
  await saveRequests(requests);
}

export async function updateAlertRequestStatus(
  id: string,
  status: AlertRequestStatus,
  patch?: Partial<Pick<AlertRequest, "githubIssueNumber" | "githubIssueUrl" | "githubPrNumber" | "githubPrUrl" | "errorMessage">>
): Promise<void> {
  const requests = await loadRequests();
  const req = requests.find((r) => r.id === id);
  if (!req) return;
  req.status = status;
  if (patch) Object.assign(req, patch);
  await saveRequests(requests);
}
