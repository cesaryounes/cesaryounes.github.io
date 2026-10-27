/**
 * Draws a maze level. Everything is vector and procedural: no bitmaps.
 *
 * Look: a deep ambient backdrop with drifting fireflies, the maze as a raised
 * board with a soft shadow, bevelled hedge walls (shade, body, highlight), a
 * glowing portal for the exit, a shaded blob that breathes, blinks and
 * squashes along its moves, dust puffs when it stops, confetti on a clear.
 * World themes swap the tokens below; this is world 1, Garden.
 */

import type { PlayState } from '../../shell/game';
import { cellXY, E, N, S, W, type Dir } from './generator';
import type { MazeData, MazeLevel } from './index';

/** Colour tokens for one world. `rgb` entries are "r,g,b" so alpha can vary. */
export interface MazeTheme {
  bgInner: string;
  bgOuter: string;
  floor: string;
  floorEdge: string;
  wall: string;
  wallShade: string;
  wallLight: string;
  /** Trail and start pad. */
  accentRgb: string;
  hintRgb: string;
  exitRgb: string;
  player: string;
  playerLight: string;
  playerShade: string;
  eye: string;
  pupil: string;
  ambientRgb: string;
  dustRgb: string;
  confetti: string[];
}

export const GARDEN: MazeTheme = {
  bgInner: '#1d3f2c',
  bgOuter: '#06120c',
  floor: '#f6f0dd',
  floorEdge: '#e4d9bb',
  wall: '#3f8f4e',
  wallShade: '#1e5a2d',
  wallLight: '#93d884',
  accentRgb: '255,122,69',
  hintRgb: '63,143,78',
  exitRgb: '255,201,60',
  player: '#ff7a45',
  playerLight: '#ffb58c',
  playerShade: '#d14f27',
  eye: '#ffffff',
  pupil: '#1c2026',
  ambientRgb: '255,232,150',
  dustRgb: '150,130,90',
  confetti: ['#ff7a45', '#ffc93c', '#93d884', '#ffffff', '#6ec6ff'],
};

export interface Particle {
  /** Position and velocity in cell units (cells and cells per second). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravity in cells per second squared. */
  g: number;
  bornMs: number;
  lifeMs: number;
  /** Radius as a fraction of a cell. */
  size: number;
  color: string;
  /** Spin for confetti rectangles, radians per second; 0 draws a dot. */
  spin: number;
}

interface Layout {
  cell: number;
  ox: number;
  oy: number;
  size: number;
}

/** Fit `size` cells into the view with some padding, centred. */
export function layoutFor(view: PlayState['view'], size: number): Layout {
  const pad = 16;
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

function cellCentreUnits(size: number, cell: number): [number, number] {
  const [x, y] = cellXY(size, cell);
  return [x + 0.5, y + 0.5];
}

function wallWidth(cell: number): number {
  return Math.max(2.5, cell * 0.22);
}

// ---------------------------------------------------------------------------
// Particles

export function spawnDust(d: MazeData, level: MazeLevel, nowMs: number, dir: Dir): void {
  const [x, y] = cellCentreUnits(level.maze.size, d.pos);
  // Puffs trail off behind the direction of travel.
  const back = dir === E ? -1 : dir === W ? 1 : 0;
  const backY = dir === S ? -1 : dir === N ? 1 : 0;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const spread = (Math.random() - 0.5) * 0.6;
    d.particles.push({
      x: x + back * 0.25 + (backY === 0 ? 0 : spread),
      y: y + backY * 0.25 + (back === 0 ? 0 : spread),
      vx: back * (0.6 + Math.random() * 0.8) + (backY === 0 ? 0 : spread),
      vy: backY * (0.6 + Math.random() * 0.8) + (back === 0 ? 0 : spread) - 0.2,
      g: 0,
      bornMs: nowMs,
      lifeMs: 320 + Math.random() * 160,
      size: 0.1 + Math.random() * 0.08,
      color: `rgba(${GARDEN.dustRgb},0.55)`,
      spin: 0,
    });
  }
}

