/**
 * Sliding movement: the character slides in a direction until it hits a wall
 * or reaches a junction (a cell with more than one way on). This keeps a
 * 25×25 maze playable with a thumb.
 */

import { isOpen, neighbour, openings, type Dir, type MazeGrid } from './generator';

/**
 * Cells visited when sliding from `from` in `dir`, excluding `from` itself.
 * Empty when the first step is blocked. Stops at `stopAt` (the exit) too.
 */
export function slidePath(grid: MazeGrid, from: number, dir: Dir, stopAt = -1): number[] {
  const path: number[] = [];
  let cell = from;
  while (isOpen(grid, cell, dir)) {
    const next = neighbour(grid.size, cell, dir);
    if (next < 0) break;
    path.push(next);
    cell = next;
    if (cell === stopAt) break;
    // A corridor has two openings: the way we came and one way on. Anything
    // more is a junction and the player must choose.
    if (openings(grid, cell) !== 2) break;
  }
  return path;
}
