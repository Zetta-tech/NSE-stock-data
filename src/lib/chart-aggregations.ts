import { DayData } from "./types";

/** Helper to get week standard boundary string: YYYY-Www */
function getWeekBoundary(dateStr: string): string {
  const d = new Date(dateStr);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

/** Helper to get month standard boundary string: YYYY-MM */
function getMonthBoundary(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function aggregate(data: DayData[], boundaryFn: (date: string) => string): DayData[] {
  if (data.length === 0) return [];
  
  const groups = new Map<string, DayData[]>();
  
  for (const day of data) {
    const boundary = boundaryFn(day.date);
    if (!groups.has(boundary)) {
      groups.set(boundary, []);
    }
    groups.get(boundary)!.push(day);
  }
  
  const aggregated: DayData[] = [];
  
  for (const [, days] of groups) {
    // days are inherently sorted because the input data is correctly sorted chronologically
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    
    for (const d of days) {
      if (d.high > high) high = d.high;
      if (d.low < low) low = d.low;
      volume += d.volume;
    }
    
    aggregated.push({
      date: firstDay.date, // Represent the aggregated candle by the date of the first trading day in that period
      open: firstDay.open,
      high,
      low,
      close: lastDay.close,
      volume,
    });
  }
  
  return aggregated;
}

export function aggregateToWeekly(data: DayData[]): DayData[] {
  return aggregate(data, getWeekBoundary);
}

export function aggregateToMonthly(data: DayData[]): DayData[] {
  return aggregate(data, getMonthBoundary);
}
