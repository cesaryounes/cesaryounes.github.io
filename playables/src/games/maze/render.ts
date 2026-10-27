/**
 * Draws a maze level. Everything is vector: rounded walls, a trail, the exit
 * marker and the blob character. World themes arrive in milestone 6; this is
 * world 1, Garden.
 */

import type { PlayState } from '../../shell/game';
import { cellXY, E, N, S, W, type Dir } from './generator';
import type { MazeData, MazeLevel } from './index';

export interface MazeTheme {
  floor: string;
  wall: string;
  trail: string;
  hint: string;
  exit: string;
  player: string;
  eye: string;
  pupil: string;
}

export const GARDEN: MazeTheme = {
  floor: '#eef6e4',
  wall: '#2f6b3a',
  trail: 'rgba(255, 138, 61, 0.35)',
  hint: 'rgba(47, 107, 58, 0.55)',
  exit: '#ffb62e',
  player: '#ff8a3d',
  eye: '#ffffff',
  pupil: '#1d2a1f',
};

interface Layout {
  cell: number;
  ox: number;
  oy: number;
  size: number;
}

/** Fit `size` cells into the view with some padding, centred. */
export function layoutFor(view: PlayState['view'], size: number): Layout {
  const pad = 12;
  const cell = Math.floor(Math.min(view.width - pad * 2, view.height - pad * 2) / size);
  const px = cell * size;
  return {
    cell,
    size,
    ox: Math.round(view.x + (view.width - px) / 2),
    oy: Math.round(view.y + (view.height - px) / 2),
  };
}

function centre(l: Layout, cell: number): [number, number] {
  const [x, y] = cellXY(l.size, cell);
  return [l.ox + (x + 0.5) * l.cell, l.oy + (y + 0.5) * l.cell];
}

// Wall layer cache: walls never change within a level, so draw them once per
// layout and blit each frame. Keyed on the level object and layout.
let wallCache: { key: string; level: MazeLevel; canvas: HTMLCanvasElement } | null = null;

function wallLayer(level: MazeLevel, l: Layout, dpr: number, theme: MazeTheme): HTMLCanvasElement {
  const key = `${l.cell}:${dpr}:${theme.wall}`;
  if (wallCache && wallCache.level === level && wallCache.key === key) return wallCache.canvas;

  const { maze } = level;
  const lw = Math.max(2, l.cell * 0.22);
  const px = l.cell * l.size + lw;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(px * dpr);
  canvas.height = Math.ceil(px * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.translate(lw / 2, lw / 2);

  // Floor
  ctx.fillStyle = theme.floor;
  ctx.beginPath();
  ctx.roundRect(0, 0, l.cell * l.size, l.cell * l.size, lw);
  ctx.fill();

  // Walls: N and W of every cell, plus the outer E and S edges.
  ctx.strokeStyle = theme.wall;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let c = 0; c < maze.walls.length; c++) {
    const [x, y] = cellXY(l.size, c);
    const w = maze.walls[c]!;
    const x0 = x * l.cell;
    const y0 = y * l.cell;
    if (w & N) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + l.cell, y0);
    }
    if (w & W) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, y0 + l.cell);
    }
    if (x === l.size - 1 && w & E) {
      ctx.moveTo(x0 + l.cell, y0);
      ctx.lineTo(x0 + l.cell, y0 + l.cell);
    }
    if (y === l.size - 1 && w & S) {
      ctx.moveTo(x0, y0 + l.cell);
      ctx.lineTo(x0 + l.cell, y0 + l.cell);
    }
  }
  ctx.stroke();

  wallCache = { key, level, canvas };
  return canvas;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Where the character is drawn right now, in CSS pixels, plus squash factor. */
