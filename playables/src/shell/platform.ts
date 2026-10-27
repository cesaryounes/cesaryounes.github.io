/**
 * The only place in the codebase that talks to the YouTube Playables SDK.
 *
 * Inside Playables (`ytgame.IN_PLAYABLES_ENV`) every call goes to the real
 * `window.ytgame`. Outside (plain `vite dev`, or the bundle opened from disk)
 * a mock with the same surface is installed so the game can be played and
 * tested locally. Games never import this file; the shell does.
 *
 * SDK reference: https://developers.google.com/youtube/gaming/playables/reference/sdk
 */

export type Unsubscribe = () => void;

/** Shape of the `ytgame` global this shell relies on. */
export interface YtGameSdk {
  IN_PLAYABLES_ENV: boolean;
  SDK_VERSION?: string;
  game: {
    firstFrameReady(): void;
    gameReady(): void;
    saveData(data: string): Promise<void>;
    loadData(): Promise<string>;
  };
  system: {
    isAudioEnabled(): boolean;
    onAudioEnabledChange(cb: (enabled: boolean) => void): Unsubscribe;
    onPause(cb: () => void): Unsubscribe;
    onResume(cb: () => void): Unsubscribe;
    getLanguage(): Promise<string>;
  };
  ads: {
    requestInterstitialAd(): Promise<void>;
    requestRewardedAd(rewardId?: string): Promise<boolean>;
  };
  engagement: {
    sendScore(score: { value: number }): Promise<void>;
  };
  health: {
    logError(): void;
    logWarning(): void;
  };
}

declare global {
  interface Window {
    ytgame?: YtGameSdk;
    /** Dev-only handle for poking the mock from the browser console. */
    __ytgameMock?: MockControls;
  }
}

/** Console controls exposed by the mock so pause/mute/ads can be tested by hand. */
export interface MockControls {
  setAudioEnabled(enabled: boolean): void;
  pause(): void;
  resume(): void;
  /** What the next rewarded ad resolves to (default true). */
  rewardedResult: boolean;
  /** Whether the next interstitial rejects (default false). */
  interstitialFails: boolean;
  /** Clear the mock save slot. */
  clearSave(): void;
}

const MOCK_SAVE_KEY = 'playables:mock-save';

function log(...args: unknown[]): void {
  console.info('[ytgame mock]', ...args);
}

/** Build the mock SDK used when the real one is absent. */
export function createMockSdk(): { sdk: YtGameSdk; controls: MockControls } {
  let audioEnabled = true;
  const audioListeners = new Set<(enabled: boolean) => void>();
  const pauseListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();

  const controls: MockControls = {
    rewardedResult: true,
    interstitialFails: false,
    setAudioEnabled(enabled) {
      if (audioEnabled === enabled) return;
      audioEnabled = enabled;
      log('audio enabled ->', enabled);
      audioListeners.forEach((cb) => cb(enabled));
    },
    pause() {
      log('pause');
      pauseListeners.forEach((cb) => cb());
    },
    resume() {
      log('resume');
      resumeListeners.forEach((cb) => cb());
    },
    clearSave() {
      localStorage.removeItem(MOCK_SAVE_KEY);
      log('save cleared');
    },
  };

  const sdk: YtGameSdk = {
    IN_PLAYABLES_ENV: false,
    SDK_VERSION: 'mock',
    game: {
      firstFrameReady: () => log('firstFrameReady()'),
      gameReady: () => log('gameReady()'),
      async saveData(data) {
        localStorage.setItem(MOCK_SAVE_KEY, data);
        log(`saveData(${data.length} chars)`);
      },
      async loadData() {
        const data = localStorage.getItem(MOCK_SAVE_KEY) ?? '';
        log(`loadData() -> ${data.length} chars`);
        return data;
      },
    },
    system: {
      isAudioEnabled: () => audioEnabled,
      onAudioEnabledChange(cb) {
        audioListeners.add(cb);
        return () => audioListeners.delete(cb);
      },
      onPause(cb) {
        pauseListeners.add(cb);
        return () => pauseListeners.delete(cb);
      },
      onResume(cb) {
        resumeListeners.add(cb);
        return () => resumeListeners.delete(cb);
      },
      getLanguage: async () => navigator.language || 'en',
    },
    ads: {
      async requestInterstitialAd() {
        log('requestInterstitialAd()', controls.interstitialFails ? '-> reject' : '-> shown');
        if (controls.interstitialFails) throw new Error('mock interstitial failed');
      },
      async requestRewardedAd(rewardId) {
        log(`requestRewardedAd(${rewardId ?? ''}) ->`, controls.rewardedResult);
        return controls.rewardedResult;
      },
    },
    engagement: {
      async sendScore(score) {
        log('sendScore', score);
      },
    },
    health: {
      logError: () => log('health.logError()'),
      logWarning: () => log('health.logWarning()'),
    },
  };

  return { sdk, controls };
}

