# CLIkanban Project — Agent Guide

## Project Overview
A full-featured Kanban board called **CLIkanban** with a Vue 3 web UI and Node.js CLI, backed by JSON file storage.

## Architecture
- **Monorepo** with npm workspaces: `web/` (Vue 3 + Vite + PrimeVue), `cli/` (Commander.js), and `server/` (Express production server)
- **Data**: JSON files in `boards/<name>/config.json` + `boards/<name>/cards.json` + `boards/<name>/settings.json`
- **Testing**: Vitest monorepo — `web` project (happy-dom), `cli` project (node), `server` project (node)

## Tech Stack
| Layer | Tech |
|-------|------|
| Web UI | Vue 3, Vite 6, PrimeVue v4 (Aura theme, custom palette), sortablejs-vue3 |
| CLI | Commander.js, chalk, nanoid, zod, date-fns, @inquirer/prompts |
| Server | Express 5 (serves built SPA + JSON API, HTTP/HTTPS) |
| Testing | Vitest 3, @vue/test-utils, happy-dom |

## Key Commands
```bash
npm run dev          # Start Vite dev server (web UI)
npm run build        # Build Vue SPA for production (web/dist/)
npm run start        # Start Express production server (HTTP)
npm run start:https  # Start Express production server (HTTPS)
npm run test:run     # Run all tests
npm run test:cli     # Run CLI tests only
npm run test:web     # Run web tests only
npm run cli          # Run CLI: node cli/bin/kanban.js
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm run lint:css     # Run Stylelint (CSS + Vue)
npm run lint:css:fix # Run Stylelint with auto-fix
npm run lint:all     # Run both ESLint + Stylelint

# CLI usage (all arguments are optional in interactive mode)
kanban board list
kanban board create [name] [-c "Col1,Col2,Col3"]
kanban board show [name]
kanban board delete [name]
kanban card list [board] [-s <status>]
kanban card add [board] [title] [-s status] [-d YYYY-MM-DD] [-l url] [-r] [-f key=val]
kanban card edit [board] [cardId] [-t title] [-s status] [-d date] [-l url] [-f key=val]
kanban card remove [board] [cardId]
kanban card add-gh [board] [github-url] [-s status]
kanban card refresh [board]
kanban move [board] [cardId] [status]
kanban reset [board]
kanban settings show [board]
kanban settings set-map [board] [label] [status]
kanban settings remove-map [board] [label]
kanban help                  # Rich formatted help (all commands)
kanban help <group>          # Help for specific group (board, card, move, github, recurring, settings)

# Interactive mode flags
kanban --no-interactive ...   # Disable prompts (for agents/CI/scripts)
kanban --ni ...               # Shorthand for --no-interactive
kanban --interactive ...      # Force interactive mode even without TTY
```

## Board Data Format

### config.json
```json
{
  "name": "my-board",
  "columns": ["To Do", "In Progress", "Done"],
  "customFields": [
    { "key": "priority", "label": "Priority", "type": "select", "options": ["low", "medium", "high"], "required": true }
  ]
}
```

### cards.json
```json
[
  {
    "id": "abc123",
    "title": "Fix bug",
    "status": "To Do",
    "link": "https://github.com/org/repo/issues/42",
    "linkMeta": {
      "type": "issue",
      "owner": "org",
      "repo": "repo",
      "number": 42,
      "title": "Fix bug",
      "state": "open",
      "labels": [{ "name": "bug", "color": "d73a4a" }],
      "milestone": "v2.0",
      "milestoneDueOn": "2026-04-01",
      "assignees": ["octocat"],
      "author": "monalisa",
      "bodyExcerpt": "Description of the bug...",
      "commentsCount": 3,
      "ghCreatedAt": "2026-01-01T00:00:00Z",
      "ghUpdatedAt": "2026-03-19T00:00:00Z",
      "ghClosedAt": null,
      "fetchedAt": "2026-03-19T12:00:00.000Z"
    },
    "deadline": "2026-04-01",
    "recurring": null,
    "customFields": { "priority": "high" },
    "createdAt": "2026-03-19T00:00:00.000Z",
    "updatedAt": "2026-03-19T00:00:00.000Z"
  }
]
```

### settings.json
```json
{
  "githubStatusMap": {
    "bug": "To Do",
    "enhancement": "In Progress",
    "wontfix": "Done"
  }
}
```

Maps GitHub label names to local board column/status names. When a `card refresh` (CLI) or GitHub auto-refresh (web) is triggered, cards are automatically moved to the mapped column if any of their GitHub labels match a key in the map. First matching label wins.

