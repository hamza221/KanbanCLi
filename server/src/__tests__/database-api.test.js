import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from '../index.js';
import { closeDatabase } from '../db.js';

async function request(app, method, urlPath, body = null, cookie = null) {
  const { default: http } = await import('http');

  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const headers = { 'Content-Type': 'application/json' };
      if (cookie) headers.Cookie = cookie;

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: urlPath,
          method,
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            server.close();
            const setCookie = res.headers['set-cookie']?.[0] || null;
            const sessionCookie = setCookie?.split(';')[0] || null;
            try {
              resolve({
                status: res.statusCode,
                body: JSON.parse(data),
                location: res.headers.location || null,
                setCookie,
                sessionCookie,
              });
            } catch {
              resolve({
                status: res.statusCode,
                body: data,
                location: res.headers.location || null,
                setCookie,
                sessionCookie,
              });
            }
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
    server.on('error', reject);
  });
}

let tmpDir;
let app;
let dbPath;
let githubFetchMock;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-db-test-'));
  dbPath = path.join(tmpDir, 'kanban.db');
  githubFetchMock = vi.fn();
  app = createApp(path.join(tmpDir, 'boards'), {
    dbPath,
    githubOAuth: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://127.0.0.1:3000/api/auth/github/callback',
    },
    fetch: (...args) => githubFetchMock(...args),
  });
});

