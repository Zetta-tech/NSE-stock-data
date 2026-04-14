import { describe, it, expect } from "vitest";
import { aggregateToWeekly, aggregateToMonthly } from "./chart-aggregations";
import type { DayData } from "./types";

describe("chart-aggregations", () => {
  const dummyData: DayData[] = [
    // Week 1 (Jan 2024 starts on Monday Jan 1st)
    { date: "2024-01-01", open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { date: "2024-01-02", open: 105, high: 115, low: 100, close: 110, volume: 1500 },
    { date: "2024-01-03", open: 110, high: 105, low: 80, close: 90, volume: 2000 }, // True Low 80
    { date: "2024-01-04", open: 90, high: 130, low: 85, close: 125, volume: 2500 }, // True High 130
    { date: "2024-01-05", open: 125, high: 126, low: 120, close: 120, volume: 1000 }, // Close 120
    // Week 2
    { date: "2024-01-08", open: 120, high: 125, low: 115, close: 122, volume: 1000 },
    { date: "2024-01-09", open: 122, high: 128, low: 120, close: 126, volume: 1000 },
    // A month boundary crossover (Jan -> Feb)
    { date: "2024-01-31", open: 150, high: 160, low: 140, close: 155, volume: 3000 },
    { date: "2024-02-01", open: 155, high: 165, low: 150, close: 160, volume: 1000 },
  ];

  it("aggregates daily into weekly keeping true highs/lows", () => {
    const weekly = aggregateToWeekly(dummyData);
    
    // Check Week 1 mapping
    expect(weekly[0].date).toBe("2024-01-01");
    expect(weekly[0].open).toBe(100);
    expect(weekly[0].high).toBe(130);
    expect(weekly[0].low).toBe(80);
    expect(weekly[0].close).toBe(120);
    expect(weekly[0].volume).toBe(8000);
    
    // Check Week 2 mapping
    expect(weekly[1].date).toBe("2024-01-08");
    expect(weekly[1].high).toBe(128);
    expect(weekly[1].low).toBe(115);
    expect(weekly[1].close).toBe(126);
  });

  it("aggregates daily into monthly across boundaries", () => {
    const monthly = aggregateToMonthly(dummyData);
    
    expect(monthly.length).toBe(2);
    
    // January data check
    expect(monthly[0].date).toBe("2024-01-01");
    expect(monthly[0].high).toBe(160);
    expect(monthly[0].low).toBe(80);
    expect(monthly[0].open).toBe(100);
    expect(monthly[0].close).toBe(155);
    expect(monthly[0].volume).toBe(13000);
    
    // February data check
    expect(monthly[1].date).toBe("2024-02-01");
    expect(monthly[1].high).toBe(165);
    expect(monthly[1].low).toBe(150);
    expect(monthly[1].close).toBe(160);
  });
});