## Features

### Dark Mode
Toggle via toolbar button (moon/sun icon). Uses PrimeVue's `darkModeSelector: '.dark-mode'` on `<html>`. Persisted in localStorage key `clikanban-dark-mode`. System preference detected on first visit. Dark mode overrides for body background, column backgrounds, and card hover shadows are in `styles.css`.

### Custom Color Palette
Colors: `["#880d1e","#dd2d4a","#f26a8d","#f49cbb","#cbeef3"]` applied via `definePreset(Aura, {...})` in `main.js` with separate light/dark colorScheme configs.

### Board Creation (Web UI)
"New Board" button in toolbar center opens `CreateBoardDialog.vue`. Posts to `POST /api/boards` endpoint. Board names validated with `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`.

### Recurring Tasks
Cards with `recurring.frequency === "weekly"` auto-reset to their `resetToStatus` column when a new ISO week is detected. The `lastReset` field tracks the last reset date (YYYY-MM-DD).

### Deadline Severity
Color-coded tags computed at render time:
- **Green (success)**: >7 days away
- **Yellow (warn)**: 3-7 days away
- **Orange (warn)**: 1-3 days away
- **Red (danger)**: overdue or due today/tomorrow

### Browser Notifications
Fires for any card whose deadline is within 3 days. Uses the Notification API with permission request. Title: "CLIkanban Deadline".

### GitHub Integration
- `card add-gh` fetches issue/PR metadata via `gh` CLI (fallback: `GITHUB_TOKEN` + REST API)
- Syncs maximum metadata: title, state, labels (with colors), milestone, assignees, author, body excerpt, comments count, created/updated/closed dates
- Labels stored as `Array<{name: string, color: string|null}>` (not plain strings)
- Auto-extracts milestone `due_on` as card deadline
- `card add -l <github-issue-or-pr-url>` may omit the title; `card refresh` fills it from GitHub metadata
- `card refresh` updates all GitHub-linked cards with fresh metadata and **applies `githubStatusMap`** to move cards based on label matches
- **Web UI auto-refresh**: On board load, calls `POST /api/github-refresh` to update all GitHub-linked cards in background (also applies status mapping)
- GitHub labels displayed as color-coded chips on cards
- Author, assignees, and comment count shown in card metadata row

### Custom Fields
Typed per board (text, number, select, date, boolean). Defined in config, validated by CLI, rendered as appropriate PrimeVue inputs in the web UI.

### Board Settings (GitHub Label → Status Mapping)
Per-board settings stored in `boards/<name>/settings.json`. Maps GitHub labels to local board columns/statuses. During GitHub sync (CLI `card refresh` or web auto-refresh), cards are automatically moved to the mapped column if any of their labels match. First matching label wins. Accessible via:
- **CLI**: `kanban settings show/set-map/remove-map`
- **Web UI**: Settings dialog (gear icon in toolbar) with interactive label → column mapping editor
- Applied during: `card refresh` (CLI) and `POST /api/github-refresh` (Web)
- Schema validated by `boardSettingsSchema` in `cli/src/lib/schema.js`

### Interactive CLI Mode
The CLI is interactive by default when run by a human at a terminal (TTY). Missing arguments trigger prompts (selection pickers, text inputs, confirmations) instead of errors. This makes the CLI usable without memorizing argument order.

**Design:**
- **Default**: Interactive if `process.stdin.isTTY` is true
- **`--no-interactive` / `--ni`**: Disable prompts (for agents, CI, scripts)
- **`--interactive`**: Force prompts even without TTY
- All Commander arguments changed from `<required>` to `[optional]` so interactive prompts can fill them in
- Non-interactive mode still errors on missing arguments via explicit checks

**Prompt library:** `@inquirer/prompts` (input, select, confirm, checkbox) — installed in `cli` workspace.

**Helpers in `cli/src/lib/prompt.js`:**
- `isInteractive(program)` — reads global flags + TTY detection
- `promptIfMissing(value, opts, interactive)` — text input if value missing
- `selectIfMissing(value, opts, interactive)` — select picker if value missing
- `confirmPrompt(opts, interactive)` — confirmation dialog (returns true if non-interactive)
- `checkboxPrompt(opts, interactive)` — multi-select (returns [] if non-interactive)

