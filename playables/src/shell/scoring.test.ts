import { describe, expect, it } from 'vitest';
import { formatTime, starsFor } from './scoring';

describe('starsFor', () => {
  it('awards 3 at or under par, 2 up to 1.5× par, else 1', () => {
    expect(starsFor(9_000, 10_000)).toBe(3);
    expect(starsFor(10_000, 10_000)).toBe(3);
    expect(starsFor(14_999, 10_000)).toBe(2);
    expect(starsFor(15_000, 10_000)).toBe(2);
    expect(starsFor(15_001, 10_000)).toBe(1);
    expect(starsFor(600_000, 10_000)).toBe(1);
  });
});

describe('formatTime', () => {
  it('formats seconds and minutes', () => {
    expect(formatTime(0)).toBe('0.0s');
    expect(formatTime(12_345)).toBe('12.3s');
    expect(formatTime(65_200)).toBe('1:05.2');
    expect(formatTime(-5)).toBe('0.0s');
  });
});