afterEach(() => {
  closeDatabase(app.locals.db);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('database-backed account API', () => {
  it('creates an account, board, card, and reads persisted rows back', async () => {
    const signup = await request(app, 'POST', '/api/auth/signup', {
      email: 'dev@example.com',
      name: 'Dev User',
      password: 'correct-password',
    });

    expect(signup.status).toBe(201);
    expect(signup.body.user.email).toBe('dev@example.com');
    expect(signup.sessionCookie).toMatch(/^clikanban_session=/);

    const me = await request(app, 'GET', '/api/me', null, signup.sessionCookie);
    expect(me.status).toBe(200);
    expect(me.body.user.name).toBe('Dev User');

    const board = await request(
      app,
      'POST',
      '/api/account/boards',
      {
        name: 'Product',
        columns: ['To Do', 'In Progress', 'Done'],
      },
      signup.sessionCookie
    );
    expect(board.status).toBe(201);
    expect(board.body.config.columns).toEqual(['To Do', 'In Progress', 'Done']);

    const card = await request(
      app,
      'POST',
      `/api/account/boards/${board.body.id}/cards`,
      {
        title: 'Persist card in SQL',
        status: 'To Do',
        link: 'https://github.com/example/repo/issues/1',
        customFields: { effort: 3 },
      },
      signup.sessionCookie
    );
    expect(card.status).toBe(201);
    expect(card.body.title).toBe('Persist card in SQL');
    expect(card.body.customFields).toEqual({ effort: 3 });

    const fetched = await request(
      app,
      'GET',
      `/api/account/boards/${board.body.id}`,
      null,
      signup.sessionCookie
    );
    expect(fetched.status).toBe(200);
    expect(fetched.body.cards).toHaveLength(1);
    expect(fetched.body.cards[0].title).toBe('Persist card in SQL');
    expect(fetched.body.cards[0].status).toBe('To Do');

    const dbCard = app.locals.db.prepare('SELECT title, custom_fields AS customFields FROM cards').get();
    expect(dbCard.title).toBe('Persist card in SQL');
    expect(JSON.parse(dbCard.customFields)).toEqual({ effort: 3 });

    const bulk = await request(
      app,
      'PUT',
      `/api/account/boards/${board.body.id}/cards`,
      {
        cards: [
          {
            id: card.body.id,
            title: 'Persist card in SQL updated',
            status: 'Done',
            link: card.body.link,
            customFields: { effort: 5, reviewed: true },
          },
        ],
      },
      signup.sessionCookie
    );
    expect(bulk.status).toBe(200);
    expect(bulk.body.board.cards[0].status).toBe('Done');
    expect(bulk.body.board.cards[0].customFields).toEqual({ effort: 5, reviewed: true });
  });

  it('protects account routes without a session', async () => {
    const res = await request(app, 'GET', '/api/account/boards');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects duplicate board names per account', async () => {
    const signup = await request(app, 'POST', '/api/auth/signup', {
      email: 'dev@example.com',
      password: 'correct-password',
    });

    const payload = { name: 'Product', columns: ['To Do'] };
    const first = await request(app, 'POST', '/api/account/boards', payload, signup.sessionCookie);
    const second = await request(app, 'POST', '/api/account/boards', payload, signup.sessionCookie);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it('refreshes GitHub metadata for DB-backed cards and applies status mapping', async () => {
    const signup = await request(app, 'POST', '/api/auth/signup', {
      email: 'dev@example.com',
      password: 'correct-password',
    });
    const board = await request(
      app,
      'POST',
      '/api/account/boards',
      { name: 'Product', columns: ['To Do', 'Done'] },
      signup.sessionCookie
    );
    const card = await request(
      app,
      'POST',
      `/api/account/boards/${board.body.id}/cards`,
      {
        title: 'Pull issue data',
        status: 'To Do',
        link: 'https://github.com/example/repo/issues/1',
      },
      signup.sessionCookie
    );

    await request(
      app,
      'PUT',
      `/api/account/boards/${board.body.id}/settings`,
      { githubStatusMap: { done: 'Done' } },
      signup.sessionCookie
    );

    githubFetchMock.mockImplementation((url) => {
      if (url === 'https://api.github.com/repos/example/repo/issues/1') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            title: 'Issue title from GitHub',
            state: 'open',
            labels: [{ name: 'done', color: '2da44e' }],
            milestone: { title: 'v1', due_on: '2026-08-01T00:00:00Z' },
            assignees: [{ login: 'dev' }],
            user: { login: 'octocat' },
            body: 'Issue body',
            comments: 2,
            created_at: '2026-06-01T10:00:00Z',
            updated_at: '2026-06-01T11:00:00Z',
            closed_at: null,
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    const refresh = await request(
      app,
      'POST',
      `/api/account/boards/${board.body.id}/github-refresh`,
      {},
      signup.sessionCookie
    );

    expect(refresh.status).toBe(200);
    expect(refresh.body.updated).toBe(1);
    expect(refresh.body.moved).toBe(1);
    expect(refresh.body.failed).toBe(0);
    expect(refresh.body.board.cards[0].id).toBe(card.body.id);
    expect(refresh.body.board.cards[0].status).toBe('Done');
    expect(refresh.body.board.cards[0].linkMeta.title).toBe('Issue title from GitHub');
    expect(refresh.body.board.cards[0].linkMeta.labels[0]).toEqual({ name: 'done', color: '2da44e' });

    const dbCard = app.locals.db.prepare(`
      SELECT link_meta AS linkMeta, board_columns.name AS status
      FROM cards
      JOIN board_columns ON board_columns.id = cards.column_id
      WHERE cards.id = ?
    `).get(card.body.id);
    expect(JSON.parse(dbCard.linkMeta).repo).toBe('repo');
    expect(dbCard.status).toBe('Done');
  });

  it('creates a session through GitHub OAuth callback', async () => {
    const start = await request(app, 'GET', '/api/auth/github');
    expect(start.status).toBe(302);
    expect(start.setCookie).toMatch(/^clikanban_oauth_state=/);

    const location = new URL(start.location);
    expect(location.hostname).toBe('github.com');
    expect(location.searchParams.get('client_id')).toBe('test-client-id');
    const state = location.searchParams.get('state');

    githubFetchMock.mockImplementation((url) => {
      if (url === 'https://github.com/login/oauth/access_token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'gh-token' }),
        });
      }
      if (url === 'https://api.github.com/user') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            id: 12345,
            login: 'octocat',
            name: 'Octo Cat',
            email: null,
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
          }),
        });
      }
      if (url === 'https://api.github.com/user/emails') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { email: 'octo@example.com', primary: true, verified: true },
          ]),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    const callback = await request(
      app,
      'GET',
      `/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
      null,
      start.sessionCookie
    );
    expect(callback.status).toBe(302);
    expect(callback.sessionCookie).toMatch(/^clikanban_session=/);

    const me = await request(app, 'GET', '/api/me', null, callback.sessionCookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('octo@example.com');
    expect(me.body.user.avatarUrl).toBe('https://avatars.githubusercontent.com/u/12345');

    const dbUser = app.locals.db.prepare('SELECT github_id AS githubId FROM users WHERE email = ?').get('octo@example.com');
    expect(dbUser.githubId).toBe('12345');
  });

  it('uses a public GitHub profile email without requesting private emails', async () => {
    const start = await request(app, 'GET', '/api/auth/github');
    const state = new URL(start.location).searchParams.get('state');

    githubFetchMock.mockImplementation((url) => {
      if (url === 'https://github.com/login/oauth/access_token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'gh-token' }),
        });
      }
      if (url === 'https://api.github.com/user') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            id: 67890,
            login: 'publicocto',
            name: 'Public Octo',
            email: 'public@example.com',
            avatar_url: 'https://avatars.githubusercontent.com/u/67890',
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ message: 'Forbidden' }) });
    });

    const callback = await request(
      app,
      'GET',
      `/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
      null,
      start.sessionCookie
    );

    expect(callback.status).toBe(302);
    expect(githubFetchMock).not.toHaveBeenCalledWith(
      'https://api.github.com/user/emails',
      expect.anything()
    );

    const me = await request(app, 'GET', '/api/me', null, callback.sessionCookie);
    expect(me.body.user.email).toBe('public@example.com');
    expect(me.body.user.avatarUrl).toBe('https://avatars.githubusercontent.com/u/67890');
  });

  it('uses a stable noreply email when GitHub email lookup is forbidden', async () => {
    const start = await request(app, 'GET', '/api/auth/github');
    const state = new URL(start.location).searchParams.get('state');

    githubFetchMock.mockImplementation((url) => {
      if (url === 'https://github.com/login/oauth/access_token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'gh-token' }),
        });
      }
      if (url === 'https://api.github.com/user') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            id: 13579,
            login: 'privateocto',
            name: 'Private Octo',
            email: null,
            avatar_url: 'https://avatars.githubusercontent.com/u/13579',
          }),
        });
      }
      if (url === 'https://api.github.com/user/emails') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'Resource not accessible' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    const callback = await request(
      app,
      'GET',
      `/api/auth/github/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
      null,
      start.sessionCookie
    );

    expect(callback.status).toBe(302);
    expect(callback.sessionCookie).toMatch(/^clikanban_session=/);

    const me = await request(app, 'GET', '/api/me', null, callback.sessionCookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('13579+privateocto@users.noreply.github.com');
    expect(me.body.user.avatarUrl).toBe('https://avatars.githubusercontent.com/u/13579');
  });
});
