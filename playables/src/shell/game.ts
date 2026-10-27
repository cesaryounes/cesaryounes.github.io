/**
 * The contract between the shared shell and a puzzle game.
 *
 * The shell owns screens, the timer, streaks, saving and every ad call.
 * A game only generates levels, draws them, reacts to input, and reports
 * whether the current level is solved. Block puzzle and flow connect will
 * implement this same interface later.
 */

/** Everything a game needs to describe one level. Games extend this. */
export interface Level {
  /** Seed the level was generated from (daily seed or world/level seed). */
  seed: number;
  /** 1–100, passed in by the shell; the game decides what it means. */
  difficulty: number;
  /** Par time in milliseconds, used by the shell to award stars. */
  parMs: number;
}

/** Mutable per-attempt state. The shell creates it and owns the timer fields. */
export interface PlayState {
  level: Level;
  /** Milliseconds of play so far, maintained by the shell (paused while hidden). */
  elapsedMs: number;
  /** Number of player moves so far. */
  moves: number;
  /** Set once by the shell when isSolved() first returns true. */
  solved: boolean;
  /** Game-specific state (player position, trail, visited cells, …). */
  data: unknown;
}

export interface PuzzleGame {
  /** Stable id, e.g. "maze". Used as the save-state and reward-id prefix. */
  id: string;
  /** Pure: same seed + difficulty always yields the same level. */
  generate(seed: number, difficulty: number): Level;
  /** Fresh game-specific data for a new attempt at `level`. */
  newPlayState(level: Level): PlayState;
  render(ctx: CanvasRenderingContext2D, level: Level, state: PlayState): void;
  input(event: PointerEvent | KeyboardEvent, state: PlayState): void;
  isSolved(state: PlayState): boolean;
  /** What a rewarded ad unlocks (e.g. reveal the next cells of the solution). */
  hint(state: PlayState): void;
}
