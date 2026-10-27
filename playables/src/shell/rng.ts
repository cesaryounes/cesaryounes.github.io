/**
 * Seeded random numbers.
 *
 * Every generator in every game must draw its randomness from here so that
 * the same seed produces the same level on every device, forever. Never use
 * Math.random() in level generation.
 */

/** A deterministic random source. */
export interface Rng {
  /** Float in [0, 1), like Math.random(). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability `p` (default 0.5). */
  chance(p?: number): boolean;
  /** A uniformly chosen element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle, in place, returned for chaining. */
  shuffle<T>(items: T[]): T[];
}

/** mulberry32: tiny, fast, good enough for puzzle generation. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) [min, max] = [max, min];
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p = 0.5) {
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() from empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i] as (typeof items)[number];
        items[i] = items[j] as (typeof items)[number];
        items[j] = tmp;
      }
      return items;
    },
  };
  return rng;
}

/**
 * Mix a 32-bit integer so that nearby inputs (consecutive days, consecutive
 * levels) give unrelated seeds. Based on the lowbias32 hash.
 */
export function hash32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Combine two integers into one well-mixed 32-bit seed. */
export function combineSeeds(a: number, b: number): number {
  return hash32((hash32(a) ^ Math.imul(b >>> 0, 0x9e3779b1)) >>> 0);
}

/** Days since 1970-01-01 in UTC. The same for every player on the same UTC day. */
export function utcDayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/** The UTC calendar date as "YYYY-MM-DD"; used as the daily-challenge key. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Seed for the daily challenge. Depends only on the UTC date, so every player
 * in the world gets the same daily puzzle regardless of time zone.
 */
export function dailySeed(date: Date = new Date()): number {
  // 0x44414c59 = "DALY": a fixed salt so daily seeds never collide with level seeds.
  return combineSeeds(0x44414c59, utcDayNumber(date));
}

/**
 * Seed for a campaign level. Depends only on world and level number, so
 * level 3-7 is the same maze on every device.
 */
export function levelSeed(world: number, level: number): number {
  return combineSeeds(0x4c56454c + world * 1000, level);
}
