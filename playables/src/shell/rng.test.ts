import { describe, expect, it } from 'vitest';
import {
  combineSeeds,
  dailySeed,
  hash32,
  levelSeed,
  mulberry32,
  utcDateKey,
  utcDayNumber,
} from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('produces a known sequence (guards against accidental algorithm changes)', () => {
    const rng = mulberry32(42);
    const seq = Array.from({ length: 4 }, () => Math.round(rng.next() * 1e6));
    // Values for mulberry32 with seed 42; if this changes, every level changes.
    expect(seq).toMatchInlineSnapshot(`
      [
        601104,
        448291,
        852466,
        669734,
      ]
    `);
  });

  it('next() stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive on both ends and covers the range', () => {
    const rng = mulberry32(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('shuffle() keeps the same elements and is deterministic', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = mulberry32(5).shuffle([...items]);
    const b = mulberry32(5).shuffle([...items]);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(items);
  });

  it('pick() throws on an empty array', () => {
    expect(() => mulberry32(1).pick([])).toThrow();
  });
});

describe('hash32 / combineSeeds', () => {
  it('spreads consecutive inputs apart', () => {
    const seeds = new Set(Array.from({ length: 1000 }, (_, i) => hash32(i)));
    expect(seeds.size).toBe(1000);
  });

  it('combineSeeds is order-sensitive', () => {
    expect(combineSeeds(1, 2)).not.toBe(combineSeeds(2, 1));
  });
});

describe('dailySeed', () => {
  it('is the same at any time on the same UTC day', () => {
    const morning = new Date('2026-10-27T00:00:01Z');
    const night = new Date('2026-10-27T23:59:59Z');
    expect(dailySeed(morning)).toBe(dailySeed(night));
  });

  it('changes at UTC midnight, not local midnight', () => {
    const before = new Date('2026-10-27T23:59:59Z');
    const after = new Date('2026-10-28T00:00:00Z');
    expect(dailySeed(before)).not.toBe(dailySeed(after));
    expect(utcDayNumber(after)).toBe(utcDayNumber(before) + 1);
  });

  it('is stable across runs (every player must agree)', () => {
    expect(dailySeed(new Date('2026-10-27T12:00:00Z'))).toBe(4014248870);
  });

  it('gives distinct seeds for a year of days', () => {
    const start = Date.UTC(2026, 0, 1);
    const seeds = new Set<number>();
    for (let d = 0; d < 366; d++) seeds.add(dailySeed(new Date(start + d * 86_400_000)));
    expect(seeds.size).toBe(366);
  });

  it('utcDateKey formats the UTC date', () => {
    expect(utcDateKey(new Date('2026-10-27T23:30:00Z'))).toBe('2026-10-27');
    expect(utcDateKey(new Date('2026-10-28T00:30:00Z'))).toBe('2026-10-28');
  });
});

describe('levelSeed', () => {
  it('is deterministic and distinct per world/level', () => {
    expect(levelSeed(1, 1)).toBe(levelSeed(1, 1));
    const seeds = new Set<number>();
    for (let w = 1; w <= 5; w++) for (let l = 1; l <= 20; l++) seeds.add(levelSeed(w, l));
    expect(seeds.size).toBe(100);
  });

  it('never collides with a daily seed in the first ten years', () => {
    const levels = new Set<number>();
    for (let w = 1; w <= 5; w++) for (let l = 1; l <= 20; l++) levels.add(levelSeed(w, l));
    const start = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 3660; d++) {
      expect(levels.has(dailySeed(new Date(start + d * 86_400_000)))).toBe(false);
    }
  });
});
