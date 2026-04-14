import "server-only";
import { getRedis } from "./redis";
import { NseIndia } from "stock-nse-india";
import { logger } from "./logger";
import { DayData } from "./types";

const nse = new NseIndia();

interface ChartMeta {
  lastCompletedCandleDate: string;
  coverageStart: string;
  coverageEnd: string;
  lastSyncAt: number;
  schemaVersion: number;
}

const SCHEMA_VERSION = 1;
const CHUNK_DAYS = 365;

// Fetch 1 year of data from NSE
async function fetchChunk(symbol: string, start: Date, end: Date): Promise<DayData[]> {
  try {
    const raw = await nse.getEquityHistoricalData(symbol, { start, end });
    const records = raw.flatMap((entry) => entry.data);
    return records
      .map((r) => ({
        date: r.mtimestamp,
        high: r.chTradeHighPrice,
        low: r.chTradeLowPrice,
        open: r.chOpeningPrice,
        close: r.chClosingPrice,
        volume: r.chTotTradedQty,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (err) {
    logger.error(`Error fetching chunk for ${symbol}`, { error: err }, "Chart Store");
    return [];
  }
}

// Write the cached array to redis safely
async function saveCanonicalStore(symbol: string, data: DayData[], meta: ChartMeta) {
  const r = getRedis();
  if (!r) return;
  await r.set(`chart:daily:${symbol}`, data);
  await r.set(`chart:meta:${symbol}`, meta);
}

// Background task to populate remaining 4 years
export async function warmupRemainingYears(symbol: string, firstYearStart: string) {
  const r = getRedis();
  if (!r) return;
  
  // Acquire a lock for the background fetching job
  const lockKey = `chart:lock:bg:${symbol}`;
  const locked = await r.setnx(lockKey, "1");
  if (!locked) return;
  await r.expire(lockKey, 30); // 30 second lock

  try {
    let currentEnd = new Date(firstYearStart);
    // Fetch 4 more chunks
    const allData: DayData[] = [];
    for (let i = 0; i < 4; i++) {
      const start = new Date(currentEnd);
      start.setDate(start.getDate() - CHUNK_DAYS);
      const chunk = await fetchChunk(symbol, start, currentEnd);
      if (chunk.length > 0) {
        allData.push(...chunk);
        currentEnd = new Date(chunk[0].date);
      }
    }

    if (allData.length === 0) return;

    // Load existing data to prepend
    const existing = await r.get<DayData[]>(`chart:daily:${symbol}`) || [];
    
    // Sort and dedup
    const mergedObj: Record<string, DayData> = {};
    for (const d of [...allData, ...existing]) {
      mergedObj[d.date] = d;
    }
    const finalData = Object.values(mergedObj).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (finalData.length > 0) {
      const meta = await r.get<ChartMeta>(`chart:meta:${symbol}`) || {
         lastCompletedCandleDate: finalData[finalData.length - 1].date,
         coverageStart: finalData[0].date,
         coverageEnd: finalData[finalData.length - 1].date,
         lastSyncAt: Date.now(),
         schemaVersion: SCHEMA_VERSION
      };
      meta.coverageStart = finalData[0].date;
      await saveCanonicalStore(symbol, finalData, meta);
      logger.info(`Background warmup complete for ${symbol}`, { count: allData.length }, "Chart Store");
    }

  } finally {
    await r.del(lockKey);
  }
}

function processTradingDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// Core retriever
export async function getCanonicalChartData(symbol: string): Promise<DayData[]> {
  const r = getRedis();
  if (!r) {
    // Graceful fallback for local dev without redis
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - CHUNK_DAYS);
    return await fetchChunk(symbol, start, end);
  }

  const metaKey = `chart:meta:${symbol}`;
  const dataKey = `chart:daily:${symbol}`;

  const meta = await r.get<ChartMeta>(metaKey);
  
  if (!meta) {
    // COLD START
    const lockKey = `chart:lock:sync:${symbol}`;
    const locked = await r.setnx(lockKey, "1");
    
    if (!locked) {
      // Herd prevention, wait briefly and retry cache
      await new Promise(resolve => setTimeout(resolve, 1500));
      const retryData = await r.get<DayData[]>(dataKey);
      if (retryData) return retryData;
      return []; // Fallback fail-safe
    }

    try {
      await r.expire(lockKey, 10);
      
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - CHUNK_DAYS);
      const firstYear = await fetchChunk(symbol, start, end);
      
      if (firstYear.length > 0) {
        const newMeta: ChartMeta = {
          lastCompletedCandleDate: firstYear[firstYear.length - 1].date,
          coverageStart: firstYear[0].date,
          coverageEnd: firstYear[firstYear.length - 1].date,
          lastSyncAt: Date.now(),
          schemaVersion: SCHEMA_VERSION
        };
        await saveCanonicalStore(symbol, firstYear, newMeta);
        
        // Let the caller handle triggering `warmupRemainingYears` asynchronously
        return firstYear;
      }
      return [];
    } finally {
      await r.del(lockKey);
    }
  }

  // GAP FILL
  const lastDate = new Date(meta.lastCompletedCandleDate);
  const now = new Date();
  const daysDiff = processTradingDays(lastDate, now);
  
  // We don't fetch today's in-progress candle, so we only gap fill if it's strictly older
  if (daysDiff > 1 || (Date.now() - meta.lastSyncAt > 24 * 60 * 60 * 1000)) {
     const lockKey = `chart:lock:sync:${symbol}`;
     const locked = await r.setnx(lockKey, "1");
     if (locked) {
       try {
         await r.expire(lockKey, 10);
         const existingData = await r.get<DayData[]>(dataKey) || [];
         
         const fetchStart = new Date(lastDate);
         // Self-healing mechanics: if > 30 days gap or out of sync, fetch 30 days behind
         if (daysDiff > 30) {
            fetchStart.setDate(fetchStart.getDate() - 30);
         }
         
         const gapData = await fetchChunk(symbol, fetchStart, now);
         
         if (gapData.length > 0) {
            const mergedObj: Record<string, DayData> = {};
            for (const d of [...existingData, ...gapData]) {
              mergedObj[d.date] = d;
            }
            const finalData = Object.values(mergedObj).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            meta.lastCompletedCandleDate = finalData[finalData.length - 1].date;
            meta.coverageEnd = finalData[finalData.length - 1].date;
            meta.lastSyncAt = Date.now();
            await saveCanonicalStore(symbol, finalData, meta);
            return finalData;
         }
       } finally {
         await r.del(lockKey);
       }
     }
  }
  
  const existingData = await r.get<DayData[]>(dataKey);
  return existingData || [];
}
