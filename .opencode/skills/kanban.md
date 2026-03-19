---
name: kanban
description: Instructions for working on the Kanban board project
---

# Kanban Board Project Skill

Read `agented.md` at the project root for the full project guide. Key points:

## Quick Reference
- `npm run test:run` — run all tests (must pass before any commit)
- `npm run test:cli` — CLI tests only
- `npm run test:web` — web tests only
- `npm run dev` — start Vite dev server
- `npm run build` — build Vue SPA for production
- `npm run start` — start Express production server (HTTP)
- `npm run start:https` — start Express production server (HTTPS)
- `npm run cli` — run CLI (`node cli/bin/kanban.js`)
- `npm run lint` — run ESLint
- `npm run lint:css` — run Stylelint
- `npm run lint:all` — run ESLint + Stylelint

## Rules
- Always run tests after making changes
- Always keep documentation up to date when making changes (agented.md, CLAUDE.md, .opencode/skills/kanban.md)
- Board data lives in `boards/<name>/config.json` + `cards.json` + `settings.json` — never modify these directly in code without going through `cli/src/lib/store.js`
- Use PrimeVue v4 component APIs (Aura theme, styled mode) — refer to https://primevue.org/llms/llms.txt for docs
- Card IDs are generated with `nanoid(10)` — never use UUIDs
- Dates: deadlines as `YYYY-MM-DD`, timestamps as full ISO strings
- Zod schemas in `cli/src/lib/schema.js` are the source of truth for data validation
- GitHub labels format: `Array<{name: string, color: string|null}>` (not plain strings)
- Vitest workspace: `web` tests use `happy-dom`, `cli` tests use `node`, `server` tests use `node` environment
- Web test setup registers PrimeVue globally — see `web/src/test/setup.js`
- Use logical CSS properties (e.g., `margin-block-start` not `margin-top`) — enforced by Stylelint
- Settings per board stored in `boards/<name>/settings.json` (schema: `boardSettingsSchema`)

## Architecture
- Monorepo: `web/` (Vue 3 + Vite + PrimeVue), `cli/` (Commander.js), and `server/` (Express)
- App name: **CLIkanban**
- Data stored as JSON in `boards/<name>/`
- Vite dev middleware (dev) and Express server (production) expose `/api/boards`, `/api/board?name=X`, `/api/settings?name=X`, `/api/github-refresh`, `/api/docs` (Scalar API Reference), and `/api/openapi.yaml` for the web UI
- Drag-and-drop via `sortablejs-vue3` with shared `group: 'kanban'`
- Custom color palette: `["#880d1e","#dd2d4a","#f26a8d","#f49cbb","#cbeef3"]` via PrimeVue `definePreset`
- Dark mode via PrimeVue `darkModeSelector: '.dark-mode'`, persisted in localStorage key `clikanban-dark-mode`

## Interactive CLI
- CLI is interactive by default when stdin is a TTY (prompts for missing args)
- **Always pass `--no-interactive` or `--ni` when running CLI commands from agents/scripts/CI**
- `--interactive` forces prompts even without TTY
- Prompt helpers in `cli/src/lib/prompt.js`: `isInteractive()`, `promptIfMissing()`, `selectIfMissing()`, `confirmPrompt()`
- All command arguments are `[optional]` — interactive mode fills them via prompts, non-interactive mode errors on missing args

## Using the CLI
```bash
# Board management (all args optional in interactive mode)
kanban board list
kanban board create [name] [-c "Col1,Col2,Col3"]
kanban board show [name]
kanban board delete [name]

# Card management
kanban card list [board] [-s <status>]
kanban card add [board] [title] [-s status] [-d YYYY-MM-DD] [-l url] [-r] [-f key=val]
kanban card edit [board] [cardId] [-t title] [-s status] [-d date] [-l url] [-f key=val]
kanban card remove [board] [cardId]

# GitHub integration
kanban card add-gh [board] [github-url] [-s status]
kanban card refresh [board]

# Move / reset
kanban move [board] [cardId] [status]
kanban reset [board]

# Settings
kanban settings show [board]
kanban settings set-map [board] [label] [status]
kanban settings remove-map [board] [label]

# Help
kanban help                  # Rich formatted help (all commands)
kanban help <group>          # Help for specific group (board, card, move, github, recurring, settings)

# Flags
kanban --no-interactive ...  # Disable prompts (for agents/CI/scripts)
kanban --ni ...              # Shorthand for --no-interactive
kanban --interactive ...     # Force interactive mode even without TTY
```

## Self-hosting
```bash
npm run build         # Build Vue SPA → web/dist/
npm run start         # Start HTTP server on port 3000
npm run start:https   # Start HTTPS server on port 3000

# Docker (easiest)
docker compose up -d              # Build and start on port 3000
PORT=8080 docker compose up -d    # Custom port
```
- `server/src/index.js` exports `createApp(boardsDir?)` for testing
- Serves built Vue SPA from `web/dist/` + same JSON API as Vite dev middleware
- HTTPS: `--https` flag or `HTTPS=true` env var; custom certs via `TLS_CERT`/`TLS_KEY`
- Docker: multi-stage `Dockerfile`, `docker-compose.yml` with named volume for `boards/` persistence

## Using the Web UI
- Start dev server: `npm run dev`
- Select boards from the toolbar dropdown
- Create new boards via the "New Board" button
- Add/edit/delete cards with the toolbar buttons and card action icons
- Drag-and-drop cards between columns
- GitHub-linked cards show colored label chips, author, assignees, and comment count
- GitHub metadata auto-refreshes when a board is loaded
- Dark mode toggle in the toolbar (moon/sun icon)
- Browser notifications fire for cards with deadlines within 3 days

## Documentation
- `README.md` — GitHub README (features, usage, API table, hosting)
- `docs/guide.md` — User guide (CLI + web usage)
- `docs/hosting.md` — Self-hosting tutorial (systemd, nginx, Docker, SSH tunnels)
- `docs/openapi.yaml` — OpenAPI 3.1 specification for the JSON API
