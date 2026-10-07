# Island Survival

A small 2.5D isometric survival game that runs in the browser. Collect food on a generated island by day, and avoid the monsters by night. A full day lasts 5 minutes (2.5 min of day, 2.5 min of night), and you have 10 lives.

The whole game is one self-contained file, [src/index.html](src/index.html), with no dependencies and no build step.

## Running the game

Open `src/index.html` in a browser, or serve the folder:

```bash
npm run dev    # serves src/ with npx serve
```

## How it plays

- **Moving:** WASD or the arrow keys move you, Shift sprints, and E eats food, searches the wreck or uses a portal. P or Esc pauses.
- **Hunger and lives:** hunger runs out in about 5 minutes. When it hits 0 you lose a life and hunger refills to half. A monster catch also costs a life and sends you back to the beach.
- **Night:** monsters appear at nightfall, and 2 more come each night. They chase you if you move nearby, but you can outrun them by sprinting. They can't follow you through a portal or into the cave.
- **Portals:** there are 3 linked portal pairs that teleport you across the island. One pair is hidden until you get close to it.
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
