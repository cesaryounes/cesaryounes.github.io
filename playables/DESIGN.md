# Design notes: retention and difficulty

Proposals from the milestone 2 review, 2026-10-27. Items marked **(brief)**
are already in BRIEF.md; items marked **(proposed)** are additions that need
Cesar's OK before they are built. Milestone numbers say where each lands.

## Why a player comes back ("addictive", PEGI 3 style)

The loop is: short attempt → immediate feedback → a visible near-miss →
one tap to try again or move on. Each piece below protects one step of it.

1. **Frictionless flow (brief, M3).** The result panel's default button is
   _Next_; restart is one tap or the R key and never shows an interstitial.
   Sessions should feel like "one more" with no menu in between.
2. **Star chase with near-miss framing (brief + proposed, M3).** Stars are
   3 under par, 2 under 1.5× par, 1 for a clear. The result panel shows the
   gap explicitly: "2.3s from 3 stars". Near-misses drive replays far more
   than abstract scores.
3. **Collections (proposed, M6).** Code-drawn blob skins (colours, hats,
   eye styles). Unlock by 3-starring a world, by streak milestones (7, 30
   days) and by the gems below. Collections are the strongest PEGI 3 safe
   long-term hook and cost no art budget.
4. **Gems: speed vs greed (proposed, M6).** Some levels hide a gem in a
   dead end off the solution. Taking it costs time against par, skipping it
   costs the collection. A deliberate tension gives adults a reason to
   replay a level they already 3-starred. Gem placement is deterministic
   from the seed.
5. **Daily Maze and streak (brief, M4).** Same maze for everyone, ranked by
   time against par ("faster than par by 18%"). Streak shield via rewarded
   ad. Streak milestones unlock skins.
6. **Juice (brief, M2 and M6).** Squash on every move, dust puffs, confetti
   and a bigger celebration on a new best time, 3-4 sounds. Already partly
   in: blob breathes, blinks, smiles; exit glows; confetti on the clear.
7. **Progress you can see (brief, M3).** Level select shows stars per
   level and a world map strip; a world completes with a visible reward.

## How it gets harder

Size alone does not make a maze harder, only longer. Difficulty 1-100 is
spent on five levers, one per world, plus two that run across all worlds.

| Lever                          | What changes                                                                                                                                                                                              | World       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Size **(brief)**               | 7×7 → 25×25                                                                                                                                                                                               | all, slowly |
| Texture **(proposed)**         | Growing-tree generator with a bias: "newest cell" gives long twisty corridors (easy to read); mixing in "random cell" gives many short branches and more decisions per metre. Bias rises with difficulty. | all         |
| Par tightening **(proposed)**  | Par multiplier shrinks per world (×1.0 → ×0.8), so 3 stars need real speed later.                                                                                                                         | all         |
| Fog of war **(brief)**         | Only cells within radius r are visible; r shrinks 4 → 2 across the world. Removes planning.                                                                                                               | 2 Cave      |
| Loops + keys/doors **(brief)** | 5-15% walls removed (loops make dead ends ambiguous); 1-3 keys force detours and planning.                                                                                                                | 3 Ice       |
| One-way cells **(brief)**      | Some cells can be left only in one direction; wrong turns cost a long way back.                                                                                                                           | 4 Neon      |
| Shifting walls **(brief)**     | A subset of walls toggles every few seconds; adds time pressure and route re-planning.                                                                                                                    | 5 Clockwork |

Two further tools, both deterministic so every player gets the same level:

- **Candidate selection (proposed, M3).** For a level, generate four
  candidates from seed, seed+1, seed+2, seed+3 and pick the one whose
  "deception score" is closest to the target for that difficulty. Score =
  mean length of dead-end branches that leave the solution path, weighted
  by how early they branch. Early, long wrong turns feel hard; late, short
  ones feel easy. This turns "random maze" into "tuned maze" at no art cost.
- **Entrance and exit placement (proposed, M3).** Early levels: corner to
  far corner. Later levels: entrance in the centre, exit on the rim (harder
  to orient) or exit in the centre (spiral traps).

Within a world (20 levels): size grows by 2 every 5 levels, the world's
mechanic ramps (fog radius, key count, loop fraction, shift interval), and
the last two levels of a world are the "boss" sizes for that world.

## Open questions for Cesar

- OK to add gems and skins (items 3 and 4)? They are the biggest addition
  beyond the brief.
- Slide movement: stop at bends (current) or follow corridors round
  corners? The second is faster to play and more "flowy"; the first gives
  more control in fog.
