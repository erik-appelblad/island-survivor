# Architecture

## Overview

Island Survival is a 2.5D (isometric) browser game. During the day the player collects food on a generated island. At night the player avoids monsters. A full day/night cycle lasts 4 minutes: 2 min of day and 2 min of night. Hunger drains over time (a full stomach lasts 2.5 min). Starving or being caught by a monster costs one of 10 lives. The island also has 3 linked portal pairs (one hidden) and 3 secret locations. After each survived night, a white exit portal opens near the player. It leads to a newly generated island.

The whole game is one self-contained file, `src/index.html`, with no dependencies and no build step.

## System Diagram

```
keyboard ──► input (keys set) ──► update(dt) fixed 60 Hz ──► state ──► render() every frame
                                    │                                  │
                         clock · player · hunger         ground (pre-rendered canvas)
                         monsters · food · discovery     depth-sorted objects
                                                         night overlay · HUD
```

## Components

The script is split into numbered sections:

1. **CONFIG**: every tunable number (day length, speeds, drain rates, counts).
2. **RNG / noise**: seeded `mulberry32`, value noise and a `hash2` for per-tile visual variation.
3. **World**: `generateIsland(seed)` builds a heightmap with a radial falloff, then classifies tiles and carves out the secrets (sand spit with shipwreck, grove ringed by thicket, cave in a rock pile). It flood-fills to check that everything is reachable, then places portals, bushes and palms. If a seed fails validation, it retries with another seed.
4. **Iso**: `toScreen(x, y, z)` / `toWorld(sx, sy)` with 64×32 px tiles.
5. **Pure rules**: `phaseInfo(t)`, `updateHunger(...)`, `applyLifeLoss(...)`. These have no side effects and can be tested from the console.
6. **State & systems**: player movement and collision, monster AI (wander → chase → give up, with a short detour when stuck), food regrowth and spawning, secret and hidden-portal discovery, the white exit portal and island travel, and interaction (`E`).
7. **Render**: the ground is pre-rendered once per game to an offscreen canvas. Each frame, objects (trees, food, portals, monsters, player) are sorted by iso depth `x + y` and drawn back to front. A darkness layer with radial lights cut out is drawn on top at night, then the HUD.
8. **Input / UI / loop**: DOM overlay screens (title, pause, game over), and `requestAnimationFrame` with a fixed-step update.

## Data Flow

Input adds key codes to a set. `update(dt)` reads that set and changes `state`. `render` only reads `state`. Interaction is edge-triggered: keydown sets `interactQueued`, and the next update uses it.

## Configuration

All balance values live in `CONFIG` at the top of the script. Debug: press `T` while playing to toggle ×20 clock speed.

## Testing

`npm test` runs `tests/smoke.test.js`. It pulls the `<script>` out of `src/index.html`, runs it in Node with stub DOM and canvas objects, and checks the pure rules, generation across 200 seeds (everything reachable), a multi-day simulation, portals, secrets, cave safety, game over and travel through the white portal.

## Deployment

Static file. Open `src/index.html` directly or serve the folder (e.g. `npx serve src`).

## Key Decisions

- **Canvas 2D, no libraries.** Keeps the game a single readable file.
- **Teleport-only portals.** Secret locations are on the main map: hidden grove (golden fruit), cave shelter (monsters can't enter) and shipwreck (one-time food stash).
- **Island travel via `loadIsland(world)`.** `newGame` creates the state that lasts the whole run (lives, hunger, clock, stats). `loadIsland` swaps in a new world and resets the per-island state (items, monsters, secrets, wreck). The white portal spawns at dawn (`spawnExitPortal`) 2–5 tiles from the player and fades at nightfall if unused.
- **Hunger drains lives.** At 0 hunger you lose a life and hunger resets to 50. A monster hit costs a life, respawns you on the beach and gives 3 s of invulnerability.
- **Only the clock is sped up by the debug key,** so testing the day/night cycle doesn't also starve the player.

## Open Questions

- Sound effects and music.
- Save/high score persistence.
- Touch controls for mobile.