export function spawnConfetti(
  d: MazeData,
  level: MazeLevel,
  nowMs: number,
  theme: MazeTheme = GARDEN,
): void {
  const [x, y] = cellCentreUnits(level.maze.size, level.maze.end);
  const scale = Math.max(1, 10 / level.maze.size); // bigger burst on small boards
  for (let i = 0; i < 44; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 4) * scale;
    d.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 2 * scale,
      g: 9 * scale,
      bornMs: nowMs,
      lifeMs: 900 + Math.random() * 500,
      size: (0.08 + Math.random() * 0.1) * scale,
      color: theme.confetti[i % theme.confetti.length]!,
      spin: (Math.random() - 0.5) * 12,
    });
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, l: Layout, d: MazeData, nowMs: number): void {
  if (d.particles.length === 0) return;
  const alive: Particle[] = [];
  for (const p of d.particles) {
    const age = (nowMs - p.bornMs) / 1000;
    const t = (nowMs - p.bornMs) / p.lifeMs;
    if (t >= 1) continue;
    alive.push(p);
    const x = l.ox + (p.x + p.vx * age) * l.cell;
    const y = l.oy + (p.y + p.vy * age + 0.5 * p.g * age * age) * l.cell;
    const r = p.size * l.cell * (p.spin === 0 ? 1 + t * 1.2 : 1);
    ctx.globalAlpha = p.spin === 0 ? 1 - t : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.fillStyle = p.color;
    if (p.spin === 0) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.spin * age);
      ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  d.particles = alive;
}

// ---------------------------------------------------------------------------
// Backdrop

