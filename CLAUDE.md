# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

<!-- One or two sentences: what the app does and who it's for. -->

This is a small demo web app used for learning agentic workflows.

## Tech Stack

- **Frontend:** <!-- e.g. React, TypeScript, Vite -->
- **Backend:** <!-- e.g. Node.js, Express -->
- **Database:** <!-- e.g. SQLite / PostgreSQL -->
- **Styling:** <!-- e.g. Tailwind CSS -->
- **Testing:** <!-- e.g. Vitest, Playwright -->

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
npm install         # Install dependencies
npm run dev         # Start the dev server
npm run build       # Production build
npm test            # Run tests
npm run lint        # Lint the code
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
