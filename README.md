# CLIkanban

A CLI and web-based Kanban board manager. Manage boards, cards, and columns from the terminal or a self-hosted Vue web app with GitHub issue/PR integration.

<!-- Replace OWNER/REPO with your GitHub username/repository -->
<!--
![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)
![Lint](https://github.com/OWNER/REPO/actions/workflows/lint.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
-->

## Features

- **CLI + Web** — Full-featured CLI (Commander.js) and Vue 3 SPA with drag-and-drop
- **Interactive mode** — CLI prompts for missing arguments when run in a terminal
- **GitHub integration** — Add cards from GitHub issues/PRs, auto-refresh metadata, map labels to columns
- **Recurring tasks** — Weekly recurring cards with automatic reset
- **Custom fields** — Define typed fields (text, number, select, date, boolean) per board
- **Self-hosted** — Express 5 production server with HTTP and HTTPS support
- **Dark mode** — Toggle in the web UI, persisted in localStorage

## Quick Start

```bash
# Install dependencies
npm install

# Install the `kanban` command globally (symlink)
npm link --workspace=cli

# Now you can use `kanban` directly
kanban help

# Or run without linking via npm
npm run cli -- help

# Start the dev server (Vite)
npm run dev

# Build and start the production server
npm run build
npm run start
```

## CLI Usage

All CLI arguments are optional in interactive mode (the default when run in a terminal). Use `--no-interactive` or `--ni` to disable prompts for scripts and CI.

### Board Management

```bash
kanban board list                          # List all boards
kanban board create my-project             # Create with default columns
kanban board create sprint -c "Backlog,Active,Review,Done"
kanban board show my-project               # Show config + card summary
kanban board delete my-project             # Delete board and cards
```

### Card Management

```bash
kanban card list my-project                # List cards grouped by column
kanban card list my-project -s "In Progress"
kanban card add my-project "Fix login bug" -s "To Do" -d 2026-04-01
kanban card show my-project <cardId>
kanban card edit my-project <cardId> -t "New title" -s "Done"
kanban card remove my-project <cardId>
kanban move my-project <cardId> "In Progress"
```

### GitHub Integration

```bash
kanban card add-gh my-project https://github.com/user/repo/issues/42
kanban card refresh my-project             # Refresh all GitHub metadata
```

### Settings

```bash
kanban settings show my-project
kanban settings set-map my-project "bug" "To Do"
kanban settings remove-map my-project "bug"
```

### Recurring Tasks

```bash
kanban card add my-project "Weekly review" -r    # Add with --recurring
kanban reset my-project                          # Process weekly resets
```

## Web UI

The Vue 3 SPA provides:

- Drag-and-drop cards between columns (via `sortablejs-vue3`)
- Board creation/selection
- Card editing with custom fields, deadlines, and GitHub metadata
- GitHub metadata refresh
- Dark mode toggle
- Settings panel for GitHub label-to-column mapping

Start the dev server:

```bash
npm run dev
```

Or build and serve with the production server:

```bash
npm run build
npm run start          # HTTP on port 3000
npm run start:https    # HTTPS with auto-generated self-signed cert
```

## API

The server exposes a JSON API used by both the web UI and the dev middleware:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/boards` | List all board names |
| POST | `/api/boards` | Create a new board |
| GET | `/api/board?name=X` | Get board config + cards |
| PUT | `/api/board?name=X` | Update board config and/or cards |
| GET | `/api/settings?name=X` | Get board settings |
| PUT | `/api/settings?name=X` | Update board settings |
| POST | `/api/github-refresh` | Refresh GitHub metadata |

Interactive API documentation is available at `/api/docs` (powered by [Scalar](https://scalar.com/)).

See [docs/openapi.yaml](docs/openapi.yaml) for the full OpenAPI 3.1 specification.

## Self-Hosting

```bash
# Build the web UI
npm run build

# HTTP (default port 3000)
node server/src/index.js

# Custom port
node server/src/index.js --port 8080

# HTTPS with auto-generated self-signed certificate
node server/src/index.js --https

# HTTPS with custom certificates
TLS_CERT=cert.pem TLS_KEY=key.pem node server/src/index.js --https
```

### Docker

The easiest way to deploy CLIkanban:

```bash
# One command — builds and starts on port 3000
docker compose up -d

# Custom port
PORT=8080 docker compose up -d

# Or build and run manually
docker build -t clikanban .
docker run -d -p 3000:3000 -v clikanban-boards:/app/boards clikanban
```

Board data is persisted in a Docker volume. See [docs/hosting.md](docs/hosting.md) for a detailed guide on Docker, reverse proxies, systemd, and remote SSH access.

## Project Structure

```
kanban/
├── cli/                    # CLI (Commander.js)
│   ├── bin/kanban.js       # Entry point
│   └── src/
│       ├── commands/       # board, card, move, github, recurring, settings, help
│       └── lib/            # store, schema, prompt, github, recurring
├── web/                    # Vue 3 SPA (Vite + PrimeVue)
│   └── src/
│       ├── components/     # KanbanBoard, KanbanCard, BoardSelector, etc.
│       └── composables/    # useBoard, useRecurring, useNotifications, useDarkMode
├── server/                 # Express 5 production server
│   └── src/index.js        # createApp() factory + CLI startup
├── boards/                 # Board data (JSON files, gitignored)
├── docs/                   # User documentation + OpenAPI spec
└── .github/workflows/      # CI, Lint, Commitlint, Security Audit
```

## Development

```bash
npm install                 # Install all workspace dependencies
npm run dev                 # Vite dev server with HMR
npm run test:run            # Run all tests (Vitest)
npm run test:cli            # CLI tests only
npm run test:web            # Web tests only
npm run test:server         # Server tests only
npm run lint                # ESLint
npm run lint:css            # Stylelint (logical CSS properties)
npm run lint:all            # ESLint + Stylelint
npm run build               # Build Vue SPA for production
```

## Tech Stack

- **CLI**: Node.js, Commander.js, chalk, Zod, @inquirer/prompts, nanoid, date-fns
- **Web**: Vue 3, Vite, PrimeVue v4 (Aura theme), sortablejs-vue3
- **Server**: Express 5, Node.js HTTPS
- **Testing**: Vitest (monorepo workspace), @vue/test-utils, happy-dom
- **Linting**: ESLint 9 (flat config), Stylelint (logical CSS), Commitlint

## License

[MIT](LICENSE) — see LICENSE file for details.
