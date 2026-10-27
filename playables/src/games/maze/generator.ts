/**
 * Maze generation. Pure: the same seed and size always produce the same maze.
 * All randomness comes from the shell's seeded rng; never Math.random().
 *
 * Cells are indexed row-major (index = y * size + x). Each cell stores a
 * bitmask of the walls still standing around it.
 */

import { mulberry32 } from '../../shell/rng';

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const ALL_WALLS = N | E | S | W;

export type Dir = typeof N | typeof E | typeof S | typeof W;
export const DIRS: readonly Dir[] = [N, E, S, W];

export const DX: Record<Dir, number> = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
export const DY: Record<Dir, number> = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
export const OPPOSITE: Record<Dir, Dir> = { [N]: S, [E]: W, [S]: N, [W]: E };

export interface MazeGrid {
  /** Cells per side. Always odd, 5..99. */
  size: number;
  /** Wall bitmask per cell. A set bit means the wall is standing. */
  walls: Uint8Array;
}

export interface Maze extends MazeGrid {
  /** Entrance cell index (top-left). */
  start: number;
  /** Exit cell index: the cell farthest from the entrance. */
  end: number;
  /** Shortest path from start to end, inclusive of both. */
  solution: number[];
  /** Number of direction changes along the solution: the swipes a perfect run needs. */
  turns: number;
}

export function cellIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

export function cellXY(size: number, index: number): [number, number] {
  return [index % size, Math.floor(index / size)];
}

/** True when there is no wall between `cell` and its neighbour in `dir`. */
export function isOpen(grid: MazeGrid, cell: number, dir: Dir): boolean {
  return (grid.walls[cell]! & dir) === 0;
}

/** Index of the neighbour of `cell` in `dir`, or -1 when off the grid. */
export function neighbour(size: number, cell: number, dir: Dir): number {
  const [x, y] = cellXY(size, cell);
  const nx = x + DX[dir];
  const ny = y + DY[dir];
  if (nx < 0 || ny < 0 || nx >= size || ny >= size) return -1;
  return cellIndex(size, nx, ny);
}

/** Number of open sides of a cell (1 = dead end, 2 = corridor, 3+ = junction). */
export function openings(grid: MazeGrid, cell: number): number {
  let n = 0;
  for (const d of DIRS) if (isOpen(grid, cell, d)) n++;
  return n;
}

function removeWall(grid: MazeGrid, cell: number, dir: Dir): void {
  const other = neighbour(grid.size, cell, dir);
  if (other < 0) return;
  grid.walls[cell]! &= ~dir;
  grid.walls[other]! &= ~OPPOSITE[dir];
}

/**
 * Recursive backtracker (iterative, with an explicit stack): a perfect maze
 * with exactly one path between any two cells and plenty of long corridors.
 */
export function carvePerfectMaze(rng: ReturnType<typeof mulberry32>, size: number): MazeGrid {
  const total = size * size;
  const grid: MazeGrid = { size, walls: new Uint8Array(total).fill(ALL_WALLS) };
  const visited = new Uint8Array(total);
  const stack: number[] = [];

  let current = rng.int(0, total - 1);
  visited[current] = 1;
  stack.push(current);

  const candidates: Dir[] = [];
  while (stack.length > 0) {
    current = stack[stack.length - 1]!;
    candidates.length = 0;
    for (const d of DIRS) {
      const nb = neighbour(size, current, d);
      if (nb >= 0 && !visited[nb]) candidates.push(d);
    }
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const d = rng.pick(candidates);
    removeWall(grid, current, d);
    const next = neighbour(size, current, d);
    visited[next] = 1;
    stack.push(next);
  }
  return grid;
}

/**
 * Knock out a fraction of the standing interior walls so the maze has loops
 * (decisions, not just dead ends). `fraction` is of interior walls, 0..1.
 */
export function addLoops(
  rng: ReturnType<typeof mulberry32>,
  grid: MazeGrid,
  fraction: number,
): MazeGrid {
  if (fraction <= 0) return grid;
  const { size } = grid;
  // Every interior wall exactly once: the E and S wall of each cell.
  const walls: Array<[number, Dir]> = [];
  for (let cell = 0; cell < size * size; cell++) {
    const [x, y] = cellXY(size, cell);
    if (x < size - 1 && !isOpen(grid, cell, E)) walls.push([cell, E]);
    if (y < size - 1 && !isOpen(grid, cell, S)) walls.push([cell, S]);
  }
  rng.shuffle(walls);
  const count = Math.round(walls.length * Math.min(1, fraction));
  for (let i = 0; i < count; i++) {
    const [cell, d] = walls[i]!;
    removeWall(grid, cell, d);
  }
  return grid;
}

/** Breadth-first distances and parents from `from`. Unreachable cells get -1. */
export function bfs(grid: MazeGrid, from: number): { dist: Int32Array; parent: Int32Array } {
  const total = grid.size * grid.size;
  const dist = new Int32Array(total).fill(-1);
  const parent = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  queue[tail++] = from;
  dist[from] = 0;
  while (head < tail) {
    const cell = queue[head++]!;
    for (const d of DIRS) {
      if (!isOpen(grid, cell, d)) continue;
      const nb = neighbour(grid.size, cell, d);
      if (nb < 0 || dist[nb] !== -1) continue;
      dist[nb] = dist[cell]! + 1;
      parent[nb] = cell;
      queue[tail++] = nb;
    }
  }
  return { dist, parent };
}

/** The direction from `a` to an adjacent cell `b`, or null if not adjacent. */
export function dirBetween(size: number, a: number, b: number): Dir | null {
  for (const d of DIRS) if (neighbour(size, a, d) === b) return d;
  return null;
}

function countTurns(size: number, path: number[]): number {
  let turns = 0;
  let last: Dir | null = null;
  for (let i = 1; i < path.length; i++) {
    const d = dirBetween(size, path[i - 1]!, path[i]!);
    if (last !== null && d !== last) turns++;
    last = d;
  }
  return turns;
}

/**
 * Build a complete maze: carve, optionally add loops, place the entrance at
 * the top-left and the exit at the far end of the longest shortest-path.
 */
export function generateMaze(seed: number, size: number, loopFraction = 0): Maze {
  if (size < 3 || size % 2 === 0) throw new Error(`maze size must be odd and >= 3, got ${size}`);
  const rng = mulberry32(seed);
  const grid = addLoops(rng, carvePerfectMaze(rng, size), loopFraction);

  const start = 0;
  const { dist, parent } = bfs(grid, start);
  let end = start;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i]! > dist[end]!) end = i;
  }
  const solution: number[] = [];
  for (let c = end; c !== -1; c = parent[c]!) solution.push(c);
  solution.reverse();

  return { ...grid, start, end, solution, turns: countTurns(size, solution) };
}

/** Grid size for a difficulty 1..100: 7×7 at 1 up to 25×25 at 100, always odd. */
export function sizeForDifficulty(difficulty: number): number {
  const d = Math.min(100, Math.max(1, Math.round(difficulty)));
  return 7 + 2 * Math.round(((d - 1) / 99) * 9);
}

/**
 * Par time in ms: a second to orient, then a swipe per turn and a little per
 * cell travelled. Three stars under par, two under 1.5× par.
 */
export function parTimeMs(maze: Maze): number {
  return 1000 + maze.turns * 700 + (maze.solution.length - 1) * 50;
}
