import { describe, it, expect } from 'vitest';
import { generateSemanticPrompt } from '../semantic-translator';
import { DayData } from '../types';

describe('Semantic Translator', () => {
  it('should generate a valid prompt string containing the data table', () => {
    const mockData: DayData[] = [
      { date: '2023-01-01', open: 100, high: 105, low: 95, close: 102, volume: 10000 },
      { date: '2023-01-02', open: 102, high: 110, low: 100, close: 108, volume: 15000 }
    ];

    const prompt = generateSemanticPrompt(mockData);

    expect(prompt).toContain('Current Price: 108');
    expect(prompt).toContain('10-Day High: 110');
    expect(prompt).toContain('10-Day Low: 95');
    expect(prompt).toContain('2023-01-01 | 100 | 105 | 95 | 102 | 10000');
    expect(prompt).toContain('"verdict": "Bullish" | "Bearish" | "Neutral"');
  });

  it('should throw error if empty array', () => {
    expect(() => generateSemanticPrompt([])).toThrow('No DayData provided');
  });
});
