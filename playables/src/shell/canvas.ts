/**
 * Full-viewport canvas with device-pixel-ratio scaling. The shell owns it;
 * games receive the 2D context and the CSS-pixel size when they render.
 */

export interface CanvasSize {
  /** Width and height in CSS pixels. */
  width: number;
  height: number;
  dpr: number;
}

export class GameCanvas {
  readonly el: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  size: CanvasSize = { width: 1, height: 1, dpr: 1 };
  private listeners = new Set<(size: CanvasSize) => void>();

  constructor(el: HTMLCanvasElement) {
    this.el = el;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  onResize(cb: (size: CanvasSize) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(window.innerWidth));
    const height = Math.max(1, Math.round(window.innerHeight));
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (this.el.width !== pw || this.el.height !== ph) {
      this.el.width = pw;
      this.el.height = ph;
    }
    this.size = { width, height, dpr };
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.listeners.forEach((cb) => cb(this.size));
  }
}
