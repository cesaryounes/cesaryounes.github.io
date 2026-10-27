/**
 * Entry point. index.html has already loaded the Playables SDK (or not, in
 * local dev) before this module runs.
 *
 * Milestone 2: boot the shell, run the maze play loop with a minimal result
 * overlay so a 7×7 and a 25×25 can be cleared on a phone. Real screens and
 * progression arrive in milestone 3.
 */

import { mazeGame } from './games/maze';
import { GameCanvas } from './shell/canvas';
import { getPlatform } from './shell/platform';
import { PlaySession } from './shell/play';
import { levelSeed } from './shell/rng';
import { formatTime, starsFor } from './shell/scoring';
import { Storage } from './shell/storage';

async function boot(): Promise<void> {
  const platform = getPlatform();

  // Any uncaught error is reported to YouTube's health signal.
  window.addEventListener('error', () => platform.logError());
  window.addEventListener('unhandledrejection', () => platform.logError());

  const canvasEl = document.getElementById('game');
  const screens = document.getElementById('screens');
  if (!(canvasEl instanceof HTMLCanvasElement) || !screens) throw new Error('markup missing');
  const canvas = new GameCanvas(canvasEl);

  const storage = new Storage(platform);
  await storage.load();

  // Audio: initialise from the platform and follow its changes. Never add an
  // in-game toggle that overrides this. (Used by audio.ts in milestone 5.)
  let audioEnabled = platform.isAudioEnabled();
  platform.onAudioEnabledChange((enabled) => {
    audioEnabled = enabled;
  });

  let session: PlaySession | null = null;
  let paused = false;
  let difficulty = 1;
  let attempt = 0;

  const showOverlay = (html: string): void => {
    screens.innerHTML = `<div class="panel">${html}</div>`;
  };
  const hideOverlay = (): void => {
    screens.innerHTML = '';
  };

  const play = (nextDifficulty: number): void => {
    difficulty = nextDifficulty;
    session?.destroy();
    hideOverlay();
    // Milestone 2: seed from difficulty + attempt so "play again" gives a new maze.
    const level = mazeGame.generate(levelSeed(0, difficulty * 1000 + attempt), difficulty);
    attempt++;
    session = new PlaySession(mazeGame, canvas, level, {
      onSolved(state) {
        const stars = starsFor(state.elapsedMs, state.level.parMs);
        showOverlay(`
          <h1>Solved</h1>
          <p class="time">${formatTime(state.elapsedMs)}</p>
          <p class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}
            <span class="par">par ${formatTime(state.level.parMs)}</span></p>
          <p>${state.moves} moves</p>
          <div class="row">
            <button data-d="${difficulty}">Play again</button>
            <button data-d="${Math.min(100, difficulty + 10)}" class="primary">Bigger</button>
          </div>
          <div class="row small">
            <button data-d="1">7×7</button>
            <button data-d="50">15×15</button>
            <button data-d="100">25×25</button>
          </div>`);
      },
    });
    session.draw();
    if (!paused) session.start();
  };

  screens.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.d) return;
    play(Number(target.dataset.d));
  });

  // Pause/resume: stop the loop and save. Resume may never come.
  platform.onPause(() => {
    paused = true;
    session?.pause();
    void storage.flush();
  });
  platform.onResume(() => {
    if (!paused) return;
    paused = false;
    session?.resume();
  });
  canvas.onResize(() => session?.draw());

  // First frame, then ready: nothing else loads, so the game is interactable
  // as soon as the first frame is on screen.
  play(1);
  platform.firstFrameReady();
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
