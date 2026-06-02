# CLIkanban

A CLI and web-based Kanban board manager. Manage boards, cards, and columns from the terminal or a self-hosted Vue web app with account login, database-backed persistence, and GitHub issue/PR integration.

<!-- Replace OWNER/REPO with your GitHub username/repository -->
<!--
![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)
![Lint](https://github.com/OWNER/REPO/actions/workflows/lint.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
-->

## Features

- **CLI + Web** — Full-featured CLI (Commander.js) and Vue 3 SPA with drag-and-drop
- **Accounts + auth** — Email/password signup and login with HTTP-only session cookies
- **Database-backed web app** — Authenticated boards, columns, cards, settings, and sessions persisted in SQL
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

# Build and start the backend + web server
npm run build
npm run start

# Open the app
open http://localhost:3000
```

For frontend development with Vite, run the Express backend on `http://localhost:3000` in one terminal and Vite in another. Authenticated `/api/auth`, `/api/me`, and `/api/account` requests are proxied to the backend:

```bash
KANBAN_DB_PATH=./data/kanban.db npm run start
npm run dev
```

### GitHub OAuth for local login

Create a GitHub OAuth App with:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/github/callback`

Then start the server with the OAuth credentials:

```bash
GITHUB_CLIENT_ID=your_client_id \
GITHUB_CLIENT_SECRET=your_client_secret \
GITHUB_OAUTH_REDIRECT_URL=http://localhost:3000/api/auth/github/callback \
KANBAN_DB_PATH=./data/kanban.db \
npm run start
```

The `GITHUB_OAUTH_REDIRECT_URL` value must match the callback URL registered in GitHub and the `redirect_uri` used when the login starts. GitHub users display their GitHub avatar; email/password users display initials. If GitHub does not expose an email address, CLIkanban stores a stable GitHub noreply-style email for that account.

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
kanban card add my-project -l https://github.com/user/repo/issues/42  # Title filled by sync
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

- Signup/login with account-scoped boards
- GitHub login with avatar support for GitHub users
- Drag-and-drop cards between columns (via `sortablejs-vue3`)
- Board creation/selection
- Card editing with custom fields, deadlines, and GitHub metadata
- GitHub metadata refresh
- Dark mode toggle
- Settings panel for GitHub label-to-column mapping

Run the integrated app for testing:

```bash
npm run build
npm run start
```

Then open:

```bash
http://localhost:3000
```

For Vite development:

```bash
# Terminal 1: backend/API on http://localhost:3000
KANBAN_DB_PATH=./data/kanban.db npm run start

# Terminal 2: Vite frontend with API proxy
npm run dev
```

## API

The server exposes two API groups:

- Authenticated account API used by the current web UI.
- Legacy file-backed API used by the CLI/local JSON workflow.

### Authenticated Account API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create an account and session |
| POST | `/api/auth/login` | Create a session |
| GET | `/api/auth/github` | Start GitHub OAuth login |
| GET | `/api/auth/github/callback` | Complete GitHub OAuth login |
| POST | `/api/auth/logout` | Destroy the current session |
| GET | `/api/me` | Return the current authenticated user |
| GET | `/api/account/boards` | List boards visible to the current user |
| POST | `/api/account/boards` | Create a DB-backed board |
| GET | `/api/account/boards/:boardId` | Get board config, columns, cards, and settings |
| POST | `/api/account/boards/:boardId/cards` | Create a card |
| PUT | `/api/account/boards/:boardId/cards` | Replace/sync the board card list, used by drag/drop |
| POST | `/api/account/boards/:boardId/github-refresh` | Refresh GitHub issue/PR metadata for account board cards |
| PATCH | `/api/account/cards/:cardId` | Update one card |
| DELETE | `/api/account/cards/:cardId` | Delete one card |
| GET | `/api/account/boards/:boardId/settings` | Get board settings |
| PUT | `/api/account/boards/:boardId/settings` | Update board settings |

### Legacy File API

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

GitHub metadata refresh uses the public GitHub REST API by default. Set `GITHUB_TOKEN` on the server for private repositories or higher API rate limits.

## Self-Hosting

```bash
# Build the web UI
npm run build

# HTTP (default port 3000)
node server/src/index.js

# HTTP with an explicit database path
KANBAN_DB_PATH=./data/kanban.db node server/src/index.js --port 3000

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
docker run -d \
  -p 3000:3000 \
  -v clikanban-boards:/app/boards \
  -v clikanban-data:/app/data \
  clikanban
```

Database state is persisted in `/app/data`; legacy board JSON is persisted in `/app/boards`. See [docs/hosting.md](docs/hosting.md) for a detailed guide on Docker, reverse proxies, systemd, and remote SSH access.

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
│   └── src/                # createApp(), auth, DB API, SQLite migration
├── boards/                 # Legacy board data (JSON files, gitignored)
├── data/                   # Runtime SQLite DB files (gitignored)
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
- **Server**: Express 5, Node.js HTTPS, Node SQLite, HTTP-only cookie sessions
- **Testing**: Vitest (monorepo workspace), @vue/test-utils, happy-dom
- **Linting**: ESLint 9 (flat config), Stylelint (logical CSS), Commitlint

## License

[MIT](LICENSE) — see LICENSE file for details.
