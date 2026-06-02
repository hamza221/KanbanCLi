import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// --- GitHub helpers for dev server middleware ---

function parseGhUrl(url) {
  const cleaned = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const match = cleaned.match(
    /^github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    type: match[3] === 'pull' ? 'pr' : 'issue',
    number: parseInt(match[4], 10),
  };
}

async function fetchGhMeta(parsed) {
  const { owner, repo, type, number } = parsed;
  const subcommand = type === 'pr' ? 'pr' : 'issue';
  const fields =
    'title,state,labels,milestone,assignees,body,comments,createdAt,updatedAt,closedAt,author';

  const { stdout } = await execFileAsync('gh', [
    subcommand,
    'view',
    String(number),
    '--repo',
    `${owner}/${repo}`,
    '--json',
    fields,
  ]);

  const data = JSON.parse(stdout);

  const labels = Array.isArray(data.labels)
    ? data.labels.map((l) => {
        if (typeof l === 'string') return { name: l, color: null };
        return { name: l.name, color: l.color || null };
      })
    : [];

  const milestone = data.milestone;
  const assignees = Array.isArray(data.assignees)
    ? data.assignees.map((a) => (typeof a === 'string' ? a : a.login))
    : [];

  return {
    type,
    owner,
    repo,
    number,
    title: data.title || null,
    state: data.state || null,
    labels,
    milestone: milestone?.title ?? null,
    milestoneDueOn: milestone?.due_on?.slice(0, 10) ?? null,
    assignees,
    author: data.author?.login || data.user?.login || null,
    bodyExcerpt: data.body ? data.body.slice(0, 200) : null,
    commentsCount:
      typeof data.comments === 'number'
        ? data.comments
        : Array.isArray(data.comments)
          ? data.comments.length
          : 0,
    ghCreatedAt: data.createdAt || data.created_at || null,
    ghUpdatedAt: data.updatedAt || data.updated_at || null,
    ghClosedAt: data.closedAt || data.closed_at || null,
    fetchedAt: new Date().toISOString(),
  };
}

