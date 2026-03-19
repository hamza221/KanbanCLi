# CLAUDE.md — CLIkanban Project

Read `agented.md` for the full project guide. Key points:

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

## Interactive CLI
- CLI is interactive by default when stdin is a TTY (prompts for missing args)
- **Always pass `--no-interactive` or `--ni` when running CLI commands from agents/scripts/CI**
- `--interactive` forces prompts even without TTY
- Prompt helpers in `cli/src/lib/prompt.js`: `isInteractive()`, `promptIfMissing()`, `selectIfMissing()`, `confirmPrompt()`
- All command arguments are `[optional]` — interactive mode fills them via prompts, non-interactive mode errors on missing args

## Self-hosting
- `server/src/index.js` exports `createApp(boardsDir?)` for testing, runs Express server when executed directly
- Serves built Vue SPA from `web/dist/` + same JSON API as Vite dev middleware
- Interactive API docs at `/api/docs` (Scalar API Reference), OpenAPI spec at `/api/openapi.yaml`
- Supports HTTP (default) and HTTPS (`--https` flag or `HTTPS=true` env var)
- Custom certs via `TLS_CERT` / `TLS_KEY` env vars, or auto-generates self-signed cert
- **Docker**: `docker compose up -d` for one-command deployment; multi-stage `Dockerfile`, `docker-compose.yml` with named volume for `boards/` persistence

## Documentation
- `README.md` — GitHub README with features, usage examples, API table
- `docs/guide.md` — User guide (CLI + web usage)
- `docs/hosting.md` — Self-hosting tutorial (systemd, nginx, Docker, SSH tunnels)
- `docs/openapi.yaml` — OpenAPI 3.1 specification for the JSON API (7 endpoints)

## Help Command
- `kanban help` — Rich chalk-formatted help showing all commands grouped by category
- `kanban help <group>` — Filter to a specific group (board, card, move, github, recurring, settings)
- Implemented in `cli/src/commands/help.js`
