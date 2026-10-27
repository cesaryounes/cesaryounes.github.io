/**
 * Entry point. index.html has already loaded the Playables SDK (or not, in
 * local dev) before this module runs.
 *
 * Milestone 1: boot the shell, draw a blank canvas sized to the viewport,
 * report firstFrameReady then gameReady, wire pause/resume, audio state and
 * error logging. The maze itself arrives in milestone 2.
 */

import { GameCanvas } from './shell/canvas';
import { getPlatform } from './shell/platform';
import { Storage } from './shell/storage';

const BACKGROUND = '#101418';

async function boot(): Promise<void> {
  const platform = getPlatform();

  // Any uncaught error is reported to YouTube's health signal.
  window.addEventListener('error', () => platform.logError());
  window.addEventListener('unhandledrejection', () => platform.logError());

  const canvasEl = document.getElementById('game');
  if (!(canvasEl instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');
  const canvas = new GameCanvas(canvasEl);

  const storage = new Storage(platform);
  await storage.load();

  // Audio: initialise from the platform and follow its changes. Never add an
  // in-game toggle that overrides this.
  let audioEnabled = platform.isAudioEnabled();
  platform.onAudioEnabledChange((enabled) => {
    audioEnabled = enabled;
  });

  // Pause/resume: stop the loop and save. Resume may never come.
  let paused = false;
  let frame = 0;
  const draw = (): void => {
    const { width, height } = canvas.size;
    const ctx = canvas.ctx;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, width, height);
  };
  const loop = (): void => {
    if (paused) return;
    draw();
    frame = requestAnimationFrame(loop);
  };
  platform.onPause(() => {
    paused = true;
    cancelAnimationFrame(frame);
    void storage.flush();
  });
  platform.onResume(() => {
    if (!paused) return;
    paused = false;
    loop();
  });
  canvas.onResize(draw);

  // First frame, then ready: nothing else loads, so the game is interactable
  // as soon as the first frame is on screen.
  draw();
  platform.firstFrameReady();
  loop();
  platform.gameReady();

  if (!platform.inPlayables) {
    console.info(
      `[shell] booted in dev mode; audio ${audioEnabled ? 'on' : 'off'}, ` +
        `language ${await platform.getLanguage()}`,
    );
  }
}

boot().catch((err) => {
  console.error('boot failed', err);
  getPlatform().logError();
});