function playerPose(
  l: Layout,
  d: MazeData,
  nowMs: number,
): { x: number; y: number; squash: number } {
  if (d.slide.length === 0) {
    const [x, y] = centre(l, d.pos);
    return { x, y, squash: 0 };
  }
  const t = Math.min(1, (nowMs - d.slideStartMs) / d.slideDurMs);
  const e = easeOutCubic(t);
  // Slides are straight lines, so interpolate from->to directly.
  const [fx, fy] = centre(l, d.slideFrom);
  const [tx, ty] = centre(l, d.pos);
  // Stretch along the motion early, squash on arrival.
  const squash =
    t < 0.6 ? 0.18 * Math.sin((t / 0.6) * Math.PI) : -0.12 * Math.sin(((t - 0.6) / 0.4) * Math.PI);
  return { x: fx + (tx - fx) * e, y: fy + (ty - fy) * e, squash };
}

export function renderMaze(
  ctx: CanvasRenderingContext2D,
  level: MazeLevel,
  state: PlayState,
  d: MazeData,
  theme: MazeTheme = GARDEN,
): void {
  const { maze } = level;
  const l = layoutFor(state.view, maze.size);
  if (l.cell < 4) return;
  const dpr = ctx.getTransform().a || 1;
  const now = state.elapsedMs;

  // Walls + floor
  const layer = wallLayer(level, l, dpr, theme);
  const lw = Math.max(2, l.cell * 0.22);
  ctx.drawImage(layer, l.ox - lw / 2, l.oy - lw / 2, layer.width / dpr, layer.height / dpr);

  // Trail
  if (d.trail.length > 1) {
    ctx.strokeStyle = theme.trail;
    ctx.lineWidth = Math.max(2, l.cell * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const [sx, sy] = centre(l, d.trail[0]!);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < d.trail.length; i++) {
      const [x, y] = centre(l, d.trail[i]!);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Hint: dotted path along the revealed solution cells.
  if (d.revealed.length > 1) {
    ctx.strokeStyle = theme.hint;
    ctx.lineWidth = Math.max(2, l.cell * 0.14);
    ctx.setLineDash([l.cell * 0.25, l.cell * 0.25]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const [sx, sy] = centre(l, d.revealed[0]!);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < d.revealed.length; i++) {
      const [x, y] = centre(l, d.revealed[i]!);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Exit: a pulsing ring with a dot.
  {
    const [x, y] = centre(l, maze.end);
    const pulse = 0.5 + 0.5 * Math.sin(now / 350);
    const r = l.cell * (0.26 + 0.06 * pulse);
    ctx.strokeStyle = theme.exit;
    ctx.lineWidth = Math.max(2, l.cell * 0.1);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = theme.exit;
    ctx.beginPath();
    ctx.arc(x, y, l.cell * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arrival burst
  if (d.solvedAtMs !== null) {
    const t = Math.min(1, (now - d.solvedAtMs) / 600);
    const [x, y] = centre(l, maze.end);
    ctx.strokeStyle = theme.exit;
    ctx.globalAlpha = 1 - t;
    ctx.lineWidth = Math.max(2, l.cell * 0.12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r0 = l.cell * (0.4 + t * 1.2);
      const r1 = r0 + l.cell * 0.35 * (1 - t);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Player: a blob with eyes, squashed along its motion.
  {
    const { x, y, squash } = playerPose(l, d, now);
    const r = l.cell * 0.34;
    const horizontal = d.facing === E || d.facing === W;
    const sx = horizontal ? 1 + squash : 1 - squash;
    const sy = horizontal ? 1 - squash : 1 + squash;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.fillStyle = theme.player;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Eyes look where the blob is heading.
    const look = lookOffset(d.facing, r * 0.18);
    const eyeDx = r * 0.36;
    const eyeDy = -r * 0.15;
    const eyeR = r * 0.26;
    const pupilR = r * 0.13;
    for (const side of [-1, 1]) {
      ctx.fillStyle = theme.eye;
      ctx.beginPath();
      ctx.arc(side * eyeDx, eyeDy, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.pupil;
      ctx.beginPath();
      ctx.arc(side * eyeDx + look[0], eyeDy + look[1], pupilR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function lookOffset(dir: Dir, amount: number): [number, number] {
  switch (dir) {
    case N:
      return [0, -amount];
    case E:
      return [amount, 0];
    case S:
      return [0, amount];
    case W:
      return [-amount, 0];
  }
}
