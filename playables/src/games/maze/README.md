# Maze

Implements the `PuzzleGame` interface from `src/shell/game.ts`.

- `generator.ts`: recursive backtracker (perfect maze), optional loops, BFS,
  exit at the far end of the longest path, par time. Pure and unit-tested.
- `movement.ts`: slide until a wall or junction.
- `render.ts`: everything drawn in code; walls cached per layout.
- `index.ts`: the `mazeGame` object. Swipe/drag and arrow/WASD input, one
  queued move, trail, hint reveal.

Must never import `platform.ts` or call any `ytgame` API; ads, timer and
streak live in the shell. Loops, fog, keys/doors, one-way cells and shifting
walls come with worlds 2–5 (milestones 3 and 6).
