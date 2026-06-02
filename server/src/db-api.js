import crypto from 'crypto';
import {
  clearSessionCookie,
  clearOauthStateCookie,
  createSession,
  deleteSession,
  getSessionUser,
  hashPassword,
  oauthStateCookie,
  oauthStateCookieName,
  parseCookies,
  sessionCookie,
  sessionCookieName,
  verifyPassword,
} from './auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
  };
}

function requireAuth(db) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[sessionCookieName()];
    const user = getSessionUser(db, sessionId);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
  };
}

function requireBoardRole(db, minimumRole = 'viewer') {
  const roleRank = { viewer: 1, editor: 2, owner: 3 };
  return (req, res, next) => {
    const boardId = req.params.boardId;
    const member = db.prepare(`
      SELECT role FROM board_members
      WHERE board_id = ? AND user_id = ?
    `).get(boardId, req.user.id);

    if (!member) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (roleRank[member.role] < roleRank[minimumRole]) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    req.boardRole = member.role;
    next();
  };
}

function getBoardPayload(db, boardId, userId) {
  const board = db.prepare(`
    SELECT boards.id, boards.name, boards.owner_id AS ownerId, board_members.role
    FROM boards
    JOIN board_members ON board_members.board_id = boards.id
    WHERE boards.id = ? AND board_members.user_id = ?
  `).get(boardId, userId);

  if (!board) return null;

  const columns = db.prepare(`
    SELECT id, name, position
    FROM board_columns
    WHERE board_id = ?
    ORDER BY position ASC, id ASC
  `).all(boardId);

  const cards = db.prepare(`
    SELECT
      cards.id,
      cards.title,
      cards.link,
      cards.link_meta AS linkMeta,
      cards.deadline,
      cards.recurring,
      cards.custom_fields AS customFields,
      cards.position,
      cards.created_at AS createdAt,
      cards.updated_at AS updatedAt,
      board_columns.name AS status,
      board_columns.id AS columnId
    FROM cards
    JOIN board_columns ON board_columns.id = cards.column_id
    WHERE cards.board_id = ?
    ORDER BY board_columns.position ASC, cards.position ASC, cards.id ASC
  `).all(boardId).map((card) => ({
    id: card.id,
    title: card.title,
    status: card.status,
    columnId: card.columnId,
    link: card.link,
    linkMeta: parseJson(card.linkMeta, null),
    deadline: card.deadline,
    recurring: parseJson(card.recurring, null),
    customFields: parseJson(card.customFields, {}),
    position: card.position,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  }));

  const settingsRow = db.prepare(`
    SELECT github_status_map AS githubStatusMap
    FROM board_settings
    WHERE board_id = ?
  `).get(boardId);

  return {
    id: board.id,
    name: board.name,
    ownerId: board.ownerId,
    role: board.role,
    config: {
      name: board.name,
      columns: columns.map((column) => column.name),
      customFields: [],
    },
    columns,
    cards,
    settings: {
      githubStatusMap: parseJson(settingsRow?.githubStatusMap, {}),
    },
  };
}

function columnForStatus(db, boardId, status) {
  return db.prepare(`
    SELECT id, name FROM board_columns
    WHERE board_id = ? AND name = ?
  `).get(boardId, status);
}

function serializeNullableJson(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return JSON.stringify(value);
}