export default defineConfig({
  server: {
    proxy: {
      '^/api/(auth|account|me)': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    // Dev middleware to save board JSON from the browser
    {
      name: 'kanban-api',
      configureServer(server) {
        // GET /api/openapi.yaml — serve the OpenAPI spec
        // GET /api/docs — Scalar API Reference UI
        // NOTE: registered without path prefix to avoid connect's prefix-stripping
        // which interferes with Vite's internal middleware ordering
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET') return next();

          if (req.url === '/api/openapi.yaml') {
            const specPath = resolve(__dirname, '..', 'docs', 'openapi.yaml');
            try {
              const spec = fs.readFileSync(specPath, 'utf-8');
              res.setHeader('Content-Type', 'text/yaml');
              res.end(spec);
            } catch {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'OpenAPI spec not found' }));
            }
            return;
          }

          if (req.url === '/api/docs') {
            const html = `<!doctype html>
<html>
<head>
  <title>CLIkanban API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/api/openapi.yaml"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
            return;
          }

          next();
        });

        server.middlewares.use('/api/boards', async (req, res, next) => {
          if (req.method === 'GET') {
            const boardsDir = resolve(__dirname, '..', 'boards');
            try {
              const entries = fs.readdirSync(boardsDir, { withFileTypes: true });
              const boards = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(boards));
            } catch {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
            }
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { name, columns } = data;
                if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Name and columns are required' }));
                  return;
                }
                const nameRe = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
                if (!nameRe.test(name)) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid board name' }));
                  return;
                }
                const boardsDir = resolve(__dirname, '..', 'boards');
                const newBoardDir = resolve(boardsDir, name);
                if (fs.existsSync(newBoardDir)) {
                  res.statusCode = 409;
                  res.end(JSON.stringify({ error: 'Board already exists' }));
                  return;
                }
                fs.mkdirSync(newBoardDir, { recursive: true });
                const config = { name, columns, customFields: [] };
                fs.writeFileSync(resolve(newBoardDir, 'config.json'), JSON.stringify(config, null, 2) + '\n');
                fs.writeFileSync(resolve(newBoardDir, 'cards.json'), '[]\n');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, config }));
              } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }

          next();
        });

        server.middlewares.use('/api/board', async (req, res, next) => {
          const url = new URL(req.url, 'http://localhost');
          const boardName = url.searchParams.get('name');

          if (!boardName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing board name' }));
            return;
          }

          const boardDir = resolve(__dirname, '..', 'boards', boardName);

          if (req.method === 'GET') {
            try {
              const config = JSON.parse(
                fs.readFileSync(resolve(boardDir, 'config.json'), 'utf-8')
              );
              const cards = JSON.parse(
                fs.readFileSync(resolve(boardDir, 'cards.json'), 'utf-8')
              );
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ config, cards }));
            } catch (err) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Board not found' }));
            }
            return;
          }

          if (req.method === 'PUT') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                if (data.config) {
                  fs.writeFileSync(
                    resolve(boardDir, 'config.json'),
                    JSON.stringify(data.config, null, 2) + '\n'
                  );
                }
                if (data.cards) {
                  fs.writeFileSync(
                    resolve(boardDir, 'cards.json'),
                    JSON.stringify(data.cards, null, 2) + '\n'
                  );
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
              } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }

          next();
        });

        // Board settings endpoint
        server.middlewares.use('/api/settings', async (req, res, next) => {
          const url = new URL(req.url, 'http://localhost');
          const boardName = url.searchParams.get('name');

          if (!boardName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing board name' }));
            return;
          }

          const boardDir = resolve(__dirname, '..', 'boards', boardName);
          const settingsFile = resolve(boardDir, 'settings.json');

          if (req.method === 'GET') {
            try {
              if (fs.existsSync(settingsFile)) {
                const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(settings));
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ githubStatusMap: {} }));
              }
            } catch {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ githubStatusMap: {} }));
            }
            return;
          }

          if (req.method === 'PUT') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const settings = JSON.parse(body);
                fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }

          next();
        });

        // GitHub metadata refresh endpoint
        server.middlewares.use('/api/github-refresh', async (req, res, next) => {
          if (req.method !== 'POST') return next();

          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const { boardName } = JSON.parse(body);
              if (!boardName) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing boardName' }));
                return;
              }

              const boardDir = resolve(__dirname, '..', 'boards', boardName);
              const cardsPath = resolve(boardDir, 'cards.json');
              if (!fs.existsSync(cardsPath)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Board not found' }));
                return;
              }

              // Read board config and settings for status mapping
              const configPath = resolve(boardDir, 'config.json');
              const settingsPath = resolve(boardDir, 'settings.json');
              let columns = [];
              let statusMap = {};

              try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                columns = config.columns || [];
              } catch {
                // ignore — columns will be empty, no mapping applied
              }

              try {
                if (fs.existsSync(settingsPath)) {
                  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                  statusMap = settings.githubStatusMap || {};
                }
              } catch {
                // ignore — no mapping applied
              }

              const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));
              let updated = 0;
              let moved = 0;

              for (const card of cards) {
                if (!card.link || !card.link.includes('github.com')) continue;
                const parsed = parseGhUrl(card.link);
                if (!parsed) continue;

                try {
                  const meta = await fetchGhMeta(parsed);
                  if (meta) {
                    card.linkMeta = meta;
                    if (meta.title) card.title = meta.title;

                    // Apply githubStatusMap: check if any label maps to a column
                    if (meta.labels && meta.labels.length > 0 && Object.keys(statusMap).length > 0) {
                      for (const label of meta.labels) {
                        const targetColumn = statusMap[label.name];
                        if (targetColumn && columns.includes(targetColumn) && card.status !== targetColumn) {
                          card.status = targetColumn;
                          moved++;
                          break; // First matching label wins
                        }
                      }
                    }

                    updated++;
                  }
                } catch {
                  // Skip cards that fail to refresh
                }
              }

              if (updated > 0) {
                fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, updated, moved }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
