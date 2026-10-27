/**
 * One SaveState for everything the player keeps: progress, best times,
 * streak, settings and the ad frequency cap. Serialised as a single JSON
 * string and stored through the platform (YouTube save inside Playables,
 * localStorage via the mock outside).
 */

import type { Platform } from './platform';

export const SAVE_VERSION = 1;

/** Per-level record. Key is `${world}-${level}`. */
export interface LevelRecord {
  stars: 0 | 1 | 2 | 3;
  bestMs: number | null;
  /** Failed attempts (over 3× par) since the last clear; drives the skip offer. */
  fails: number;
}

export interface StreakState {
  /** Consecutive UTC days with a daily clear. */
  count: number;
  /** UTC date key ("YYYY-MM-DD") of the last daily clear, or null. */
  lastClearDate: string | null;
  /** UTC date key the streak shield was last used on, or null. */
  shieldUsedDate: string | null;
}

export interface DailyRecord {
  timeMs: number;
  /** Whether the "show the way" hint was used that day. */
  hintUsed: boolean;
}

export interface AdCapState {
  /** Epoch ms of the last interstitial shown, or 0. */
  lastInterstitialAt: number;
  /** Level completes since the last interstitial. */
  completesSinceInterstitial: number;
  /** Total level completes ever (interstitials are skipped for the first few). */
  totalCompletes: number;
}

export interface Settings {
  /** Haptics on supported devices. Audio has no in-game toggle: Playables owns it. */
  haptics: boolean;
  /** Language override; null means use the platform language. */
  language: string | null;
}

export interface SaveState {
  version: number;
  /** Per game id, e.g. "maze". */
  games: Record<string, GameSave>;
  settings: Settings;
  ads: AdCapState;
}

export interface GameSave {
  levels: Record<string, LevelRecord>;
  /** Best daily result per UTC date key. */
  daily: Record<string, DailyRecord>;
  streak: StreakState;
}

export function defaultGameSave(): GameSave {
  return {
    levels: {},
    daily: {},
    streak: { count: 0, lastClearDate: null, shieldUsedDate: null },
  };
}

export function defaultSaveState(): SaveState {
  return {
    version: SAVE_VERSION,
    games: {},
    settings: { haptics: true, language: null },
    ads: { lastInterstitialAt: 0, completesSinceInterstitial: 0, totalCompletes: 0 },
  };
}

/** Total levels cleared across all worlds for a game; the score sent to YouTube. */
export function levelsCleared(save: GameSave): number {
  return Object.values(save.levels).filter((r) => r.stars > 0).length;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse a saved JSON string into a SaveState, filling in anything missing
 * with defaults. Never throws: a corrupt save yields a fresh state.
 */
export function parseSaveState(json: string | null | undefined): SaveState {
  const base = defaultSaveState();
  if (!json) return base;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return base;
  }
  if (!isObject(raw)) return base;

  const games: Record<string, GameSave> = {};
  if (isObject(raw.games)) {
    for (const [id, g] of Object.entries(raw.games)) {
      if (!isObject(g)) continue;
      const d = defaultGameSave();
      const streak = isObject(g.streak) ? g.streak : {};
      games[id] = {
        levels: isObject(g.levels) ? (g.levels as Record<string, LevelRecord>) : d.levels,
        daily: isObject(g.daily) ? (g.daily as Record<string, DailyRecord>) : d.daily,
        streak: {
          count: typeof streak.count === 'number' ? streak.count : 0,
          lastClearDate: typeof streak.lastClearDate === 'string' ? streak.lastClearDate : null,
          shieldUsedDate: typeof streak.shieldUsedDate === 'string' ? streak.shieldUsedDate : null,
        },
      };
    }
  }

  const settings = isObject(raw.settings) ? raw.settings : {};
  const ads = isObject(raw.ads) ? raw.ads : {};

  return {
    version: SAVE_VERSION,
    games,
    settings: {
      haptics: typeof settings.haptics === 'boolean' ? settings.haptics : base.settings.haptics,
      language: typeof settings.language === 'string' ? settings.language : null,
    },
    ads: {
      lastInterstitialAt: typeof ads.lastInterstitialAt === 'number' ? ads.lastInterstitialAt : 0,
      completesSinceInterstitial:
        typeof ads.completesSinceInterstitial === 'number' ? ads.completesSinceInterstitial : 0,
      totalCompletes: typeof ads.totalCompletes === 'number' ? ads.totalCompletes : 0,
    },
  };
}

export function serializeSaveState(state: SaveState): string {
  return JSON.stringify(state);
}

/**
 * Owns the in-memory SaveState and writes it through the platform.
 * Writes are coalesced: many `save()` calls in one frame produce one write.
 */
export class Storage {
  private state: SaveState = defaultSaveState();
  private pending: Promise<boolean> | null = null;
  private dirty = false;

  constructor(private readonly platform: Platform) {}

  /** Load from the platform. Call once at start-up before anything reads state. */
  async load(): Promise<SaveState> {
    this.state = parseSaveState(await this.platform.loadData());
    return this.state;
  }

  get(): SaveState {
    return this.state;
  }

  /** Per-game slice, created on first access. */
  game(id: string): GameSave {
    let g = this.state.games[id];
    if (!g) {
      g = defaultGameSave();
      this.state.games[id] = g;
    }
    return g;
  }

  /** Mutate state and schedule a write. */
  update(fn: (state: SaveState) => void): Promise<boolean> {
    fn(this.state);
    return this.save();
  }

  /** Write the current state. Safe to call often. */
  save(): Promise<boolean> {
    this.dirty = true;
    if (!this.pending) {
      this.pending = Promise.resolve().then(() => this.flush());
    }
    return this.pending;
  }

  /** Write now, bypassing coalescing. Use on pause, when resume may never come. */
  async flush(): Promise<boolean> {
    this.pending = null;
    if (!this.dirty) return true;
    this.dirty = false;
    return this.platform.saveData(serializeSaveState(this.state));
  }

  /** Forget everything (for a "reset progress" setting). */
  async reset(): Promise<boolean> {
    this.state = defaultSaveState();
    this.dirty = true;
    return this.flush();
  }
}
