import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processRecurring } from '../lib/recurring.js';
import { createProgram } from '../index.js';
import {
  createBoard,
  deleteBoard,
  readCards,
  writeCards,
} from '../lib/store.js';

describe('processRecurring (unit)', () => {
  const config = { columns: ['To Do', 'In Progress', 'Done'] };

  it('resets a weekly card when lastReset is from a previous week', () => {
    // Use a known date: Monday 2026-03-23 (ISO week 13)
    const now = new Date('2026-03-23T12:00:00Z');

    const cards = [
      {
        id: '1',
        title: 'Weekly standup',
        status: 'Done',
        recurring: {
          frequency: 'weekly',
          lastReset: '2026-03-16', // ISO week 12
          resetToStatus: 'To Do',
        },
      },
    ];

    const result = processRecurring(cards, config, now);
    expect(result).toBe(true);
    expect(cards[0].status).toBe('To Do');
    expect(cards[0].recurring.lastReset).toBe('2026-03-23');
  });

  it('does NOT reset a card that was already reset this week', () => {
    const now = new Date('2026-03-23T12:00:00Z'); // ISO week 13

    const cards = [
      {
        id: '1',
        title: 'Weekly standup',
        status: 'Done',
        recurring: {
          frequency: 'weekly',
          lastReset: '2026-03-23', // Same week
          resetToStatus: 'To Do',
        },
      },
    ];

    const result = processRecurring(cards, config, now);
    expect(result).toBe(false);
    expect(cards[0].status).toBe('Done'); // unchanged
  });

  it('resets card with null lastReset', () => {
    const now = new Date('2026-03-23T12:00:00Z');

    const cards = [
      {
        id: '1',
        title: 'New recurring',
        status: 'In Progress',
        recurring: {
          frequency: 'weekly',
          lastReset: null,
          resetToStatus: 'To Do',
        },
      },
    ];

    const result = processRecurring(cards, config, now);
    expect(result).toBe(true);
    expect(cards[0].status).toBe('To Do');
  });

  it('uses first column when resetToStatus is missing', () => {
    const now = new Date('2026-03-23T12:00:00Z');

    const cards = [
      {
        id: '1',
        title: 'No reset status',
        status: 'Done',
        recurring: {
          frequency: 'weekly',
          lastReset: '2026-03-10', // old week
        },
      },
    ];

    const result = processRecurring(cards, config, now);
    expect(result).toBe(true);
    expect(cards[0].status).toBe('To Do'); // first column
  });

  it('ignores non-recurring cards', () => {
    const now = new Date('2026-03-23T12:00:00Z');

    const cards = [
      { id: '1', title: 'Normal card', status: 'Done', recurring: null },
    ];

    const result = processRecurring(cards, config, now);
    expect(result).toBe(false);
    expect(cards[0].status).toBe('Done');
  });

  it('handles empty cards array', () => {
    expect(processRecurring([], config)).toBe(false);
  });

  it('handles null config', () => {
    expect(processRecurring([{ recurring: { frequency: 'weekly' } }], null)).toBe(false);
  });

  it('resets across year boundary', () => {
    // Last week of 2025 to first week of 2026
    const now = new Date('2026-01-05T12:00:00Z'); // ISO week 2 of 2026

    const cards = [
      {
        id: '1',
        title: 'Cross year',
        status: 'Done',
        recurring: {
          frequency: 'weekly',
          lastReset: '2025-12-29', // ISO week 1 of 2026 actually (Mon Dec 29, 2025)
        },
      },
    ];

    const result = processRecurring(cards, config, now);
    expect(result).toBe(true);
    expect(cards[0].status).toBe('To Do');
  });
});

// Integration test for the `reset` CLI command
const TEST_BOARD = `__test_recurring_${Date.now()}`;

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

describe('reset CLI command (integration)', () => {
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

  it('reports no cards to reset when board has no recurring cards', async () => {
    const { logs } = await runCLI('reset', TEST_BOARD);
    expect(logs.some((l) => l.includes('No recurring'))).toBe(true);
  });

  it('rejects non-existing board', async () => {
    const { errors, exitCode } = await runCLI('reset', 'nonexistent_xyz');
    expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
    expect(exitCode).toBe(1);
  });

  it('processes recurring cards on a board', async () => {
    const now = new Date();
    // Create a card with lastReset from a previous week
    const oldDate = new Date(now);
    oldDate.setDate(oldDate.getDate() - 14); // 2 weeks ago

    await writeCards(TEST_BOARD, [
      {
        id: 'r-1',
        title: 'Weekly Review',
        status: 'Done',
        link: null,
        linkMeta: null,
        deadline: null,
        recurring: {
          frequency: 'weekly',
          lastReset: oldDate.toISOString().slice(0, 10),
          resetToStatus: 'To Do',
        },
        customFields: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const { logs } = await runCLI('reset', TEST_BOARD);
    expect(logs.some((l) => l.includes('Reset'))).toBe(true);

    const cards = await readCards(TEST_BOARD);
    expect(cards[0].status).toBe('To Do');
    expect(cards[0].recurring.lastReset).toBe(
      new Date().toISOString().slice(0, 10)
    );
  });
});
