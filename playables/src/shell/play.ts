/**
 * One attempt at one level. Owns the timer, routes input to the game, checks
 * for a win and draws the HUD. Pausing freezes the clock; the game uses
 * `state.elapsedMs` for its animations so they freeze too.
 */

import type { GameCanvas } from './canvas';
import type { Level, PlayState, PuzzleGame, Rect } from './game';
import { formatTime } from './scoring';

export const HUD_HEIGHT = 56;

export interface PlaySessionOptions {
  onSolved(state: PlayState): void;
}

export class PlaySession {
  readonly state: PlayState;
  private running = false;
  private lastNow = 0;
  private frame = 0;
  private readonly unlisten: Array<() => void> = [];

  constructor(
    private readonly game: PuzzleGame,
    private readonly canvas: GameCanvas,
    readonly level: Level,
    private readonly options: PlaySessionOptions,
  ) {
    this.state = game.newPlayState(level, this.viewRect());
    this.listen();
  }

  private viewRect(): Rect {
    const { width, height } = this.canvas.size;
    const bottom = 16;
    return { x: 0, y: HUD_HEIGHT, width, height: Math.max(1, height - HUD_HEIGHT - bottom) };
  }

  private listen(): void {
    const el = this.canvas.el;
    const forward = (e: PointerEvent | KeyboardEvent): void => {
      if (!this.running || this.state.solved) return;
      this.game.input(e, this.state);
    };
    const pointer = (e: PointerEvent): void => {
      if (e.type === 'pointerdown') e.preventDefault();
      forward(e);
    };
    const key = (e: KeyboardEvent): void => forward(e);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
      el.addEventListener(type, pointer);
      this.unlisten.push(() => el.removeEventListener(type, pointer));
    }
    window.addEventListener('keydown', key);
    this.unlisten.push(() => window.removeEventListener('keydown', key));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastNow = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  resume(): void {
    this.start();
  }

  destroy(): void {
    this.pause();
    this.unlisten.forEach((fn) => fn());
    this.unlisten.length = 0;
  }

  /** Draw one frame without advancing the clock (e.g. after a resize while paused). */
  draw(): void {
    this.state.view = this.viewRect();
    const { ctx } = this.canvas;
    const { width, height } = this.canvas.size;
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, width, height);
    this.game.render(ctx, this.level, this.state);
    this.drawHud();
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(100, now - this.lastNow); // cap: a long hidden tab is not play time
    this.lastNow = now;
    if (!this.state.solved) this.state.elapsedMs += dt;
    this.draw();
    if (!this.state.solved && this.game.isSolved(this.state)) {
      this.state.solved = true;
      this.options.onSolved(this.state);
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private drawHud(): void {
    const { ctx } = this.canvas;
    const { width } = this.canvas.size;
    ctx.fillStyle = '#f4f6f8';
    ctx.textBaseline = 'middle';
    ctx.font = '600 22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatTime(this.state.elapsedMs), width / 2, HUD_HEIGHT / 2 + 4);
    ctx.font = '500 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(244, 246, 248, 0.7)';
    ctx.fillText(`${this.state.moves} moves`, 16, HUD_HEIGHT / 2 + 4);
  }
}