**Per-command prompts:**
- `board create`: prompts for name + columns
- `board delete`: select board + confirm deletion
- `board show`: select board
- `card list`: select board + optional column filter
- `card show`: select board + select card
- `card add`: select board + prompt title (unless a GitHub issue/PR link is provided) + select status + optional deadline
- `card edit`: select board + select card + prompt editable fields
- `card remove`: select board + select card + confirm deletion
- `move`: select board + select card + select target column
- `card add-gh`: select board + prompt GitHub URL + select status
- `card refresh`: select board
- `settings show/set-map/remove-map`: select board + prompt/select label/column
- `reset`: select board

**Agent/CI usage:** Always pass `--no-interactive` (or `--ni`) to disable prompts. Tests run without TTY so interactive mode is OFF by default in tests.

### Help Command
Rich chalk-formatted help with all commands grouped by category. Run `kanban help` to see all commands, or `kanban help <group>` to filter to a specific group (board, card, move, github, recurring, settings). Implemented in `cli/src/commands/help.js`, registered in `cli/src/index.js`.

### Self-hosting (Production Server)
The `server/` workspace provides an Express production server that serves the built Vue SPA and exposes the same JSON API as the Vite dev middleware.

**Setup:**
```bash
npm run build         # Build Vue SPA → web/dist/
npm run start         # Start HTTP server on port 3000
npm run start:https   # Start HTTPS server on port 3000

# Custom port
node server/src/index.js --port 8080

# HTTPS with custom certificates
TLS_CERT=cert.pem TLS_KEY=key.pem node server/src/index.js --https
```

**Architecture:**
- `server/src/index.js` exports `createApp(boardsDir?)` factory for testing
- Serves static files from `web/dist/` with SPA fallback (all non-API routes serve `index.html`)
- Mirrors all Vite dev middleware API endpoints: `/api/boards`, `/api/board`, `/api/settings`, `/api/github-refresh`
- Serves interactive API docs at `/api/docs` (Scalar API Reference) and the OpenAPI spec at `/api/openapi.yaml`
- HTTPS support: auto-generates self-signed cert via `openssl`, or reads `TLS_CERT`/`TLS_KEY` env vars
- Only starts HTTP listener when run directly (not when imported for tests)

**SSH access for remote CLI:** Users can SSH into the server host and use the CLI directly:
```bash
ssh user@host "cd /path/to/kanban && node cli/bin/kanban.js --no-interactive board list"
```

**Docker deployment:**
```bash
docker compose up -d              # Build and start on port 3000
PORT=8080 docker compose up -d    # Custom port
docker compose down               # Stop
```
- Multi-stage Dockerfile: build stage (installs all deps, builds SPA) + production stage (production deps only, copies built SPA)
- `docker-compose.yml` with named volume for `boards/` data persistence
- `.dockerignore` excludes node_modules, .git, docs, config files
- Runs as non-root `node` user, based on `node:22-alpine`
- CLI available inside the container: `docker exec clikanban node cli/bin/kanban.js board list --ni`

### Linting
- **ESLint**: Flat config (`eslint.config.js`) with `@eslint/js` + `eslint-plugin-vue`. Relaxed Vue formatting rules. CLI and server files allow `console`, test files allow unused vars.
- **Stylelint**: `stylelint-config-standard` + `stylelint-config-standard-vue` + `stylelint-use-logical` plugin. Enforces logical CSS properties for RTL/LTR support (`margin-block-start` instead of `margin-top`, etc.). Physical `width`/`height`/`overflow-*` exempted.
- Run with `npm run lint` (ESLint), `npm run lint:css` (Stylelint), or `npm run lint:all` (both).

### CI/CD (GitHub Actions)
- **CI Tests** (`.github/workflows/ci.yml`): Runs `npm run test:run` on push/PR to main, matrix: Node 20 + 22
- **Lint** (`.github/workflows/lint.yml`): ESLint + Stylelint jobs on push/PR to main
- **Commitlint** (`.github/workflows/commits.yml`): Validates PR commits follow Conventional Commits spec (`@commitlint/config-conventional`)
- **Security Audit** (`.github/workflows/audit.yml`): Weekly `npm audit --audit-level=high` (Monday 08:00 UTC)
- **Dependabot** (`.github/dependabot.yml`): Weekly npm + GitHub Actions dependency updates, grouped by dev/production

### Card Edit / Delete (Web UI)
- Each card shows edit (pencil) and delete (trash) icon buttons on hover
- Edit opens `CardDialog` pre-filled with card data; save updates the card in place
- Delete shows a `ConfirmDialog` prompt before removing the card
- Toast notifications confirm add/update/delete actions
- Events flow: `KanbanCard` -> `KanbanColumn` -> `KanbanBoard` -> `App.vue`

