import "server-only";
import { Redis } from "@upstash/redis";

/* Shared Redis singleton for all server-side stores.
 * Returns null when UPSTASH env vars are not set (local dev). */

let instance: Redis | null = null;
let checked = false;

export function getRedis(): Redis | null {
  if (checked) return instance;
  checked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    instance = new Redis({ url, token });
  }
  return instance;
}
