import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGitHubUrl } from '../lib/github.js';
import { createProgram } from '../index.js';
import {
  createBoard,
  deleteBoard,
  readCards,
  writeCards,
  writeSettings,
} from '../lib/store.js';

describe('parseGitHubUrl', () => {
  it('parses an issue URL', () => {
    const result = parseGitHubUrl('https://github.com/acme/repo/issues/42');
    expect(result).toEqual({
      owner: 'acme',
      repo: 'repo',
      type: 'issue',
      number: 42,
    });
  });

  it('parses a PR URL', () => {
    const result = parseGitHubUrl('https://github.com/acme/repo/pull/99');
    expect(result).toEqual({
      owner: 'acme',
      repo: 'repo',
      type: 'pr',
      number: 99,
    });
  });

  it('parses URL without protocol', () => {
    const result = parseGitHubUrl('github.com/org/project/issues/1');
    expect(result).toEqual({
      owner: 'org',
      repo: 'project',
      type: 'issue',
      number: 1,
    });
  });

  it('returns null for non-GitHub URL', () => {
    expect(parseGitHubUrl('https://example.com/issues/1')).toBe(null);
  });

  it('returns null for GitHub URL without issue/PR number', () => {
    expect(parseGitHubUrl('https://github.com/acme/repo')).toBe(null);
  });

  it('returns null for invalid path pattern', () => {
    expect(parseGitHubUrl('https://github.com/acme/repo/blob/main/file.js')).toBe(null);
  });
});

// Integration tests for add-gh and refresh commands
const TEST_BOARD = `test-gh-${Date.now()}`;

async function runCLI(...args) {
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));

  const oldExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const program = createProgram();
    program.exitOverride();
    await program.parseAsync(['node', 'kanban', ...args]);
  } catch {
    // Commander exit override
  } finally {
    console.log = origLog;
    console.error = origErr;
  }

  const exitCode = process.exitCode;
  process.exitCode = oldExitCode;
  return { logs, errors, exitCode };
}

describe('card add-gh command', () => {
  beforeEach(async () => {
    await createBoard(TEST_BOARD, ['To Do', 'In Progress', 'Done']);
  });

  afterEach(async () => {
    try {
      await deleteBoard(TEST_BOARD);
    } catch {
      // ignore
    }
  });

  it('rejects non-existing board', async () => {
    const { errors, exitCode } = await runCLI(
      'card', 'add-gh', 'nonexistent_xyz', 'https://github.com/a/b/issues/1'
    );
    expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
    expect(exitCode).toBe(1);
  });

  it('rejects invalid GitHub URL', async () => {
    const { errors, exitCode } = await runCLI(
      'card', 'add-gh', TEST_BOARD, 'https://example.com/not-github'
    );
    expect(errors.some((e) => e.includes('Invalid GitHub URL'))).toBe(true);
    expect(exitCode).toBe(1);
  });

  it('rejects invalid status column', async () => {
    const { errors, exitCode } = await runCLI(
      'card', 'add-gh', TEST_BOARD, 'https://github.com/a/b/issues/1', '-s', 'BadCol'
    );
    expect(errors.some((e) => e.includes('Invalid status'))).toBe(true);
    expect(exitCode).toBe(1);
  });
});

