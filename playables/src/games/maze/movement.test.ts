import { describe, expect, it } from 'vitest';
import { ALL_WALLS, E, N, S, W, type Dir, type MazeGrid } from './generator';
import { slidePath } from './movement';

/**
 * Build a grid from ASCII art where each cell is one character:
 *  '.' open floor, '#' solid. Adjacent '.' cells are connected.
 */
function fromAscii(rows: string[]): MazeGrid {
  const size = rows.length;
  const walls = new Uint8Array(size * size).fill(ALL_WALLS);
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < size && y < size && rows[y]![x] === '.';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!at(x, y)) continue;
      let w = ALL_WALLS;
      if (at(x, y - 1)) w &= ~N;
      if (at(x + 1, y)) w &= ~E;
      if (at(x, y + 1)) w &= ~S;
      if (at(x - 1, y)) w &= ~W;
      walls[y * size + x] = w;
    }
  }
  return { size, walls };
}

const grid = fromAscii([
  '.....', // row 0: corridor with a junction at (2,0) going down
  '..#.#', // row 1
  '.##..', // row 2
  '....#', // row 3
  '#####', // row 4
]);
const idx = (x: number, y: number): number => y * 5 + x;
const slide = (x: number, y: number, d: Dir, stop = -1): number[] =>
  slidePath(grid, idx(x, y), d, stop);

describe('slidePath', () => {
  it('returns nothing when the first step is blocked', () => {
    expect(slide(0, 0, N)).toEqual([]);
    expect(slide(0, 0, W)).toEqual([]);
  });

  it('stops at a junction', () => {
    // From (0,0) east: (1,0) has 3 openings (W, E, S) so stop there.
    expect(slide(0, 0, E)).toEqual([idx(1, 0)]);
  });

  it('runs through a corridor until a wall', () => {
    // From (0,0) south: (0,1) has 3 openings (N, E, S) -> junction, stop.
    expect(slide(0, 0, S)).toEqual([idx(0, 1)]);
    // From (0,1) south: (0,2) corridor, (0,3) has openings N and E -> corridor,
    // then wall to the south -> stop at (0,3).
    expect(slide(0, 1, S)).toEqual([idx(0, 2), idx(0, 3)]);
  });

  it('stops at the exit even mid-corridor', () => {
    expect(slide(0, 1, S, idx(0, 2))).toEqual([idx(0, 2)]);
  });

  it('follows a straight corridor and stops at the junction at its end', () => {
    // (3,2) north: (3,1) is a corridor, (3,0) has W, E and S -> junction.
    expect(slide(3, 2, N)).toEqual([idx(3, 1), idx(3, 0)]);
  });

  it('stops at a dead end', () => {
    // (4,2) only opens west.
    expect(slide(3, 2, E)).toEqual([idx(4, 2)]);
  });
});
