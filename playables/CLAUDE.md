# Playables shell + games

Browser games for **YouTube Playables**, built as one shared shell hosting
several puzzle generators. The first game is the maze; block puzzle and flow
connect follow on the same shell. The full spec is `BRIEF.md`; read it before
starting any milestone. Later sessions start with "Read BRIEF.md and CLAUDE.md,
then continue with milestone N".

This folder is a self-contained project inside the `cesaryounes.github.io`
GitHub Pages repo. Run every command from this folder (`playables/`).

## Tech stack

| Item      | Choice                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Language  | TypeScript, built with Vite (`npm run dev`, `npm run build`)                                               |
| Rendering | HTML5 Canvas 2D, no game engine, no bitmap art: everything drawn in code                                   |
| Audio     | Web Audio API, 3–4 short generated sounds; obeys the Playables mute state                                  |
| State     | One `SaveState` JSON string via `ytgame.game.saveData` inside Playables, localStorage via the mock outside |
| Tooling   | ESLint, Prettier, Vitest (`npm run lint`, `npm run format`, `npm test`)                                    |
| Output    | `dist/` is the ZIP that goes to Playables: static HTML/JS/CSS, relative URLs, under a few MB               |

## Folder layout

```
playables/
  index.html            loads the Playables SDK <script> FIRST, then the bundle
  src/main.ts           entry: boots the shell
  src/shell/            shared by every game (never game-specific)
    platform.ts         the ONLY file that touches `ytgame`; mock when SDK absent
    storage.ts          SaveState type, parse/serialise, Storage class
    rng.ts              mulberry32, hash32, dailySeed(date), levelSeed(world, level)
    game.ts             PuzzleGame / Level / PlayState interfaces
    canvas.ts           full-viewport DPR-aware canvas
    daily.ts, screens.ts, ads.ts, audio.ts, ui/   (later milestones)
  src/games/maze/       the maze game (implements PuzzleGame)
  src/games/<next>/     block puzzle, flow connect later
  public/               static assets copied into dist/ as-is
  dist/                 build output = the ZIP (git-ignored)
```

## Game interface

Every game implements `PuzzleGame` from `src/shell/game.ts`:

```ts
interface PuzzleGame {
  id: string; // "maze"
  generate(seed: number, difficulty: number): Level; // pure, deterministic
  newPlayState(level: Level): PlayState;
  render(ctx: CanvasRenderingContext2D, level: Level, state: PlayState): void;
  input(event: PointerEvent | KeyboardEvent, state: PlayState): void;
  isSolved(state: PlayState): boolean;
  hint(state: PlayState): void; // what a rewarded ad unlocks
}
```

Shell rules:

- Timer and streak logic live in the shell, never in the game.
- Difficulty is a number 1–100 the shell passes in; the game decides what it means.
- **All ad calls live in the shell (`ads.ts` → `platform.ts`), never in a game module.**
  A game only says "level done" or "hint requested".
- Generators are pure: same seed + difficulty = same level. All randomness comes
  from `src/shell/rng.ts`; never `Math.random()` in generation. Unit-test determinism.
- Daily seed comes from the UTC date (`dailySeed`), so every player gets the same daily puzzle.

## YouTube Playables rules (certification)

- The SDK `<script src="https://www.youtube.com/game_api/v1">` is loaded in
  `index.html` before any game code. It is the only external resource allowed.
- Call `ytgame.game.firstFrameReady()` after the first frame is drawn, then
  `ytgame.game.gameReady()` only once the game is interactable, never while a
  loading screen shows. Both are mandatory.
- Fork on `ytgame.IN_PLAYABLES_ENV`: inside Playables use YouTube save; outside,
  `platform.ts` installs a mock (`window.__ytgameMock` for manual testing).
- Save/load: one JSON string, max 3 MiB, through `saveData`/`loadData`.
- Audio: initialise from `isAudioEnabled()`, follow `onAudioEnabledChange`.
  **Never add an in-game audio toggle that overrides it.**
- Pause/resume: on `onPause` stop the loop, timer and audio and save state;
  resume may never come.
- Ads only via `ytgame.ads`: interstitials only at natural transitions (level
  complete, game over), never during play or while the timer runs, with the
  frequency cap from the brief stored in SaveState. Rewarded ads are strictly
  opt-in behind a clearly labelled button with a visible way to continue
  without them; `false` or a throw means "no reward", no penalty.
- Score: `ytgame.engagement.sendScore({ value })` with one integer dimension,
  total levels cleared.
- Language: `ytgame.system.getLanguage()`, not `navigator.language`. Strings in one file.
- Errors: `ytgame.health.logError()` / `logWarning()` from a global error handler.
- **No external scripts, analytics, ad SDKs, outbound links, purchases or
  fonts of any kind.** After `npm run build`, grep `dist/` for `http` and
  confirm the only match is the SDK URL.
- Content is PEGI 3 and advertiser-friendly. Must look good at 390×844 portrait
  and in a desktop window.

## Working style

- Small commits with clear messages; commit from the repo root with paths under `playables/`.
- After each milestone: `npm test`, `npm run lint`, `npm run build`, confirm
  `dist/` has no external requests other than the SDK, and tell the user what
  to test in the browser.
- Stop and ask before any decision the brief leaves open (publisher choice,
  studio name, palette).
