import { describe, it, expect } from 'vitest';
import { useRecurring } from '../useRecurring.js';

// Note: This is essentially the same logic as the CLI recurring module,
// but packaged as a Vue composable. We test the composable interface here.

describe('useRecurring', () => {
  const config = { columns: ['To Do', 'In Progress', 'Done'] };
  const { processRecurring } = useRecurring();

  it('returns false when no cards need resetting', () => {
    const cards = [
      {
        id: '1',
        title: 'Normal card',
        status: 'Done',
        recurring: null,
      },
    ];
    expect(processRecurring(cards, config)).toBe(false);
  });

  it('returns false for empty cards', () => {
    expect(processRecurring([], config)).toBe(false);
  });

  it('returns false with null cards', () => {
    expect(processRecurring(null, config)).toBe(false);
  });

  it('resets a card from a previous ISO week', () => {
    // Create a lastReset 14 days ago — guaranteed to be a different week
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000)
      .toISOString()
      .slice(0, 10);

    const cards = [
      {
        id: '1',
        title: 'Weekly task',
        status: 'Done',
        recurring: {
          frequency: 'weekly',
          lastReset: twoWeeksAgo,
          resetToStatus: 'To Do',
        },
      },
    ];

    const result = processRecurring(cards, config);
    expect(result).toBe(true);
    expect(cards[0].status).toBe('To Do');
  });

  it('does not reset a card already reset this week', () => {
    const today = new Date().toISOString().slice(0, 10);

    const cards = [
      {
        id: '1',
        title: 'Weekly task',
        status: 'Done',
        recurring: {
          frequency: 'weekly',
          lastReset: today,
          resetToStatus: 'To Do',
        },
      },
    ];

    const result = processRecurring(cards, config);
    expect(result).toBe(false);
    expect(cards[0].status).toBe('Done');
  });

  it('resets card with null lastReset', () => {
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

    const result = processRecurring(cards, config);
    expect(result).toBe(true);
    expect(cards[0].status).toBe('To Do');
  });
});
