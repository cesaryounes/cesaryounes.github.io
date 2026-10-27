/**
 * The maze game: implements PuzzleGame. Knows nothing about ads, saving,
 * screens or the timer; the shell owns those.
 */

import type { Level, PlayState, PuzzleGame, Rect } from '../../shell/game';
import {
  DIRS,
  E,
  generateMaze,
  N,
  parTimeMs,
  S,
  sizeForDifficulty,
  W,
  type Dir,
  type Maze,
} from './generator';
import { slidePath } from './movement';
import { renderMaze, spawnConfetti, spawnDust, type Particle } from './render';

export interface MazeLevel extends Level {
  maze: Maze;
}

export interface MazeData {
  /** Logical position: where the character is or will be when the slide ends. */
  pos: number;
  /** Cells of the slide in progress, from the previous position, for animation. */
  slide: number[];
  slideFrom: number;
  slideStartMs: number;
  slideDurMs: number;
  /** Direction of the current or last move, for squash and eye direction. */
  facing: Dir;
  /** A direction swiped while sliding, applied when the slide ends. */
  queued: Dir | null;
  /** Every cell visited, in order, including backtracking: the trail. */
  trail: number[];
  /** Cells of the solution revealed by a hint, drawn as a dotted path. */
  revealed: number[];
  /** Pointer origin for swipe/drag detection, in CSS pixels. */
  pointer: { id: number; x: number; y: number } | null;
  /** Clock value when the exit was reached; drives the arrival burst. */
  solvedAtMs: number | null;
  /** Live dust and confetti. Purely visual. */
  particles: Particle[];
}

const SWIPE_PX = 18;
const HINT_CELLS = 8;

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: N,
  ArrowRight: E,
  ArrowDown: S,
  ArrowLeft: W,
  w: N,
  d: E,
  s: S,
  a: W,
  W: N,
  D: E,
  S: S,
  A: W,
};

export function isMazeLevel(level: Level): level is MazeLevel {
  return 'maze' in level;
}

function data(state: PlayState): MazeData {
  return state.data as MazeData;
}

function isSliding(d: MazeData, nowMs: number): boolean {
  return d.slide.length > 0 && nowMs < d.slideStartMs + d.slideDurMs;
}

function startSlide(level: MazeLevel, state: PlayState, dir: Dir): void {
  const d = data(state);
  d.facing = dir;
  const path = slidePath(level.maze, d.pos, dir, level.maze.end);
  if (path.length === 0) return;
  d.slideFrom = d.pos;
  d.slide = path;
  d.slideStartMs = state.elapsedMs;
  d.slideDurMs = Math.min(300, Math.max(70, 45 * path.length));
  d.pos = path[path.length - 1]!;
  d.trail.push(...path);
  state.moves++;
}

function tryMove(level: MazeLevel, state: PlayState, dir: Dir): void {
  const d = data(state);
  if (d.solvedAtMs !== null) return;
  if (isSliding(d, state.elapsedMs)) {
    d.queued = dir;
    return;
  }
  startSlide(level, state, dir);
}

export const mazeGame: PuzzleGame = {
  id: 'maze',

  generate(seed, difficulty): MazeLevel {
    // Loops arrive with world 3 (milestone 6); until then every maze is perfect.
    const maze = generateMaze(seed, sizeForDifficulty(difficulty), 0);
    return { seed, difficulty, parMs: parTimeMs(maze), maze };
  },

  newPlayState(level, view: Rect): PlayState {
    if (!isMazeLevel(level)) throw new Error('not a maze level');
    const d: MazeData = {
      pos: level.maze.start,
      slide: [],
      slideFrom: level.maze.start,
      slideStartMs: 0,
      slideDurMs: 1,
      facing: E,
      queued: null,
      trail: [level.maze.start],
      revealed: [],
      pointer: null,
      solvedAtMs: null,
      particles: [],
    };
    return { level, view, elapsedMs: 0, moves: 0, solved: false, data: d };
  },

  render(ctx, level, state) {
    if (!isMazeLevel(level)) return;
    const d = data(state);
    // Slides finish on the clock; a queued swipe starts the next one.
    if (!isSliding(d, state.elapsedMs)) {
      if (d.slide.length > 0) {
        d.slide = [];
        spawnDust(d, level, state.elapsedMs, d.facing);
      }
      if (d.solvedAtMs === null && d.pos === level.maze.end) {
        d.solvedAtMs = state.elapsedMs;
        spawnConfetti(d, level, state.elapsedMs);
      }
      if (d.queued !== null) {
        const next = d.queued;
        d.queued = null;
        if (d.solvedAtMs === null) startSlide(level, state, next);
      }
    }
    renderMaze(ctx, level, state, d);
  },

  input(event, state) {
    const level = state.level;
    if (!isMazeLevel(level)) return;
    const d = data(state);

    if (event instanceof KeyboardEvent) {
      if (event.type !== 'keydown' || event.repeat) return;
      const dir = KEY_DIRS[event.key];
      if (dir === undefined) return;
      event.preventDefault();
      tryMove(level, state, dir);
      return;
    }

    switch (event.type) {
      case 'pointerdown':
        d.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        break;
      case 'pointermove': {
        if (!d.pointer || d.pointer.id !== event.pointerId) return;
        const dx = event.clientX - d.pointer.x;
        const dy = event.clientY - d.pointer.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
        const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? E : W) : dy > 0 ? S : N;
        // Dragging keeps moving: re-anchor so the next segment counts afresh.
        d.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        tryMove(level, state, dir);
        break;
      }
      case 'pointerup':
      case 'pointercancel':
        if (d.pointer && d.pointer.id === event.pointerId) d.pointer = null;
        break;
    }
  },

  isSolved(state) {
    const d = data(state);
    return d.solvedAtMs !== null;
  },

  hint(state) {
    const level = state.level;
    if (!isMazeLevel(level)) return;
    const d = data(state);
    // Reveal the next cells of the solution from the player's current cell
    // (or from the nearest solution cell already reached).
    const sol = level.maze.solution;
    let at = sol.indexOf(d.pos);
    if (at < 0) {
      // Off the solution: reveal from the last solution cell on the trail.
      for (let i = d.trail.length - 1; i >= 0 && at < 0; i--) at = sol.indexOf(d.trail[i]!);
      if (at < 0) at = 0;
    }
    d.revealed = sol.slice(at, Math.min(sol.length, at + HINT_CELLS + 1));
  },
};

export { DIRS };
