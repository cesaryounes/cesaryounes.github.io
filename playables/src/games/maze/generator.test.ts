import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../shell/rng';
import {
  addLoops,
  bfs,
  carvePerfectMaze,
  cellXY,
  dirBetween,
  DIRS,
  E,
  generateMaze,
  isOpen,
  N,
  neighbour,
  OPPOSITE,
  openings,
  S,
  sizeForDifficulty,
  W,
  type MazeGrid,
} from './generator';

function countOpenEdges(grid: MazeGrid): number {
  let n = 0;
  for (let c = 0; c < grid.size * grid.size; c++) {
    if (isOpen(grid, c, E)) n++;
    if (isOpen(grid, c, S)) n++;
  }
  return n;
}

function expectConsistentWalls(grid: MazeGrid): void {
  const { size } = grid;
  for (let c = 0; c < size * size; c++) {
    const [x, y] = cellXY(size, c);
    // Border walls always stand.
    if (y === 0) expect(isOpen(grid, c, N)).toBe(false);
    if (x === size - 1) expect(isOpen(grid, c, E)).toBe(false);
    if (y === size - 1) expect(isOpen(grid, c, S)).toBe(false);
    if (x === 0) expect(isOpen(grid, c, W)).toBe(false);
    // A wall is shared: open on one side means open on the other.
    for (const d of DIRS) {
      const nb = neighbour(size, c, d);
      if (nb >= 0) expect(isOpen(grid, c, d)).toBe(isOpen(grid, nb, OPPOSITE[d]));
    }
  }
}

describe('carvePerfectMaze', () => {
  it('produces a perfect maze: every cell reachable, cells-1 open edges', () => {
    for (const size of [3, 7, 15, 25]) {
      const grid = carvePerfectMaze(mulberry32(size), size);
      expectConsistentWalls(grid);
      const { dist } = bfs(grid, 0);
      expect(Array.from(dist).every((d) => d >= 0)).toBe(true);
      expect(countOpenEdges(grid)).toBe(size * size - 1);
    }
  });
});

describe('addLoops', () => {
  it('opens roughly the requested fraction of interior walls', () => {
    const size = 15;
    const grid = carvePerfectMaze(mulberry32(3), size);
    const interiorWalls = 2 * size * (size - 1) - (size * size - 1);
    const before = countOpenEdges(grid);
    addLoops(mulberry32(4), grid, 0.1);
    expectConsistentWalls(grid);
    expect(countOpenEdges(grid) - before).toBe(Math.round(interiorWalls * 0.1));
  });

  it('is a no-op for fraction 0', () => {
    const grid = carvePerfectMaze(mulberry32(3), 9);
    const copy = Uint8Array.from(grid.walls);
    addLoops(mulberry32(4), grid, 0);
    expect(grid.walls).toEqual(copy);
  });
});

describe('generateMaze', () => {
  it('is deterministic for the same seed and size', () => {
    const a = generateMaze(777, 13);
    const b = generateMaze(777, 13);
    expect(a.walls).toEqual(b.walls);
    expect(a.solution).toEqual(b.solution);
    expect(a.end).toBe(b.end);
  });

  it('differs between seeds', () => {
    expect(generateMaze(1, 13).walls).not.toEqual(generateMaze(2, 13).walls);
  });

  it('matches a pinned fingerprint so levels never silently change', () => {
    const m = generateMaze(20261027, 11);
    const fingerprint = Array.from(m.walls).join(',');
    expect(m.walls.length).toBe(121);
    expect(fingerprint).toMatchInlineSnapshot(
      `"9,5,1,5,7,9,1,5,3,13,3,10,13,6,9,5,6,10,11,12,5,2,12,5,5,4,3,11,10,12,1,5,6,9,3,9,3,12,6,12,3,12,5,3,10,12,6,12,3,9,7,10,9,7,10,10,9,1,3,12,6,9,6,8,5,6,10,14,10,12,3,9,4,3,12,5,7,12,5,6,9,6,12,7,12,5,1,3,9,5,3,12,5,5,5,5,3,14,10,12,3,8,5,5,5,5,7,12,3,10,13,6,12,5,5,5,5,5,5,4,6"`,
    );
    expect(m.end).toMatchInlineSnapshot(`50`);
  });

  it('starts top-left and the solution is a valid walk ending at the exit', () => {
    const m = generateMaze(5, 17);
    expect(m.start).toBe(0);
    expect(m.solution[0]).toBe(m.start);
    expect(m.solution[m.solution.length - 1]).toBe(m.end);
    for (let i = 1; i < m.solution.length; i++) {
      const a = m.solution[i - 1]!;
      const b = m.solution[i]!;
      const d = dirBetween(m.size, a, b);
      expect(d).not.toBeNull();
      expect(isOpen(m, a, d!)).toBe(true);
    }
  });

  it('places the exit at the far end: no cell is farther from the start', () => {
    const m = generateMaze(9, 21);
    const { dist } = bfs(m, m.start);
    const max = Math.max(...Array.from(dist));
    expect(dist[m.end]).toBe(max);
    expect(m.solution.length - 1).toBe(max);
  });

  it('exit is a dead end in a perfect maze (it feels like a destination)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = generateMaze(seed, 15);
      expect(openings(m, m.end)).toBe(1);
    }
  });

  it('counts turns along the solution', () => {
    const m = generateMaze(42, 9);
    expect(m.turns).toBeGreaterThan(0);
    expect(m.turns).toBeLessThan(m.solution.length);
  });

  it('supports loops: still solvable, exit still the farthest cell', () => {
    const m = generateMaze(11, 15, 0.1);
    const { dist } = bfs(m, m.start);
    expect(Array.from(dist).every((d) => d >= 0)).toBe(true);
    expect(dist[m.end]).toBe(Math.max(...Array.from(dist)));
    expect(countOpenEdges(m)).toBeGreaterThan(15 * 15 - 1);
  });

  it('rejects even or tiny sizes', () => {
    expect(() => generateMaze(1, 8)).toThrow();
    expect(() => generateMaze(1, 1)).toThrow();
  });
});

describe('sizeForDifficulty', () => {
  it('runs from 7 at difficulty 1 to 25 at difficulty 100, odd and non-decreasing', () => {
    expect(sizeForDifficulty(1)).toBe(7);
    expect(sizeForDifficulty(100)).toBe(25);
    let last = 0;
    for (let d = 1; d <= 100; d++) {
      const s = sizeForDifficulty(d);
      expect(s % 2).toBe(1);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it('clamps out-of-range difficulties', () => {
    expect(sizeForDifficulty(-5)).toBe(7);
    expect(sizeForDifficulty(1000)).toBe(25);
  });
});