describe('card refresh command', () => {
  beforeEach(async () => {
    await createBoard(TEST_BOARD, ['To Do', 'Done']);
  });

  afterEach(async () => {
    try {
      await deleteBoard(TEST_BOARD);
    } catch {
      // ignore
    }
  });

  it('reports no GitHub-linked cards', async () => {
    // Add a card without a link
    const now = new Date().toISOString();
    await writeCards(TEST_BOARD, [
      {
        id: 'test-1',
        title: 'No link',
        status: 'To Do',
        link: null,
        linkMeta: null,
        deadline: null,
        recurring: null,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const { logs } = await runCLI('card', 'refresh', TEST_BOARD);
    expect(logs.some((l) => l.includes('No GitHub-linked cards'))).toBe(true);
  });

  it('rejects non-existing board', async () => {
    const { errors, exitCode } = await runCLI('card', 'refresh', 'nonexistent_xyz');
    expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
    expect(exitCode).toBe(1);
  });
});

describe('card refresh with githubStatusMap', () => {
  const MAP_BOARD = `test-ghmap-${Date.now()}`;

  beforeEach(async () => {
    await createBoard(MAP_BOARD, ['To Do', 'In Progress', 'Done']);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await deleteBoard(MAP_BOARD);
    } catch {
      // ignore
    }
  });

  it('moves a card to the mapped column based on label', async () => {
    const now = new Date().toISOString();
    await writeCards(MAP_BOARD, [
      {
        id: 'map-1',
        title: 'Issue with label',
        status: 'To Do',
        link: 'https://github.com/acme/repo/issues/10',
        linkMeta: null,
        deadline: null,
        recurring: null,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Write settings with label mapping
    await writeSettings(MAP_BOARD, {
      githubStatusMap: { 'in-progress': 'In Progress' },
    });

    // Mock fetchGitHubMeta to return labels
    const github = await import('../lib/github.js');
    vi.spyOn(github, 'fetchGitHubMeta').mockResolvedValue({
      type: 'issue',
      owner: 'acme',
      repo: 'repo',
      number: 10,
      title: 'Updated title',
      state: 'open',
      labels: [{ name: 'in-progress', color: 'ededed' }],
      milestone: null,
      milestoneDueOn: null,
      assignees: [],
      author: 'user',
      bodyExcerpt: null,
      commentsCount: 0,
      ghCreatedAt: now,
      ghUpdatedAt: now,
      ghClosedAt: null,
      fetchedAt: now,
    });

    const { logs } = await runCLI('card', 'refresh', MAP_BOARD);
    expect(logs.some((l) => l.includes('Refreshed 1 card(s)'))).toBe(true);
    expect(logs.some((l) => l.includes('Moved 1 card(s)'))).toBe(true);

    const cards = await readCards(MAP_BOARD);
    expect(cards[0].status).toBe('In Progress');
    expect(cards[0].title).toBe('Updated title');
  });

  it('does not move card when label does not match any mapping', async () => {
    const now = new Date().toISOString();
    await writeCards(MAP_BOARD, [
      {
        id: 'map-2',
        title: 'No matching label',
        status: 'To Do',
        link: 'https://github.com/acme/repo/issues/20',
        linkMeta: null,
        deadline: null,
        recurring: null,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await writeSettings(MAP_BOARD, {
      githubStatusMap: { 'done': 'Done' },
    });

    const github = await import('../lib/github.js');
    vi.spyOn(github, 'fetchGitHubMeta').mockResolvedValue({
      type: 'issue',
      owner: 'acme',
      repo: 'repo',
      number: 20,
      title: 'Still in To Do',
      state: 'open',
      labels: [{ name: 'bug', color: 'd73a4a' }],
      milestone: null,
      milestoneDueOn: null,
      assignees: [],
      author: 'user',
      bodyExcerpt: null,
      commentsCount: 0,
      ghCreatedAt: now,
      ghUpdatedAt: now,
      ghClosedAt: null,
      fetchedAt: now,
    });

    await runCLI('card', 'refresh', MAP_BOARD);

    const cards = await readCards(MAP_BOARD);
    expect(cards[0].status).toBe('To Do');
  });

  it('does not move card when mapped column is not in board columns', async () => {
    const now = new Date().toISOString();
    await writeCards(MAP_BOARD, [
      {
        id: 'map-3',
        title: 'Invalid column mapping',
        status: 'To Do',
        link: 'https://github.com/acme/repo/issues/30',
        linkMeta: null,
        deadline: null,
        recurring: null,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await writeSettings(MAP_BOARD, {
      githubStatusMap: { 'bug': 'Nonexistent Column' },
    });

    const github = await import('../lib/github.js');
    vi.spyOn(github, 'fetchGitHubMeta').mockResolvedValue({
      type: 'issue',
      owner: 'acme',
      repo: 'repo',
      number: 30,
      title: 'Stays put',
      state: 'open',
      labels: [{ name: 'bug', color: 'd73a4a' }],
      milestone: null,
      milestoneDueOn: null,
      assignees: [],
      author: 'user',
      bodyExcerpt: null,
      commentsCount: 0,
      ghCreatedAt: now,
      ghUpdatedAt: now,
      ghClosedAt: null,
      fetchedAt: now,
    });

    await runCLI('card', 'refresh', MAP_BOARD);

    const cards = await readCards(MAP_BOARD);
    expect(cards[0].status).toBe('To Do');
  });
});
