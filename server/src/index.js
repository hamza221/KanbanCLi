/**
 * CLIkanban Production Server
 *
 * Express server that:
 * 1. Serves the built Vue SPA from web/dist/
 * 2. Provides the same JSON API as the Vite dev middleware
 * 3. Supports HTTP (default) and HTTPS (with --https flag or HTTPS=true env)
 *
 * Usage:
 *   node server/src/index.js                          # HTTP on port 3000
 *   node server/src/index.js --port 8080              # HTTP on port 8080
 *   HTTPS=true node server/src/index.js               # HTTPS with auto-generated self-signed cert
 *   node server/src/index.js --https                  # HTTPS with auto-generated self-signed cert
 *   TLS_CERT=cert.pem TLS_KEY=key.pem node server/src/index.js --https  # HTTPS with custom cert
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { openDatabase } from './db.js';
import { registerDatabaseApi } from './db-api.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BOARDS_DIR = path.resolve(PROJECT_ROOT, 'boards');
const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const DIST_DIR = path.resolve(PROJECT_ROOT, 'web', 'dist');
const BOARD_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Resolve a board directory from an untrusted name, guarding against path
 * traversal (e.g. `../../etc`). Returns null if the name is invalid.
 */
function resolveBoardDir(boardsDir, name) {
  if (typeof name !== 'string' || !BOARD_NAME_RE.test(name)) return null;
  return path.resolve(boardsDir, name);
}

// --- GitHub helpers (mirrors vite.config.js) ---

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

// --- Express app factory ---