### Empty States (Web UI)
- **No board selected**: Shows icon + message + "New Board" CTA button
- **Empty board (0 cards)**: Shows icon + "No cards yet" message + "Add Card" CTA button

### Responsive Layout
- **Desktop**: Columns stretch evenly across full viewport width (`flex: 1`, `min-width: 250px`, no `max-width`)
- **Tablet (<=1024px)**: Narrower columns, reduced padding
- **Mobile (<=640px)**: Columns stack vertically, card action buttons always visible (no hover required), toolbar wraps

## File Structure
```
kanban/
├── package.json                  # npm workspaces root (type: module, lint/build/start scripts)
├── Dockerfile                    # Multi-stage Docker build (build SPA + production image)
├── docker-compose.yml            # One-command deployment with volume persistence
├── .dockerignore                 # Docker build context exclusions
├── eslint.config.js              # ESLint flat config (JS + Vue)
├── stylelint.config.js           # Stylelint config (logical CSS properties)
├── vitest.workspace.js           # monorepo test config (cli, web, server)
├── LICENSE                       # MIT license with AI disclaimer
├── README.md                     # GitHub README (features, usage, API table, hosting)
├── agented.md                    # This file — full project guide
├── CLAUDE.md                     # Claude Code agent config
├── .opencode/skills/kanban.md    # OpenCode agent skill
├── docs/
│   ├── guide.md                  # User guide (CLI + web usage)
│   ├── hosting.md                # Self-hosting tutorial (systemd, nginx, Docker, SSH)
│   └── openapi.yaml              # OpenAPI 3.1 spec for the JSON API
├── .github/
│   ├── dependabot.yml            # Dependabot config (npm + actions)
│   └── workflows/
│       ├── ci.yml                # Test runner (Node 20+22)
│       ├── lint.yml              # ESLint + Stylelint
│       ├── commits.yml           # Commitlint (Conventional Commits)
│       └── audit.yml             # Weekly npm audit
├── boards/
│   └── default/                  # default board
│       ├── config.json
│       ├── cards.json
│       └── settings.json         # (created on first settings save)
├── cli/
│   ├── package.json              # @inquirer/prompts dependency
│   ├── bin/kanban.js             # CLI entry point
│   └── src/
│       ├── index.js              # Commander program setup (--interactive/--no-interactive/--ni flags)
│       ├── commands/             # board.js, card.js, move.js, github.js, recurring.js, settings.js, help.js
│       ├── lib/                  # store.js, schema.js, github.js, recurring.js, prompt.js
│       └── __tests__/            # schema, store, commands, github, recurring, prompt tests
├── server/
│   ├── package.json              # Express dependency
│   └── src/
│       ├── index.js              # Express server (createApp factory + CLI startup)
│       └── __tests__/            # Server API endpoint tests
└── web/
    ├── package.json
    ├── vite.config.js            # Vue plugin + API middleware (boards, board, settings, github-refresh)
    ├── index.html
    └── src/
        ├── main.js               # PrimeVue setup + custom palette + dark mode config
        ├── App.vue               # Root layout (CLIkanban title, dark mode, settings, new board, GH auto-refresh)
        ├── assets/styles.css     # Full-width columns, label chips, responsive, logical CSS properties
        ├── components/           # BoardSelector, KanbanBoard, KanbanColumn, KanbanCard,
        │                         # DeadlineTag, GithubLink, CustomFields, CardDialog,
        │                         # CreateBoardDialog, SettingsDialog
        ├── composables/          # useBoard (incl. settings), useRecurring, useNotifications, useDarkMode
        └── test/setup.js         # Vitest PrimeVue global setup
```

## Conventions
- All dates stored as ISO strings (YYYY-MM-DD for deadlines, full ISO for timestamps)
- Card IDs generated with `nanoid(10)`
- Board names must match `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/` (no leading underscores/special chars)
- PrimeVue v4 styled mode with Aura theme — no `unstyled` mode
- Web API served via Vite dev middleware (dev) or Express server (production): GET/PUT `/api/board?name=X`, GET/POST `/api/boards`, GET/PUT `/api/settings?name=X`, POST `/api/github-refresh`, GET `/api/docs` (Scalar API Reference), GET `/api/openapi.yaml`
- Tests colocated in `__tests__/` directories, named `*.test.js`
- Always run tests after making changes
- Always keep documentation up to date when making changes (agented.md, CLAUDE.md, .opencode/skills/kanban.md)