function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nowMs: number,
  theme: MazeTheme,
): void {
  const g = ctx.createRadialGradient(
    width * 0.5,
    height * 0.35,
    0,
    width * 0.5,
    height * 0.45,
    Math.max(width, height) * 0.85,
  );
  g.addColorStop(0, theme.bgInner);
  g.addColorStop(1, theme.bgOuter);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Fireflies: slow drift and a soft pulse, positions from a tiny hash.
  const count = 22;
  for (let i = 0; i < count; i++) {
    const bx = hash01(i, 1) * width;
    const by = hash01(i, 2) * height;
    const sp = 2600 + hash01(i, 3) * 2600;
    const x = bx + Math.sin(nowMs / sp + i) * 18;
    const y = by + Math.cos(nowMs / (sp * 1.3) + i * 2) * 14;
    const a = 0.12 + 0.3 * (0.5 + 0.5 * Math.sin(nowMs / (700 + hash01(i, 4) * 900) + i));
    const r = 1.5 + hash01(i, 5) * 2;
    ctx.fillStyle = `rgba(${theme.ambientRgb},${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Board layer (floor + walls), cached per level and layout

const MARGIN = 36;
let boardCache: { key: string; level: MazeLevel; canvas: HTMLCanvasElement } | null = null;

function boardLayer(level: MazeLevel, l: Layout, dpr: number, theme: MazeTheme): HTMLCanvasElement {
  const key = `${l.cell}:${dpr}:${theme.wall}`;
  if (boardCache && boardCache.level === level && boardCache.key === key) return boardCache.canvas;

  const { maze } = level;
  const lw = wallWidth(l.cell);
  const depth = lw * 0.5;
  const px = l.cell * l.size;
  const total = px + MARGIN * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(total * dpr);
  canvas.height = Math.ceil(total * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.translate(MARGIN, MARGIN);
  const radius = lw * 1.2;

  // Drop shadow under the board.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = theme.floor;
  ctx.beginPath();
  ctx.roundRect(-lw / 2, -lw / 2, px + lw, px + lw, radius);
  ctx.fill();
  ctx.restore();

  // Floor with a gentle light from the top-left.
  const fg = ctx.createLinearGradient(0, 0, px, px);
  fg.addColorStop(0, theme.floor);
  fg.addColorStop(1, theme.floorEdge);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.roundRect(-lw / 2, -lw / 2, px + lw, px + lw, radius);
  ctx.fill();

  // Faint dots at cell centres: a subtle grid that helps read big mazes.
  if (l.cell >= 18) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let c = 0; c < maze.walls.length; c++) {
      const [x, y] = cellXY(l.size, c);
      ctx.beginPath();
      ctx.arc((x + 0.5) * l.cell, (y + 0.5) * l.cell, Math.max(1, l.cell * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Walls as one path, stroked three times: shade below, body, highlight above.
  const path = new Path2D();
  for (let c = 0; c < maze.walls.length; c++) {
    const [x, y] = cellXY(l.size, c);
    const w = maze.walls[c]!;
    const x0 = x * l.cell;
    const y0 = y * l.cell;
    if (w & N) {
      path.moveTo(x0, y0);
      path.lineTo(x0 + l.cell, y0);
    }
    if (w & W) {
      path.moveTo(x0, y0);
      path.lineTo(x0, y0 + l.cell);
    }
    if (x === l.size - 1 && w & E) {
      path.moveTo(x0 + l.cell, y0);
      path.lineTo(x0 + l.cell, y0 + l.cell);
    }
    if (y === l.size - 1 && w & S) {
      path.moveTo(x0, y0 + l.cell);
      path.lineTo(x0 + l.cell, y0 + l.cell);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(0, depth);
  ctx.strokeStyle = theme.wallShade;
  ctx.lineWidth = lw;
  ctx.stroke(path);
  ctx.restore();

  ctx.strokeStyle = theme.wall;
  ctx.lineWidth = lw;
  ctx.stroke(path);

  ctx.save();
  ctx.translate(-lw * 0.08, -lw * 0.18);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = theme.wallLight;
  ctx.lineWidth = lw * 0.34;
  ctx.stroke(path);
  ctx.restore();

  boardCache = { key, level, canvas };
  return canvas;
}

// ---------------------------------------------------------------------------
// Trail, exit, player

function strokeCells(ctx: CanvasRenderingContext2D, l: Layout, cells: readonly number[]): void {
  ctx.beginPath();
  const [sx, sy] = centre(l, cells[0]!);
  ctx.moveTo(sx, sy);
  for (let i = 1; i < cells.length; i++) {
    const [x, y] = centre(l, cells[i]!);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawTrail(ctx: CanvasRenderingContext2D, l: Layout, d: MazeData, theme: MazeTheme): void {
  if (d.trail.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // The whole trail, soft: wrong turns stay visible.
  ctx.strokeStyle = `rgba(${theme.accentRgb},0.22)`;
  ctx.lineWidth = Math.max(2, l.cell * 0.3);
  strokeCells(ctx, l, d.trail);
  // The recent stretch glows so the eye finds the character at once.
  const recent = d.trail.slice(-12);
  if (recent.length > 1) {
    ctx.strokeStyle = `rgba(${theme.accentRgb},0.14)`;
    ctx.lineWidth = Math.max(4, l.cell * 0.42);
    strokeCells(ctx, l, recent);
    ctx.strokeStyle = `rgba(${theme.accentRgb},0.5)`;
    ctx.lineWidth = Math.max(2, l.cell * 0.26);
    strokeCells(ctx, l, recent);
  }
}

function drawHint(ctx: CanvasRenderingContext2D, l: Layout, d: MazeData, theme: MazeTheme): void {
  if (d.revealed.length < 2) return;
  ctx.strokeStyle = `rgba(${theme.hintRgb},0.7)`;
  ctx.lineWidth = Math.max(2, l.cell * 0.14);
  ctx.lineCap = 'round';
  ctx.setLineDash([l.cell * 0.22, l.cell * 0.28]);
  strokeCells(ctx, l, d.revealed);
  ctx.setLineDash([]);
}

function drawStartPad(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  cell: number,
  theme: MazeTheme,
): void {
  const [x, y] = centre(l, cell);
  ctx.fillStyle = `rgba(${theme.accentRgb},0.14)`;
  ctx.beginPath();
  ctx.arc(x, y, l.cell * 0.36, 0, Math.PI * 2);
  ctx.fill();
}

function drawExit(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  cell: number,
  nowMs: number,
  theme: MazeTheme,
  solved: boolean,
): void {
  const [x, y] = centre(l, cell);
  const pulse = 0.5 + 0.5 * Math.sin(nowMs / 420);
  const glowR = l.cell * (1.0 + 0.25 * pulse) * (solved ? 1.6 : 1);
  const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  g.addColorStop(0, `rgba(${theme.exitRgb},${solved ? 0.75 : 0.55})`);
  g.addColorStop(0.45, `rgba(${theme.exitRgb},0.18)`);
  g.addColorStop(1, `rgba(${theme.exitRgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Rotating dashed ring.
  const r = l.cell * 0.3;
  ctx.strokeStyle = `rgba(${theme.exitRgb},0.95)`;
  ctx.lineWidth = Math.max(1.5, l.cell * 0.08);
  ctx.lineCap = 'round';
  ctx.setLineDash([r * 0.9, r * 0.6]);
  ctx.lineDashOffset = -nowMs / 60;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Core light and three orbiting sparks.
  ctx.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y, l.cell * (0.09 + 0.03 * pulse), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${theme.exitRgb},0.9)`;
  for (let i = 0; i < 3; i++) {
    const a = nowMs / 700 + (i * Math.PI * 2) / 3;
    const orbit = l.cell * 0.46;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * orbit, y + Math.sin(a) * orbit, l.cell * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function playerPose(
  l: Layout,
  d: MazeData,
  nowMs: number,
): { x: number; y: number; squash: number; moving: boolean } {
  if (d.slide.length === 0) {
    const [x, y] = centre(l, d.pos);
    return { x, y, squash: 0, moving: false };
  }
  const t = Math.min(1, (nowMs - d.slideStartMs) / d.slideDurMs);
  const e = easeOutCubic(t);
  const [fx, fy] = centre(l, d.slideFrom);
  const [tx, ty] = centre(l, d.pos);
  const squash =
    t < 0.6 ? 0.2 * Math.sin((t / 0.6) * Math.PI) : -0.14 * Math.sin(((t - 0.6) / 0.4) * Math.PI);
  return { x: fx + (tx - fx) * e, y: fy + (ty - fy) * e, squash, moving: t < 1 };
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

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  d: MazeData,
  nowMs: number,
  theme: MazeTheme,
): void {
  const { x, y, squash, moving } = playerPose(l, d, nowMs);
  const r = l.cell * 0.34;
  const solved = d.solvedAtMs !== null;

  // Idle breathing and a happy hop on the clear.
  let sx = 1;
  let sy = 1;
  let lift = 0;
  if (moving) {
    const horizontal = d.facing === E || d.facing === W;
    sx = horizontal ? 1 + squash : 1 - squash;
    sy = horizontal ? 1 - squash : 1 + squash;
  } else if (solved) {
    const t = (nowMs - d.solvedAtMs!) / 1000;
    const hop = Math.abs(Math.sin(t * Math.PI * 2.2)) * Math.max(0, 1 - t / 2.5);
    lift = hop * r * 0.8;
    sx = 1 + 0.12 * hop;
    sy = 1 - 0.08 * hop;
  } else {
    const b = Math.sin(nowMs / 520);
    sx = 1 + 0.025 * b;
    sy = 1 - 0.025 * b;
  }

  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.78, r * 0.85 * sx, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - lift);
  ctx.scale(sx, sy);

  // Body with a light from the top-left and a dark rim.
  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  bg.addColorStop(0, theme.playerLight);
  bg.addColorStop(0.55, theme.player);
  bg.addColorStop(1, theme.playerShade);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Specular dot.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // Eyes: blink every few seconds; closed-happy arcs when solved.
  const blinkPhase = nowMs % 3600;
  const blink = blinkPhase > 3400 ? Math.sin(((blinkPhase - 3400) / 200) * Math.PI) : 0;
  const open = Math.max(0.08, 1 - blink);
  const eyeDx = r * 0.36;
  const eyeDy = -r * 0.12;
  const eyeR = r * 0.27;
  const look = lookOffset(d.facing, r * 0.2);
  for (const side of [-1, 1]) {
    const ex = side * eyeDx;
    if (solved) {
      ctx.strokeStyle = theme.pupil;
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, eyeDy + eyeR * 0.3, eyeR * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = theme.eye;
    ctx.beginPath();
    ctx.ellipse(ex, eyeDy, eyeR, eyeR * open, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.2) {
      ctx.fillStyle = theme.pupil;
      ctx.beginPath();
      ctx.ellipse(
        ex + look[0] * 0.8,
        eyeDy + look[1] * 0.8,
        eyeR * 0.5,
        eyeR * 0.5 * open,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(
        ex + look[0] * 0.8 - eyeR * 0.18,
        eyeDy + look[1] * 0.8 - eyeR * 0.2,
        eyeR * 0.14,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Mouth: a small smile, wider when solved.
  ctx.strokeStyle = theme.playerShade;
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const mouthR = r * (solved ? 0.34 : 0.22);
  ctx.arc(0, r * 0.22, mouthR, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------

export function renderMaze(
  ctx: CanvasRenderingContext2D,
  level: MazeLevel,
  state: PlayState,
  d: MazeData,
  theme: MazeTheme = GARDEN,
): void {
  const { maze } = level;
  const dpr = ctx.getTransform().a || 1;
  const canvasW = ctx.canvas.width / dpr;
  const canvasH = ctx.canvas.height / dpr;
  const now = state.elapsedMs;

  drawBackdrop(ctx, canvasW, canvasH, now, theme);

  const l = layoutFor(state.view, maze.size);
  if (l.cell < 4) return;

  const layer = boardLayer(level, l, dpr, theme);
  ctx.drawImage(layer, l.ox - MARGIN, l.oy - MARGIN, layer.width / dpr, layer.height / dpr);

  drawStartPad(ctx, l, maze.start, theme);
  drawTrail(ctx, l, d, theme);
  drawHint(ctx, l, d, theme);
  drawExit(ctx, l, maze.end, now, theme, d.solvedAtMs !== null);
  drawParticles(ctx, l, d, now);
  drawPlayer(ctx, l, d, now, theme);
}
