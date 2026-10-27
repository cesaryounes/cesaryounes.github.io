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
    ctx.fillStyle = '#06120c';
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
    const cy = HUD_HEIGHT / 2 + 6;
    const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    const pill = (
      text: string,
      x: number,
      align: CanvasTextAlign,
      size: number,
      bold: boolean,
    ): void => {
      ctx.font = `${bold ? 700 : 500} ${size}px ${font}`;
      const w = ctx.measureText(text).width + size * 1.4;
      const h = size * 1.9;
      const left = align === 'center' ? x - w / 2 : align === 'left' ? x : x - w;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.roundRect(left, cy - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = bold ? '#ffffff' : 'rgba(255, 255, 255, 0.78)';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(text, left + w / 2, cy + 1);
    };

    pill(formatTime(this.state.elapsedMs), width / 2, 'center', 22, true);
    pill(`${this.state.moves} moves`, 16, 'left', 13, false);
  }
}