function parseGithubCardUrl(url) {
  const cleaned = String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
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

function formatGithubMeta(parsed, data) {
  const labels = Array.isArray(data.labels)
    ? data.labels.map((label) => {
        if (typeof label === 'string') return { name: label, color: null };
        return { name: label.name, color: label.color || null };
      })
    : [];

  const assignees = Array.isArray(data.assignees)
    ? data.assignees.map((assignee) => (
        typeof assignee === 'string' ? assignee : assignee.login
      ))
    : [];

  return {
    type: parsed.type,
    owner: parsed.owner,
    repo: parsed.repo,
    number: parsed.number,
    title: data.title || null,
    state: data.state || null,
    labels,
    milestone: data.milestone?.title ?? null,
    milestoneDueOn: data.milestone?.due_on?.slice(0, 10) ?? null,
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
    fetchedAt: nowIso(),
  };
}

async function fetchGithubCardMeta(fetchImpl, parsed) {
  const endpoint =
    parsed.type === 'pr'
      ? `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`
      : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetchImpl(endpoint, { headers });
  const data = await res.json();
  if (!res.ok) {
    const detail = data.message || data.error_description || data.error || `GitHub returned ${res.status}`;
    throw new Error(`GitHub metadata request failed for ${endpoint}: ${detail}`);
  }

  return formatGithubMeta(parsed, data);
}

async function fetchGithubJson(fetchImpl, url, accessToken) {
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data.message || data.error_description || data.error || `GitHub returned ${res.status}`;
    const err = new Error(`GitHub API request failed for ${url}: ${detail}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return data;
}

async function fetchGithubEmails(fetchImpl, accessToken) {
  return fetchGithubJson(fetchImpl, 'https://api.github.com/user/emails', accessToken);
}

function selectGithubEmail(githubUser, emails) {
  if (githubUser.email) return String(githubUser.email).toLowerCase();
  if (!Array.isArray(emails)) return null;

  const selected =
    emails.find((email) => email.primary && email.verified) ||
    emails.find((email) => email.verified) ||
    emails[0];

  return selected?.email ? String(selected.email).toLowerCase() : null;
}

function fallbackGithubEmail(githubUser) {
  const id = String(githubUser.id || '').trim();
  if (!id) return null;

  const login = String(githubUser.login || 'github-user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'github-user';

  return `${id}+${login}@users.noreply.github.com`;
}

function upsertGithubUser(db, profile) {
  const at = nowIso();
  const existing = db.prepare(`
    SELECT id, email, name, avatar_url AS avatarUrl
    FROM users
    WHERE github_id = ? OR email = ?
    ORDER BY github_id = ? DESC
    LIMIT 1
  `).get(profile.githubId, profile.email, profile.githubId);

  if (existing) {
    db.prepare(`
      UPDATE users
      SET github_id = ?, name = COALESCE(NULLIF(name, ''), ?), avatar_url = ?, updated_at = ?
      WHERE id = ?
    `).run(profile.githubId, profile.name, profile.avatarUrl, at, existing.id);

    return {
      ...existing,
      name: existing.name || profile.name,
      avatarUrl: profile.avatarUrl,
    };
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, github_id, avatar_url, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?)
  `).run(id, profile.email, profile.name, profile.githubId, profile.avatarUrl, at, at);

  return {
    id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
  };
}

export function registerDatabaseApi(app, db, options = {}) {
  const secureCookies = options.secureCookies ?? false;
  const auth = requireAuth(db);
  const githubOAuth = {
    clientId: options.githubOAuth?.clientId || process.env.GITHUB_CLIENT_ID,
    clientSecret: options.githubOAuth?.clientSecret || process.env.GITHUB_CLIENT_SECRET,
    redirectUri: options.githubOAuth?.redirectUri || process.env.GITHUB_OAUTH_REDIRECT_URL,
  };
  const fetchImpl = options.fetch || globalThis.fetch;

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const name = String(req.body.name || '').trim() || null;

      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(409).json({ error: 'Account already exists' });
      }

      const id = crypto.randomUUID();
      const at = nowIso();
      const passwordHash = await hashPassword(password);

      db.prepare(`
        INSERT INTO users (id, email, name, password_hash, github_id, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
      `).run(id, email, name, passwordHash, at, at);

      const session = createSession(db, id);
      res.setHeader('Set-Cookie', sessionCookie(session.id, session.expiresAt, secureCookies));
      res.status(201).json({ user: publicUser({ id, email, name }) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const user = db.prepare(`
      SELECT id, email, name, avatar_url AS avatarUrl, password_hash AS passwordHash
      FROM users
      WHERE email = ?
    `).get(email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const session = createSession(db, user.id);
    res.setHeader('Set-Cookie', sessionCookie(session.id, session.expiresAt, secureCookies));
    res.json({ user: publicUser(user) });
  });

  app.get('/api/auth/github', (req, res) => {
    if (!githubOAuth.clientId || !githubOAuth.clientSecret) {
      return res.status(503).json({ error: 'GitHub OAuth is not configured' });
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const redirectUri = githubOAuth.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', githubOAuth.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);

    res.setHeader('Set-Cookie', oauthStateCookie(state, secureCookies));
    res.redirect(url.toString());
  });

  app.get('/api/auth/github/callback', async (req, res) => {
    if (!githubOAuth.clientId || !githubOAuth.clientSecret) {
      return res.status(503).json({ error: 'GitHub OAuth is not configured' });
    }

    const cookies = parseCookies(req.headers.cookie);
    if (!req.query.code || !req.query.state || cookies[oauthStateCookieName()] !== req.query.state) {
      return res.status(400).json({ error: 'Invalid GitHub OAuth state' });
    }

    try {
      const redirectUri = githubOAuth.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
      const tokenRes = await fetchImpl('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: githubOAuth.clientId,
          client_secret: githubOAuth.clientSecret,
          code: String(req.query.code),
          redirect_uri: redirectUri,
          state: String(req.query.state),
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        const detail = tokenData.error_description || tokenData.error || `GitHub returned ${tokenRes.status}`;
        return res.status(502).json({
          error: 'Failed to exchange GitHub OAuth code',
          detail,
        });
      }

      const githubUser = await fetchGithubJson(fetchImpl, 'https://api.github.com/user', tokenData.access_token);
      let email = selectGithubEmail(githubUser, []);

      if (!email) {
        try {
          email = selectGithubEmail(githubUser, await fetchGithubEmails(fetchImpl, tokenData.access_token));
        } catch (err) {
          if (err.status !== 403) throw err;
          email = fallbackGithubEmail(githubUser);
        }
      }

      if (!email) {
        return res.status(400).json({ error: 'GitHub account has no accessible email' });
      }

      const user = upsertGithubUser(db, {
        email,
        githubId: String(githubUser.id),
        name: githubUser.name || githubUser.login || email,
        avatarUrl: githubUser.avatar_url || null,
      });
      const session = createSession(db, user.id);

      res.setHeader('Set-Cookie', [
        sessionCookie(session.id, session.expiresAt, secureCookies),
        clearOauthStateCookie(),
      ]);
      res.redirect('/');
    } catch (err) {
      res.status(502).json({
        error: err.message,
        detail: err.detail || null,
      });
    }
  });

  app.post('/api/auth/logout', auth, (req, res) => {
    deleteSession(db, req.sessionId);
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
  });

  app.get('/api/me', auth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  app.get('/api/account/boards', auth, (req, res) => {
    const boards = db.prepare(`
      SELECT boards.id, boards.name, boards.owner_id AS ownerId, board_members.role, boards.created_at AS createdAt, boards.updated_at AS updatedAt
      FROM boards
      JOIN board_members ON board_members.board_id = boards.id
      WHERE board_members.user_id = ?
      ORDER BY boards.created_at ASC
    `).all(req.user.id);
    res.json(boards);
  });

  app.post('/api/account/boards', auth, (req, res) => {
    const name = String(req.body.name || '').trim();
    const columns = Array.isArray(req.body.columns)
      ? req.body.columns.map((column) => String(column).trim()).filter(Boolean)
      : [];

    if (!name || columns.length === 0) {
      return res.status(400).json({ error: 'Name and columns are required' });
    }

    const boardId = crypto.randomUUID();
    const at = nowIso();

    try {
      db.exec('BEGIN');
      db.prepare(`
        INSERT INTO boards (id, owner_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(boardId, req.user.id, name, at, at);

      db.prepare(`
        INSERT INTO board_members (board_id, user_id, role)
        VALUES (?, ?, 'owner')
      `).run(boardId, req.user.id);

      const insertColumn = db.prepare(`
        INSERT INTO board_columns (id, board_id, name, position)
        VALUES (?, ?, ?, ?)
      `);
      columns.forEach((column, index) => {
        insertColumn.run(crypto.randomUUID(), boardId, column, index);
      });

      db.prepare(`
        INSERT INTO board_settings (board_id, github_status_map)
        VALUES (?, ?)
      `).run(boardId, JSON.stringify({}));

      db.exec('COMMIT');
      res.status(201).json(getBoardPayload(db, boardId, req.user.id));
    } catch (err) {
      db.exec('ROLLBACK');
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'Board already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get(
    '/api/account/boards/:boardId',
    auth,
    requireBoardRole(db, 'viewer'),
    (req, res) => {
      res.json(getBoardPayload(db, req.params.boardId, req.user.id));
    }
  );

  app.post(
    '/api/account/boards/:boardId/cards',
    auth,
    requireBoardRole(db, 'editor'),
    (req, res) => {
      const title = String(req.body.title || '').trim();
      const status = String(req.body.status || '').trim();
      const column = columnForStatus(db, req.params.boardId, status);

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!column) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const nextPositionRow = db.prepare(`
        SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
        FROM cards
        WHERE column_id = ?
      `).get(column.id);
      const id = crypto.randomUUID();
      const at = nowIso();

      db.prepare(`
        INSERT INTO cards (
          id, board_id, column_id, title, link, link_meta, deadline, recurring,
          custom_fields, position, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.params.boardId,
        column.id,
        title,
        req.body.link || null,
        req.body.linkMeta ? JSON.stringify(req.body.linkMeta) : null,
        req.body.deadline || null,
        req.body.recurring ? JSON.stringify(req.body.recurring) : null,
        JSON.stringify(req.body.customFields || {}),
        nextPositionRow.nextPosition,
        at,
        at
      );

      res.status(201).json({
        id,
        title,
        status: column.name,
        columnId: column.id,
        link: req.body.link || null,
        linkMeta: req.body.linkMeta || null,
        deadline: req.body.deadline || null,
        recurring: req.body.recurring || null,
        customFields: req.body.customFields || {},
        position: nextPositionRow.nextPosition,
        createdAt: at,
        updatedAt: at,
      });
    }
  );

  app.put(
    '/api/account/boards/:boardId/cards',
    auth,
    requireBoardRole(db, 'editor'),
    (req, res) => {
      const cards = Array.isArray(req.body.cards) ? req.body.cards : null;
      if (!cards) {
        return res.status(400).json({ error: 'Cards array is required' });
      }

      const columns = db.prepare(`
        SELECT id, name
        FROM board_columns
        WHERE board_id = ?
      `).all(req.params.boardId);
      const columnsByName = new Map(columns.map((column) => [column.name, column]));

      const seenIds = [];
      const at = nowIso();
      const existingIds = new Set(
        db.prepare('SELECT id FROM cards WHERE board_id = ?').all(req.params.boardId).map((row) => row.id)
      );

      const upsert = db.prepare(`
        INSERT INTO cards (
          id, board_id, column_id, title, link, link_meta, deadline, recurring,
          custom_fields, position, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          column_id = excluded.column_id,
          title = excluded.title,
          link = excluded.link,
          link_meta = excluded.link_meta,
          deadline = excluded.deadline,
          recurring = excluded.recurring,
          custom_fields = excluded.custom_fields,
          position = excluded.position,
          updated_at = excluded.updated_at
      `);

      try {
        db.exec('BEGIN');
        cards.forEach((card, index) => {
          const id = String(card.id || crypto.randomUUID());
          const title = String(card.title || '').trim();
          const column = columnsByName.get(String(card.status || '').trim());

          if (!title) {
            throw new Error('Card title is required');
          }
          if (!column) {
            throw new Error(`Invalid card status: ${card.status}`);
          }

          seenIds.push(id);
          upsert.run(
            id,
            req.params.boardId,
            column.id,
            title,
            card.link || null,
            serializeNullableJson(card.linkMeta),
            card.deadline || null,
            serializeNullableJson(card.recurring),
            JSON.stringify(card.customFields || {}),
            Number.isInteger(card.position) ? card.position : index,
            existingIds.has(id) ? (card.createdAt || at) : (card.createdAt || at),
            at
          );
        });

        if (seenIds.length > 0) {
          const placeholders = seenIds.map(() => '?').join(', ');
          db.prepare(`
            DELETE FROM cards
            WHERE board_id = ? AND id NOT IN (${placeholders})
          `).run(req.params.boardId, ...seenIds);
        } else {
          db.prepare('DELETE FROM cards WHERE board_id = ?').run(req.params.boardId);
        }

        db.exec('COMMIT');
        res.json({ ok: true, board: getBoardPayload(db, req.params.boardId, req.user.id) });
      } catch (err) {
        db.exec('ROLLBACK');
        res.status(400).json({ error: err.message });
      }
    }
  );

  app.post(
    '/api/account/boards/:boardId/github-refresh',
    auth,
    requireBoardRole(db, 'editor'),
    async (req, res) => {
      const columns = db.prepare(`
        SELECT id, name
        FROM board_columns
        WHERE board_id = ?
        ORDER BY position ASC
      `).all(req.params.boardId);
      const columnsByName = new Map(columns.map((column) => [column.name, column]));

      const settingsRow = db.prepare(`
        SELECT github_status_map AS githubStatusMap
        FROM board_settings
        WHERE board_id = ?
      `).get(req.params.boardId);
      const statusMap = parseJson(settingsRow?.githubStatusMap, {});

      const cards = db.prepare(`
        SELECT id, link, column_id AS columnId
        FROM cards
        WHERE board_id = ? AND link LIKE '%github.com%'
        ORDER BY position ASC, id ASC
      `).all(req.params.boardId);

      let updated = 0;
      let moved = 0;
      let failed = 0;

      const updateCard = db.prepare(`
        UPDATE cards
        SET link_meta = ?, column_id = ?, position = ?, updated_at = ?
        WHERE id = ?
      `);

      for (const card of cards) {
        const parsed = parseGithubCardUrl(card.link);
        if (!parsed) continue;

        try {
          const meta = await fetchGithubCardMeta(fetchImpl, parsed);
          let columnId = card.columnId;
          let position = null;

          for (const label of meta.labels) {
            const targetColumn = columnsByName.get(statusMap[label.name]);
            if (targetColumn && targetColumn.id !== card.columnId) {
              columnId = targetColumn.id;
              const nextPosition = db.prepare(`
                SELECT COALESCE(MAX(position), -1) + 1 AS value
                FROM cards
                WHERE column_id = ?
              `).get(targetColumn.id);
              position = nextPosition.value;
              moved++;
              break;
            }
          }

          if (position === null) {
            const currentPosition = db.prepare('SELECT position FROM cards WHERE id = ?').get(card.id);
            position = currentPosition.position;
          }

          updateCard.run(JSON.stringify(meta), columnId, position, nowIso(), card.id);
          updated++;
        } catch {
          failed++;
        }
      }

      res.json({
        ok: true,
        updated,
        moved,
        failed,
        board: getBoardPayload(db, req.params.boardId, req.user.id),
      });
    }
  );

  app.patch('/api/account/cards/:cardId', auth, (req, res) => {
    const current = db.prepare(`
      SELECT cards.id, cards.board_id AS boardId, cards.column_id AS columnId, board_members.role
      FROM cards
      JOIN board_members ON board_members.board_id = cards.board_id
      WHERE cards.id = ? AND board_members.user_id = ?
    `).get(req.params.cardId, req.user.id);

    if (!current) {
      return res.status(404).json({ error: 'Card not found' });
    }
    if (current.role === 'viewer') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    let columnId = current.columnId;
    if (req.body.status !== undefined) {
      const column = columnForStatus(db, current.boardId, String(req.body.status).trim());
      if (!column) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      columnId = column.id;
    }

    const existing = db.prepare(`
      SELECT title, link, link_meta AS linkMeta, deadline, recurring, custom_fields AS customFields
      FROM cards
      WHERE id = ?
    `).get(req.params.cardId);

    const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const at = nowIso();
    db.prepare(`
      UPDATE cards
      SET title = ?, column_id = ?, link = ?, link_meta = ?, deadline = ?, recurring = ?, custom_fields = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      columnId,
      req.body.link !== undefined ? req.body.link : existing.link,
      req.body.linkMeta !== undefined ? JSON.stringify(req.body.linkMeta) : existing.linkMeta,
      req.body.deadline !== undefined ? req.body.deadline : existing.deadline,
      req.body.recurring !== undefined ? JSON.stringify(req.body.recurring) : existing.recurring,
      req.body.customFields !== undefined ? JSON.stringify(req.body.customFields) : existing.customFields,
      at,
      req.params.cardId
    );

    res.json({ ok: true, card: db.prepare('SELECT id, title, updated_at AS updatedAt FROM cards WHERE id = ?').get(req.params.cardId) });
  });

  app.delete('/api/account/cards/:cardId', auth, (req, res) => {
    const current = db.prepare(`
      SELECT cards.id, board_members.role
      FROM cards
      JOIN board_members ON board_members.board_id = cards.board_id
      WHERE cards.id = ? AND board_members.user_id = ?
    `).get(req.params.cardId, req.user.id);

    if (!current) {
      return res.status(404).json({ error: 'Card not found' });
    }
    if (current.role === 'viewer') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.cardId);
    res.json({ ok: true });
  });

  app.put(
    '/api/account/boards/:boardId/settings',
    auth,
    requireBoardRole(db, 'editor'),
    (req, res) => {
      db.prepare(`
        INSERT INTO board_settings (board_id, github_status_map)
        VALUES (?, ?)
        ON CONFLICT(board_id) DO UPDATE SET github_status_map = excluded.github_status_map
      `).run(req.params.boardId, JSON.stringify(req.body.githubStatusMap || {}));
      res.json({ ok: true });
    }
  );

  app.get(
    '/api/account/boards/:boardId/settings',
    auth,
    requireBoardRole(db, 'viewer'),
    (req, res) => {
      const row = db.prepare(`
        SELECT github_status_map AS githubStatusMap
        FROM board_settings
        WHERE board_id = ?
      `).get(req.params.boardId);
      res.json({ githubStatusMap: parseJson(row?.githubStatusMap, {}) });
    }
  );
}
