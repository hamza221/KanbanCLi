import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProgram } from '../index.js';
import {
  boardExists,
  deleteBoard,
  readCards,
  readConfig,
  createBoard,
  writeCards,
  readSettings,
} from '../lib/store.js';

const TEST_BOARD = `test-cmds-${Date.now()}`;

/**
 * Helper: run the CLI program with given args and capture exit code.
 * We redirect console output to capture it.
 */
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
    program.exitOverride(); // prevent process.exit
    await program.parseAsync(['node', 'kanban', ...args]);
  } catch (err) {
    // Commander throws on exitOverride — ignore known exit errors
    if (err.code !== 'commander.helpDisplayed' && err.code !== 'commander.version') {
      // real error — note it
    }
  } finally {
    console.log = origLog;
    console.error = origErr;
  }

  const exitCode = process.exitCode;
  process.exitCode = oldExitCode;

  return { logs, errors, exitCode };
}

describe('CLI commands (integration)', () => {
  afterEach(async () => {
    try {
      await deleteBoard(TEST_BOARD);
    } catch {
      // ignore
    }
  });

  describe('board create / list / show / delete', () => {
    it('creates a board', async () => {
      const { logs } = await runCLI('board', 'create', TEST_BOARD, '-c', 'A,B,C');
      expect(logs.some((l) => l.includes('created'))).toBe(true);
      expect(await boardExists(TEST_BOARD)).toBe(true);
    });

    it('rejects creating a duplicate board', async () => {
      await createBoard(TEST_BOARD);
      const { errors, exitCode } = await runCLI('board', 'create', TEST_BOARD);
      expect(errors.some((e) => e.includes('already exists'))).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('lists boards', async () => {
      const { logs } = await runCLI('board', 'list');
      expect(logs.some((l) => l.includes('default'))).toBe(true);
    });

    it('shows board details', async () => {
      await createBoard(TEST_BOARD, ['X', 'Y']);
      const { logs } = await runCLI('board', 'show', TEST_BOARD);
      expect(logs.some((l) => l.includes('X, Y'))).toBe(true);
    });

    it('deletes a board', async () => {
      await createBoard(TEST_BOARD);
      const { logs } = await runCLI('board', 'delete', TEST_BOARD);
      expect(logs.some((l) => l.includes('deleted'))).toBe(true);
      expect(await boardExists(TEST_BOARD)).toBe(false);
    });

    it('rejects deleting non-existing board', async () => {
      const { errors, exitCode } = await runCLI('board', 'delete', 'nonexistent_xyz');
      expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  describe('card add / list / edit / remove', () => {
    beforeEach(async () => {
      await createBoard(TEST_BOARD, ['To Do', 'In Progress', 'Done']);
    });

    it('adds a card to first column by default', async () => {
      const { logs } = await runCLI('card', 'add', TEST_BOARD, 'My Task');
      expect(logs.some((l) => l.includes('My Task'))).toBe(true);

      const cards = await readCards(TEST_BOARD);
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe('My Task');
      expect(cards[0].status).toBe('To Do');
    });

    it('adds a card with options', async () => {
      await runCLI(
        'card', 'add', TEST_BOARD, 'Deadline Task',
        '-s', 'In Progress',
        '-d', '2026-04-01',
        '-l', 'https://example.com'
      );

      const cards = await readCards(TEST_BOARD);
      expect(cards[0].status).toBe('In Progress');
      expect(cards[0].deadline).toBe('2026-04-01');
      expect(cards[0].link).toBe('https://example.com');
    });

    it('rejects add with invalid status', async () => {
      const { errors, exitCode } = await runCLI(
        'card', 'add', TEST_BOARD, 'Bad', '-s', 'InvalidCol'
      );
      expect(errors.some((e) => e.includes('Invalid status'))).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('rejects add with invalid deadline format', async () => {
      const { errors, exitCode } = await runCLI(
        'card', 'add', TEST_BOARD, 'Bad', '-d', 'not-a-date'
      );
      expect(errors.some((e) => e.includes('YYYY-MM-DD'))).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('lists cards', async () => {
      await runCLI('card', 'add', TEST_BOARD, 'Task A');
      await runCLI('card', 'add', TEST_BOARD, 'Task B', '-s', 'Done');

      const { logs } = await runCLI('card', 'list', TEST_BOARD);
      expect(logs.some((l) => l.includes('Task A'))).toBe(true);
      expect(logs.some((l) => l.includes('Task B'))).toBe(true);
    });

    it('lists cards filtered by status', async () => {
      await runCLI('card', 'add', TEST_BOARD, 'Task A');
      await runCLI('card', 'add', TEST_BOARD, 'Task B', '-s', 'Done');

      const { logs } = await runCLI('card', 'list', TEST_BOARD, '-s', 'Done');
      expect(logs.some((l) => l.includes('Task B'))).toBe(true);
      expect(logs.some((l) => l.includes('Task A'))).toBe(false);
    });

    it('edits a card', async () => {
      await runCLI('card', 'add', TEST_BOARD, 'Original');
      const cards = await readCards(TEST_BOARD);
      const id = cards[0].id;

      await runCLI('card', 'edit', TEST_BOARD, id, '-t', 'Updated', '-s', 'Done');

      const updated = await readCards(TEST_BOARD);
      expect(updated[0].title).toBe('Updated');
      expect(updated[0].status).toBe('Done');
    });

    it('removes a card', async () => {
      await runCLI('card', 'add', TEST_BOARD, 'To Remove');
      const cards = await readCards(TEST_BOARD);
      const id = cards[0].id;

      const { logs } = await runCLI('card', 'remove', TEST_BOARD, id);
      expect(logs.some((l) => l.includes('removed'))).toBe(true);

      const remaining = await readCards(TEST_BOARD);
      expect(remaining).toHaveLength(0);
    });

    it('rejects removing non-existing card', async () => {
      const { errors, exitCode } = await runCLI('card', 'remove', TEST_BOARD, 'nonexistent');
      expect(errors.some((e) => e.includes('not found'))).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  describe('move command', () => {
    beforeEach(async () => {
      await createBoard(TEST_BOARD, ['To Do', 'In Progress', 'Done']);
    });

    it('moves a card to a new column', async () => {
      await runCLI('card', 'add', TEST_BOARD, 'Move Me');
      const cards = await readCards(TEST_BOARD);
      const id = cards[0].id;

      const { logs } = await runCLI('move', TEST_BOARD, id, 'Done');
      expect(logs.some((l) => l.includes('Moved'))).toBe(true);

      const updated = await readCards(TEST_BOARD);
      expect(updated[0].status).toBe('Done');
    });

    it('rejects move to invalid column', async () => {
      await runCLI('card', 'add', TEST_BOARD, 'Move Me');
      const cards = await readCards(TEST_BOARD);
      const id = cards[0].id;

      const { errors, exitCode } = await runCLI('move', TEST_BOARD, id, 'InvalidCol');
      expect(errors.some((e) => e.includes('Invalid status'))).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('rejects move of non-existing card', async () => {
      const { errors, exitCode } = await runCLI('move', TEST_BOARD, 'nonexistent', 'Done');
      expect(errors.some((e) => e.includes('not found'))).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  describe('settings commands', () => {
    beforeEach(async () => {
      await createBoard(TEST_BOARD, ['To Do', 'In Progress', 'Done']);
    });

    it('shows settings for a board', async () => {
      const { logs } = await runCLI('settings', 'show', TEST_BOARD);
      expect(logs.some((l) => l.includes('Settings for board'))).toBe(true);
      expect(logs.some((l) => l.includes('No GitHub label'))).toBe(true);
    });

    it('sets a label-to-status mapping', async () => {
      const { logs } = await runCLI('settings', 'set-map', TEST_BOARD, 'bug', 'To Do');
      expect(logs.some((l) => l.includes('Mapped'))).toBe(true);

      const settings = await readSettings(TEST_BOARD);
      expect(settings.githubStatusMap.bug).toBe('To Do');
    });

    it('shows mappings after setting them', async () => {
      await runCLI('settings', 'set-map', TEST_BOARD, 'enhancement', 'In Progress');
      const { logs } = await runCLI('settings', 'show', TEST_BOARD);
      expect(logs.some((l) => l.includes('enhancement'))).toBe(true);
      expect(logs.some((l) => l.includes('In Progress'))).toBe(true);
    });

    it('removes a mapping', async () => {
      await runCLI('settings', 'set-map', TEST_BOARD, 'wontfix', 'Done');
      const { logs } = await runCLI('settings', 'remove-map', TEST_BOARD, 'wontfix');
      expect(logs.some((l) => l.includes('Removed'))).toBe(true);

      const settings = await readSettings(TEST_BOARD);
      expect(settings.githubStatusMap.wontfix).toBeUndefined();
    });

    it('rejects set-map with invalid column', async () => {
      const { errors, exitCode } = await runCLI('settings', 'set-map', TEST_BOARD, 'bug', 'InvalidCol');
      expect(errors.some((e) => e.includes('not a valid column'))).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('rejects remove-map for non-existing mapping', async () => {
      const { errors, exitCode } = await runCLI('settings', 'remove-map', TEST_BOARD, 'nonexistent');
      expect(errors.some((e) => e.includes('No mapping found'))).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('rejects settings commands for non-existing board', async () => {
      const { errors, exitCode } = await runCLI('settings', 'show', 'fake-board-xyz');
      expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  describe('help command', () => {
    it('shows all command groups', async () => {
      const { logs } = await runCLI('help');
      const output = logs.join('\n');
      expect(output).toContain('CLIkanban');
      expect(output).toContain('Board');
      expect(output).toContain('Card');
      expect(output).toContain('Move');
      expect(output).toContain('GitHub');
      expect(output).toContain('Recurring');
      expect(output).toContain('Settings');
    });

    it('shows global options', async () => {
      const { logs } = await runCLI('help');
      const output = logs.join('\n');
      expect(output).toContain('--interactive');
      expect(output).toContain('--no-interactive');
      expect(output).toContain('--ni');
      expect(output).toContain('--version');
    });

    it('filters to a specific group', async () => {
      const { logs } = await runCLI('help', 'card');
      const output = logs.join('\n');
      expect(output).toContain('Card');
      expect(output).toContain('card add');
      expect(output).not.toContain('board list');
    });

    it('shows error for unknown group', async () => {
      const { logs } = await runCLI('help', 'nonexistent');
      const output = logs.join('\n');
      expect(output).toContain('Unknown command group');
    });
  });
});