/**
 * What the rest of the shell uses. Same surface as the SDK, flattened, and
 * with every failure mode handled here so callers never need try/catch.
 */
export interface Platform {
  /** True when running inside YouTube; false in local dev. */
  readonly inPlayables: boolean;
  /** Call once the first frame has been drawn. */
  firstFrameReady(): void;
  /** Call once the player can interact. Never while a loading screen shows. */
  gameReady(): void;
  /** Persist one JSON string (max 3 MiB). Resolves false if saving failed. */
  saveData(json: string): Promise<boolean>;
  /** Load the saved JSON string, or null if none or on failure. */
  loadData(): Promise<string | null>;
  isAudioEnabled(): boolean;
  onAudioEnabledChange(cb: (enabled: boolean) => void): Unsubscribe;
  onPause(cb: () => void): Unsubscribe;
  onResume(cb: () => void): Unsubscribe;
  /** BCP-47 language tag, e.g. "en" or "de-DE". Falls back to "en". */
  getLanguage(): Promise<string>;
  /** Resolves when the ad closed or failed; never rejects. Returns whether it was shown. */
  requestInterstitialAd(): Promise<boolean>;
  /** Resolves true only when the player earned the reward; never rejects. */
  requestRewardedAd(rewardId: string): Promise<boolean>;
  /** Report the single integer engagement score. Never rejects. */
  sendScore(value: number): Promise<void>;
  logError(): void;
  logWarning(): void;
}

const MAX_SAVE_BYTES = 3 * 1024 * 1024;

function wrap(sdk: YtGameSdk): Platform {
  const inPlayables = Boolean(sdk.IN_PLAYABLES_ENV);
  let firstFrameSent = false;
  let readySent = false;

  return {
    inPlayables,
    firstFrameReady() {
      if (firstFrameSent) return;
      firstFrameSent = true;
      try {
        sdk.game.firstFrameReady();
      } catch (err) {
        console.error('firstFrameReady failed', err);
      }
    },
    gameReady() {
      if (readySent) return;
      if (!firstFrameSent) this.firstFrameReady();
      readySent = true;
      try {
        sdk.game.gameReady();
      } catch (err) {
        console.error('gameReady failed', err);
      }
    },
    async saveData(json) {
      if (new TextEncoder().encode(json).byteLength > MAX_SAVE_BYTES) {
        console.error('saveData: payload exceeds 3 MiB, not saved');
        this.logError();
        return false;
      }
      try {
        await sdk.game.saveData(json);
        return true;
      } catch (err) {
        console.error('saveData failed', err);
        this.logWarning();
        return false;
      }
    },
    async loadData() {
      try {
        const data = await sdk.game.loadData();
        return data ? data : null;
      } catch (err) {
        console.error('loadData failed', err);
        this.logWarning();
        return null;
      }
    },
    isAudioEnabled() {
      try {
        return sdk.system.isAudioEnabled();
      } catch {
        return false;
      }
    },
    onAudioEnabledChange: (cb) => sdk.system.onAudioEnabledChange(cb),
    onPause: (cb) => sdk.system.onPause(cb),
    onResume: (cb) => sdk.system.onResume(cb),
    async getLanguage() {
      try {
        return (await sdk.system.getLanguage()) || 'en';
      } catch {
        return 'en';
      }
    },
    async requestInterstitialAd() {
      try {
        await sdk.ads.requestInterstitialAd();
        return true;
      } catch (err) {
        console.warn('interstitial not shown', err);
        return false;
      }
    },
    async requestRewardedAd(rewardId) {
      try {
        return (await sdk.ads.requestRewardedAd(rewardId)) === true;
      } catch (err) {
        console.warn('rewarded ad not shown', err);
        return false;
      }
    },
    async sendScore(value) {
      try {
        await sdk.engagement.sendScore({ value: Math.max(0, Math.floor(value)) });
      } catch (err) {
        console.warn('sendScore failed', err);
      }
    },
    logError() {
      try {
        sdk.health.logError();
      } catch {
        /* nothing more we can do */
      }
    },
    logWarning() {
      try {
        sdk.health.logWarning();
      } catch {
        /* nothing more we can do */
      }
    },
  };
}

let instance: Platform | undefined;

/**
 * The platform singleton. Uses the real SDK when index.html loaded it and we
 * are inside Playables; otherwise installs and uses the mock.
 */
export function getPlatform(): Platform {
  if (instance) return instance;
  const real = window.ytgame;
  if (real && real.IN_PLAYABLES_ENV) {
    instance = wrap(real);
  } else {
    const { sdk, controls } = createMockSdk();
    window.ytgame = sdk;
    window.__ytgameMock = controls;
    log('SDK absent or not in Playables; mock installed. Use window.__ytgameMock to test.');
    instance = wrap(sdk);
  }
  return instance;
}

/** Test seam: force a specific SDK (real or mock) for the rest of the session. */
export function setPlatformForTests(sdk: YtGameSdk): Platform {
  instance = wrap(sdk);
  return instance;
}
