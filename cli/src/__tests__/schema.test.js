import { describe, it, expect } from 'vitest';
import {
  boardConfigSchema,
  cardSchema,
  cardsSchema,
  boardSettingsSchema,
  validateCustomFields,
} from '../lib/schema.js';

describe('boardConfigSchema', () => {
  it('validates a minimal valid config', () => {
    const result = boardConfigSchema.safeParse({
      name: 'test',
      columns: ['To Do', 'Done'],
    });
    expect(result.success).toBe(true);
    expect(result.data.customFields).toEqual([]);
  });

  it('validates config with custom fields', () => {
    const result = boardConfigSchema.safeParse({
      name: 'test',
      columns: ['To Do'],
      customFields: [
        { key: 'priority', type: 'select', options: ['low', 'high'] },
        { key: 'story_points', type: 'number' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data.customFields).toHaveLength(2);
  });

  it('rejects empty name', () => {
    const result = boardConfigSchema.safeParse({
      name: '',
      columns: ['To Do'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty columns array', () => {
    const result = boardConfigSchema.safeParse({
      name: 'test',
      columns: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid custom field type', () => {
    const result = boardConfigSchema.safeParse({
      name: 'test',
      columns: ['To Do'],
      customFields: [{ key: 'x', type: 'invalid' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('cardSchema', () => {
  const validCard = {
    id: 'abc123',
    title: 'Test card',
    status: 'To Do',
    link: null,
    linkMeta: null,
    deadline: '2026-04-01',
    recurring: null,
    customFields: {},
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  };

  it('validates a valid card', () => {
    const result = cardSchema.safeParse(validCard);
    expect(result.success).toBe(true);
  });

  it('validates card with recurring', () => {
    const result = cardSchema.safeParse({
      ...validCard,
      recurring: { frequency: 'weekly', lastReset: '2026-03-17', resetToStatus: 'To Do' },
    });
    expect(result.success).toBe(true);
  });

  it('validates card with link metadata', () => {
    const result = cardSchema.safeParse({
      ...validCard,
      link: 'https://github.com/org/repo/issues/1',
      linkMeta: {
        type: 'issue',
        owner: 'org',
        repo: 'repo',
        number: 1,
        title: 'Bug fix',
        state: 'open',
        labels: [{ name: 'bug', color: 'd73a4a' }],
        assignees: ['octocat'],
        author: 'monalisa',
        bodyExcerpt: 'Some description...',
        commentsCount: 3,
        ghCreatedAt: '2026-01-01T00:00:00Z',
        ghUpdatedAt: '2026-01-02T00:00:00Z',
        ghClosedAt: null,
        fetchedAt: '2026-03-19T00:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates card with minimal link metadata', () => {
    const result = cardSchema.safeParse({
      ...validCard,
      link: 'https://github.com/org/repo/issues/1',
      linkMeta: {
        type: 'issue',
        owner: 'org',
        repo: 'repo',
        number: 1,
        title: 'Bug fix',
        state: 'open',
        labels: [{ name: 'bug', color: null }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates card with pending sync title', () => {
    const result = cardSchema.safeParse({
      ...validCard,
      title: '',
      link: 'https://github.com/org/repo/issues/1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects card without title or GitHub issue/PR link', () => {
    const result = cardSchema.safeParse({ ...validCard, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects card without id', () => {
    const result = cardSchema.safeParse({ ...validCard, id: '' });
    expect(result.success).toBe(false);
  });
});

describe('cardsSchema', () => {
  it('validates empty array', () => {
    const result = cardsSchema.safeParse([]);
    expect(result.success).toBe(true);
  });
});

describe('validateCustomFields', () => {
  const defs = [
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high'], required: true },
    { key: 'points', label: 'Points', type: 'number', required: false },
    { key: 'due', label: 'Due Date', type: 'date', required: false },
    { key: 'done', label: 'Done', type: 'boolean', required: false },
  ];

  it('passes valid field values', () => {
    const result = validateCustomFields({ priority: 'high', points: 5 }, defs);
    expect(result.valid).toBe(true);
  });

  it('fails on missing required field', () => {
    const result = validateCustomFields({}, defs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Priority');
  });

  it('fails on invalid select value', () => {
    const result = validateCustomFields({ priority: 'invalid' }, defs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('one of');
  });

  it('fails on invalid number', () => {
    const result = validateCustomFields({ priority: 'low', points: 'abc' }, defs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('number');
  });

  it('fails on invalid date format', () => {
    const result = validateCustomFields({ priority: 'low', due: 'not-a-date' }, defs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('date');
  });

  it('fails on invalid boolean', () => {
    const result = validateCustomFields({ priority: 'low', done: 'nope' }, defs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('boolean');
  });

  it('passes with no field definitions', () => {
    const result = validateCustomFields({ anything: 'val' }, []);
    expect(result.valid).toBe(true);
  });

  it('passes with no field definitions at all', () => {
    const result = validateCustomFields({}, undefined);
    expect(result.valid).toBe(true);
  });
});

describe('boardSettingsSchema', () => {
  it('validates empty settings with defaults', () => {
    const result = boardSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.githubStatusMap).toEqual({});
  });

  it('validates settings with github status map', () => {
    const result = boardSettingsSchema.safeParse({
      githubStatusMap: {
        'bug': 'To Do',
        'enhancement': 'In Progress',
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.githubStatusMap).toEqual({
      'bug': 'To Do',
      'enhancement': 'In Progress',
    });
  });

  it('rejects non-string values in githubStatusMap', () => {
    const result = boardSettingsSchema.safeParse({
      githubStatusMap: {
        'bug': 123,
      },
    });
    expect(result.success).toBe(false);
  });
});
