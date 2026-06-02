import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from '../index.js';

// Lightweight test helper — makes HTTP requests against the Express app
// without needing a running server (uses app.handle directly via node:http)
async function request(app, method, urlPath, body = null) {
  const { default: http } = await import('http');

  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const options = {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
    server.on('error', reject);
  });
}

let tmpDir;
let app;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-server-test-'));
  app = createApp(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/boards', () => {
  it('returns empty array when no boards exist', async () => {
    const res = await request(app, 'GET', '/api/boards');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns board names', async () => {
    fs.mkdirSync(path.join(tmpDir, 'my-board'));
    fs.mkdirSync(path.join(tmpDir, 'another'));
    const res = await request(app, 'GET', '/api/boards');
    expect(res.status).toBe(200);
    expect(res.body).toContain('my-board');
    expect(res.body).toContain('another');
  });
});

describe('POST /api/boards', () => {
  it('creates a new board', async () => {
    const res = await request(app, 'POST', '/api/boards', {
      name: 'test-board',
      columns: ['To Do', 'Done'],
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config.name).toBe('test-board');
    expect(res.body.config.columns).toEqual(['To Do', 'Done']);

    // Verify files were created
    const configPath = path.join(tmpDir, 'test-board', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.name).toBe('test-board');
  });

  it('rejects invalid board name', async () => {
    const res = await request(app, 'POST', '/api/boards', {
      name: '!invalid',
      columns: ['To Do'],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid board name');
  });

  it('rejects missing columns', async () => {
    const res = await request(app, 'POST', '/api/boards', {
      name: 'test',
    });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate board name', async () => {
    fs.mkdirSync(path.join(tmpDir, 'existing'));
    const res = await request(app, 'POST', '/api/boards', {
      name: 'existing',
      columns: ['To Do'],
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Board already exists');
  });
});

describe('GET /api/board', () => {
  it('returns board config and cards', async () => {
    const boardDir = path.join(tmpDir, 'my-board');
    fs.mkdirSync(boardDir);
    fs.writeFileSync(
      path.join(boardDir, 'config.json'),
      JSON.stringify({ name: 'my-board', columns: ['To Do', 'Done'], customFields: [] })
    );
    fs.writeFileSync(
      path.join(boardDir, 'cards.json'),
      JSON.stringify([{ id: 'abc', title: 'Test', status: 'To Do' }])
    );

    const res = await request(app, 'GET', '/api/board?name=my-board');
    expect(res.status).toBe(200);
    expect(res.body.config.name).toBe('my-board');
    expect(res.body.cards).toHaveLength(1);
    expect(res.body.cards[0].title).toBe('Test');
  });

  it('returns 400 for missing board name', async () => {
    const res = await request(app, 'GET', '/api/board');
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent board', async () => {
    const res = await request(app, 'GET', '/api/board?name=nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/board', () => {
  it('updates board config and cards', async () => {
    const boardDir = path.join(tmpDir, 'my-board');
    fs.mkdirSync(boardDir);
    fs.writeFileSync(
      path.join(boardDir, 'config.json'),
      JSON.stringify({ name: 'my-board', columns: ['To Do'], customFields: [] })
    );
    fs.writeFileSync(path.join(boardDir, 'cards.json'), '[]');

    const newConfig = { name: 'my-board', columns: ['To Do', 'In Progress', 'Done'], customFields: [] };
    const newCards = [{ id: 'xyz', title: 'New Card', status: 'To Do' }];

    const res = await request(app, 'PUT', '/api/board?name=my-board', {
      config: newConfig,
      cards: newCards,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify files were updated
    const config = JSON.parse(fs.readFileSync(path.join(boardDir, 'config.json'), 'utf-8'));
    expect(config.columns).toEqual(['To Do', 'In Progress', 'Done']);
    const cards = JSON.parse(fs.readFileSync(path.join(boardDir, 'cards.json'), 'utf-8'));
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('New Card');
  });

  it('returns 400 for missing board name', async () => {
    const res = await request(app, 'PUT', '/api/board', { config: {} });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/settings', () => {
  it('returns default settings when file does not exist', async () => {
    const boardDir = path.join(tmpDir, 'my-board');
    fs.mkdirSync(boardDir);

    const res = await request(app, 'GET', '/api/settings?name=my-board');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ githubStatusMap: {} });
  });

  it('returns saved settings', async () => {
    const boardDir = path.join(tmpDir, 'my-board');
    fs.mkdirSync(boardDir);
    fs.writeFileSync(
      path.join(boardDir, 'settings.json'),
      JSON.stringify({ githubStatusMap: { bug: 'To Do' } })
    );

    const res = await request(app, 'GET', '/api/settings?name=my-board');
    expect(res.status).toBe(200);
    expect(res.body.githubStatusMap.bug).toBe('To Do');
  });

  it('returns 400 for missing board name', async () => {
    const res = await request(app, 'GET', '/api/settings');
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/settings', () => {
  it('saves settings', async () => {
    const boardDir = path.join(tmpDir, 'my-board');
    fs.mkdirSync(boardDir);

    const res = await request(app, 'PUT', '/api/settings?name=my-board', {
      githubStatusMap: { enhancement: 'In Progress' },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const saved = JSON.parse(
      fs.readFileSync(path.join(boardDir, 'settings.json'), 'utf-8')
    );
    expect(saved.githubStatusMap.enhancement).toBe('In Progress');
  });
});

describe('POST /api/github-refresh', () => {
  it('returns 400 for missing boardName', async () => {
    const res = await request(app, 'POST', '/api/github-refresh', {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent board', async () => {
    const res = await request(app, 'POST', '/api/github-refresh', {
      boardName: 'nonexistent',
    });
    expect(res.status).toBe(404);
  });

  it('returns ok with 0 updated when no GitHub-linked cards', async () => {
    const boardDir = path.join(tmpDir, 'my-board');
    fs.mkdirSync(boardDir);
    fs.writeFileSync(
      path.join(boardDir, 'config.json'),
      JSON.stringify({ name: 'my-board', columns: ['To Do'], customFields: [] })
    );
    fs.writeFileSync(
      path.join(boardDir, 'cards.json'),
      JSON.stringify([{ id: 'abc', title: 'Test', status: 'To Do', link: null }])
    );

    const res = await request(app, 'POST', '/api/github-refresh', {
      boardName: 'my-board',
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.updated).toBe(0);
  });
});

describe('GET /api/openapi.yaml', () => {
  it('returns the OpenAPI spec as YAML', async () => {
    const res = await request(app, 'GET', '/api/openapi.yaml');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('openapi:');
    expect(res.body).toContain('CLIkanban API');
  });
});

describe('GET /api/docs', () => {
  it('returns the Scalar API Reference HTML page', async () => {
    const res = await request(app, 'GET', '/api/docs');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('CLIkanban API Reference');
    expect(res.body).toContain('api-reference');
    expect(res.body).toContain('/api/openapi.yaml');
    expect(res.body).toContain('@scalar/api-reference');
  });
});