export function createApp(boardsDir = BOARDS_DIR, options = {}) {
  const app = express();

  app.use(express.json());

  if (options.dbPath) {
    const db = openDatabase(options.dbPath);
    app.locals.db = db;
    registerDatabaseApi(app, db, {
      secureCookies: options.secureCookies,
      githubOAuth: options.githubOAuth,
      fetch: options.fetch,
    });
  }

  // --- API routes ---

  // GET /api/boards — list all boards
  // POST /api/boards — create a new board
  app.route('/api/boards')
    .get((req, res) => {
      try {
        const entries = fs.readdirSync(boardsDir, { withFileTypes: true });
        const boards = entries
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
        res.json(boards);
      } catch {
        res.json([]);
      }
    })
    .post((req, res) => {
      try {
        const { name, columns } = req.body;
        if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
          return res.status(400).json({ error: 'Name and columns are required' });
        }
        if (!BOARD_NAME_RE.test(name)) {
          return res.status(400).json({ error: 'Invalid board name' });
        }
        const newBoardDir = path.resolve(boardsDir, name);
        if (fs.existsSync(newBoardDir)) {
          return res.status(409).json({ error: 'Board already exists' });
        }
        fs.mkdirSync(newBoardDir, { recursive: true });
        const config = { name, columns, customFields: [] };
        fs.writeFileSync(path.resolve(newBoardDir, 'config.json'), JSON.stringify(config, null, 2) + '\n');
        fs.writeFileSync(path.resolve(newBoardDir, 'cards.json'), '[]\n');
        res.json({ ok: true, config });
      } catch {
        res.status(400).json({ error: 'Invalid request' });
      }
    });

  // GET /api/board?name=<board> — get board config + cards
  // PUT /api/board?name=<board> — update board config and/or cards
  app.route('/api/board')
    .get((req, res) => {
      const boardName = req.query.name;
      if (!boardName) {
        return res.status(400).json({ error: 'Missing board name' });
      }
      const boardDir = resolveBoardDir(boardsDir, boardName);
      if (!boardDir) {
        return res.status(400).json({ error: 'Invalid board name' });
      }
      try {
        const config = JSON.parse(fs.readFileSync(path.resolve(boardDir, 'config.json'), 'utf-8'));
        const cards = JSON.parse(fs.readFileSync(path.resolve(boardDir, 'cards.json'), 'utf-8'));
        res.json({ config, cards });
      } catch {
        res.status(404).json({ error: 'Board not found' });
      }
    })
    .put((req, res) => {
      const boardName = req.query.name;
      if (!boardName) {
        return res.status(400).json({ error: 'Missing board name' });
      }
      const boardDir = resolveBoardDir(boardsDir, boardName);
      if (!boardDir) {
        return res.status(400).json({ error: 'Invalid board name' });
      }
      try {
        const data = req.body;
        if (data.config) {
          fs.writeFileSync(
            path.resolve(boardDir, 'config.json'),
            JSON.stringify(data.config, null, 2) + '\n'
          );
        }
        if (data.cards) {
          fs.writeFileSync(
            path.resolve(boardDir, 'cards.json'),
            JSON.stringify(data.cards, null, 2) + '\n'
          );
        }
        res.json({ ok: true });
      } catch {
        res.status(400).json({ error: 'Invalid request' });
      }
    });

  // GET /api/settings?name=<board> — get board settings
  // PUT /api/settings?name=<board> — update board settings
  app.route('/api/settings')
    .get((req, res) => {
      const boardName = req.query.name;
      if (!boardName) {
        return res.status(400).json({ error: 'Missing board name' });
      }
      const boardDir = resolveBoardDir(boardsDir, boardName);
      if (!boardDir) {
        return res.status(400).json({ error: 'Invalid board name' });
      }
      const settingsFile = path.resolve(boardDir, 'settings.json');
      try {
        if (fs.existsSync(settingsFile)) {
          const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
          res.json(settings);
        } else {
          res.json({ githubStatusMap: {} });
        }
      } catch {
        res.json({ githubStatusMap: {} });
      }
    })
    .put((req, res) => {
      const boardName = req.query.name;
      if (!boardName) {
        return res.status(400).json({ error: 'Missing board name' });
      }
      const boardDir = resolveBoardDir(boardsDir, boardName);
      if (!boardDir) {
        return res.status(400).json({ error: 'Invalid board name' });
      }
      const settingsFile = path.resolve(boardDir, 'settings.json');
      try {
        const settings = req.body;
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
        res.json({ ok: true });
      } catch {
        res.status(400).json({ error: 'Invalid JSON' });
      }
    });

  // POST /api/github-refresh — refresh GitHub metadata for all cards
  app.post('/api/github-refresh', async (req, res) => {
    try {
      const { boardName } = req.body;
      if (!boardName) {
        return res.status(400).json({ error: 'Missing boardName' });
      }

      const boardDir = resolveBoardDir(boardsDir, boardName);
      if (!boardDir) {
        return res.status(400).json({ error: 'Invalid boardName' });
      }
      const cardsPath = path.resolve(boardDir, 'cards.json');
      if (!fs.existsSync(cardsPath)) {
        return res.status(404).json({ error: 'Board not found' });
      }

      // Read board config and settings for status mapping
      const configPath = path.resolve(boardDir, 'config.json');
      const settingsPath = path.resolve(boardDir, 'settings.json');
      let columns = [];
      let statusMap = {};

      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        columns = config.columns || [];
      } catch {
        // ignore
      }

      try {
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          statusMap = settings.githubStatusMap || {};
        }
      } catch {
        // ignore
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

            // Apply githubStatusMap
            if (meta.labels && meta.labels.length > 0 && Object.keys(statusMap).length > 0) {
              for (const label of meta.labels) {
                const targetColumn = statusMap[label.name];
                if (targetColumn && columns.includes(targetColumn) && card.status !== targetColumn) {
                  card.status = targetColumn;
                  moved++;
                  break;
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

      res.json({ ok: true, updated, moved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- API documentation routes ---

  const DOCS_DIR = path.resolve(PROJECT_ROOT, 'docs');

  // GET /api/openapi.yaml — serve the OpenAPI spec
  app.get('/api/openapi.yaml', (req, res) => {
    const specPath = path.resolve(DOCS_DIR, 'openapi.yaml');
    try {
      const spec = fs.readFileSync(specPath, 'utf-8');
      res.setHeader('Content-Type', 'text/yaml');
      res.send(spec);
    } catch {
      res.status(404).json({ error: 'OpenAPI spec not found' });
    }
  });

  // GET /api/docs — Scalar API Reference UI
  app.get('/api/docs', (req, res) => {
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
    res.send(html);
  });

  // --- Serve SPA static files ---
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));

    // SPA fallback — serve index.html for all non-API routes
    app.use((req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.resolve(DIST_DIR, 'index.html'));
    });
  }

  return app;
}

// --- CLI startup (only when run directly) ---

async function main() {
  const args = process.argv.slice(2);
  const portArg = args.indexOf('--port');
  const port = portArg !== -1 ? parseInt(args[portArg + 1], 10) : parseInt(process.env.PORT || '3000', 10);
  const useHttps = args.includes('--https') || process.env.HTTPS === 'true';

  const dbPath = process.env.KANBAN_DB_PATH || path.resolve(DATA_DIR, 'kanban.db');
  const app = createApp(BOARDS_DIR, {
    dbPath,
    secureCookies: useHttps || process.env.COOKIE_SECURE === 'true',
  });

  if (useHttps) {
    const { default: https } = await import('https');

    let key, cert;

    if (process.env.TLS_KEY && process.env.TLS_CERT) {
      // Use provided cert/key files
      key = fs.readFileSync(process.env.TLS_KEY);
      cert = fs.readFileSync(process.env.TLS_CERT);
    } else {
      // Generate self-signed cert using Node's crypto
      console.log('Generating self-signed certificate...');
      const { default: crypto } = await import('crypto');
      const { generateKeyPairSync } = crypto;

      // Generate RSA key pair
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });

      // Use openssl to generate a self-signed cert (simpler than pure Node)
      const tmpKeyFile = path.resolve(PROJECT_ROOT, '.tmp-key.pem');
      const tmpCertFile = path.resolve(PROJECT_ROOT, '.tmp-cert.pem');

      fs.writeFileSync(tmpKeyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));

      await execFileAsync('openssl', [
        'req', '-new', '-x509',
        '-key', tmpKeyFile,
        '-out', tmpCertFile,
        '-days', '365',
        '-subj', '/CN=localhost',
      ]);

      key = fs.readFileSync(tmpKeyFile);
      cert = fs.readFileSync(tmpCertFile);

      // Clean up temp files
      fs.unlinkSync(tmpKeyFile);
      fs.unlinkSync(tmpCertFile);
    }

    https.createServer({ key, cert }, app).listen(port, () => {
      console.log(`CLIkanban server running at https://localhost:${port}`);
    });
  } else {
    app.listen(port, () => {
      console.log(`CLIkanban server running at http://localhost:${port}`);
    });
  }
}

// Only run main() when this file is executed directly (not imported for tests)
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
  main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
