# Island Survival

A small 2.5D isometric survival game that runs in the browser. Collect food on a generated island by day, and avoid the monsters by night. Day and night last 2 minutes each, and you have 5 lives. Survive a night and a white portal takes you to a new island.

The whole game is one self-contained file, [src/index.html](src/index.html), with no dependencies and no build step.

## Running the game

Open `src/index.html` in a browser, or serve the folder:

```bash
npm run dev    # serves src/ with npx serve
```

## How it plays

- **Moving:** WASD or the arrow keys move you, Shift sprints, and E eats food, searches the wreck or uses a portal. P or Esc pauses.
- **Hunger and lives:** you start hungry (20 out of 100), and a full stomach lasts only about 75 seconds, so find food first. Hiding in the cave drains hunger twice as fast. When hunger hits 0 you lose a life and it refills to a fifth. A monster catch also costs a life and sends you back to the beach.
- **Night:** monsters appear at nightfall, and 2 more come each night. They chase you if you move nearby, but you can outrun them by sprinting. They can't follow you through a portal or into the cave.
- **Portals:** there are 3 linked portal pairs that teleport you across the island. One pair is hidden until you get close to it.
- **New islands:** each time you survive a night, a big white portal opens near you. Enter it during the day to travel to a brand-new island. Your lives, hunger and day count carry over, and the secrets reset. If you don't use it, it fades at nightfall.
- **Secrets:**
  - **Hidden grove:** fruit trees that fill your hunger completely.
  - **Cave shelter:** a safe hiding spot at night.
  - **Shipwreck:** a one-time stash of food.
- **Debug:** press T to speed up the clock ×20 so you can watch the day and night cycle quickly. Only the clock speeds up, not hunger.

All the balance numbers (speeds, drain rates, monster counts) are in `CONFIG` at the top of the script.

## Tests

```bash
npm test    # headless smoke tests, needs only Node
```

The tests run the game script in Node with a stubbed DOM. They check the game rules, island generation across 200 seeds, a multi-day simulation, portals, secrets, cave safety and game over. They don't cover how the game feels to play, so try it in the browser too.

## Project layout

```
.
├── docs/architecture.md   # How the game is built
├── src/index.html         # The game
├── tests/smoke.test.js    # Headless tests
└── package.json
```

See [docs/architecture.md](docs/architecture.md) for the design and key decisions.
