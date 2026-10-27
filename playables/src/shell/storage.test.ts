import { describe, expect, it } from 'vitest';
import type { Platform } from './platform';
import {
  defaultSaveState,
  levelsCleared,
  parseSaveState,
  serializeSaveState,
  Storage,
} from './storage';

function fakePlatform(initial: string | null = null): Platform & { writes: string[] } {
  let stored = initial;
  const writes: string[] = [];
  return {
    writes,
    inPlayables: false,
    firstFrameReady() {},
    gameReady() {},
    async saveData(json) {
      stored = json;
      writes.push(json);
      return true;
    },
    async loadData() {
      return stored;
    },
    isAudioEnabled: () => true,
    onAudioEnabledChange: () => () => {},
    onPause: () => () => {},
    onResume: () => () => {},
    getLanguage: async () => 'en',
    requestInterstitialAd: async () => true,
    requestRewardedAd: async () => true,
    sendScore: async () => {},
    logError() {},
    logWarning() {},
  };
}

describe('parseSaveState', () => {
  it('returns defaults for empty, null or garbage input', () => {
    expect(parseSaveState(null)).toEqual(defaultSaveState());
    expect(parseSaveState('')).toEqual(defaultSaveState());
    expect(parseSaveState('{not json')).toEqual(defaultSaveState());
    expect(parseSaveState('[1,2]')).toEqual(defaultSaveState());
  });

  it('round-trips a full state', () => {
    const state = defaultSaveState();
    state.games.maze = {
      levels: { '1-1': { stars: 3, bestMs: 4200, fails: 0 } },
      daily: { '2026-10-27': { timeMs: 30_000, hintUsed: false } },
      streak: { count: 4, lastClearDate: '2026-10-27', shieldUsedDate: null },
    };
    state.ads.totalCompletes = 7;
    state.settings.haptics = false;
    expect(parseSaveState(serializeSaveState(state))).toEqual(state);
  });

  it('fills missing fields from an older or partial save', () => {
    const parsed = parseSaveState('{"games":{"maze":{"streak":{"count":2}}}}');
    expect(parsed.games.maze?.streak).toEqual({
      count: 2,
      lastClearDate: null,
      shieldUsedDate: null,
    });
    expect(parsed.games.maze?.levels).toEqual({});
    expect(parsed.settings).toEqual(defaultSaveState().settings);
    expect(parsed.ads).toEqual(defaultSaveState().ads);
  });
});

describe('levelsCleared', () => {
  it('counts only levels with at least one star', () => {
    const g = {
      levels: {
        '1-1': { stars: 3 as const, bestMs: 1, fails: 0 },
        '1-2': { stars: 1 as const, bestMs: 1, fails: 0 },
        '1-3': { stars: 0 as const, bestMs: null, fails: 2 },
      },
      daily: {},
      streak: { count: 0, lastClearDate: null, shieldUsedDate: null },
    };
    expect(levelsCleared(g)).toBe(2);
  });
});

describe('Storage', () => {
  it('loads what was saved', async () => {
    const platform = fakePlatform();
    const a = new Storage(platform);
    await a.load();
    await a.update((s) => {
      s.ads.totalCompletes = 3;
    });
    a.game('maze').streak.count = 5;
    await a.save();

    const b = new Storage(platform);
    const loaded = await b.load();
    expect(loaded.ads.totalCompletes).toBe(3);
    expect(loaded.games.maze?.streak.count).toBe(5);
  });

  it('coalesces several save() calls into one write', async () => {
    const platform = fakePlatform();
    const s = new Storage(platform);
    await s.load();
    void s.save();
    void s.save();
    await s.save();
    expect(platform.writes).toHaveLength(1);
  });

  it('reset() clears progress and writes immediately', async () => {
    const platform = fakePlatform();
    const s = new Storage(platform);
    await s.load();
    s.game('maze').streak.count = 9;
    await s.reset();
    expect(s.get()).toEqual(defaultSaveState());
    expect(platform.writes).toHaveLength(1);
  });
});
