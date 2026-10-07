# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

<!-- One or two sentences: what the app does and who it's for. -->

This is a small demo web app used for learning agentic workflows.

## Tech Stack

- **Frontend:** Vanilla JS + Canvas 2D in a single self-contained HTML file (`src/index.html`), no build step
- **Backend:** None
- **Database:** None
- **Styling:** Inline CSS (screens only; the game is drawn on the canvas)
- **Testing:** `tests/smoke.test.js` runs the game script in Node with a stubbed DOM; play-test in the browser too. Internals are exposed on `window.IslandGame`

## Project Structure

```
.
├── docs/           # Project documentation
├── src/            # Application source
├── tests/          # Tests
└── CLAUDE.md
```

## Commands

```bash
npm run dev         # Serve src/ locally (or just open src/index.html)
npm test            # Run the headless smoke tests (Node, no dependencies)
```

## Code Style

- Use TypeScript with strict mode where possible.
- Match the style of the surrounding code.
- Prefer small, focused functions and components.
- Keep changes minimal and focused on the task.

## Testing

- Add or update tests for any behavior change.
- Run the test suite before considering a task done.

## Git Workflow

- Work on a feature branch; don't commit directly to `main`.
- Write short, imperative commit messages.

## Documentation

- Architecture: @docs/architecture.md
