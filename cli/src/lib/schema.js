import { z } from 'zod';

// --- Custom field definition schema ---
export const customFieldDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(['text', 'number', 'select', 'date', 'boolean']),
  options: z.array(z.string()).optional(), // only for 'select' type
  required: z.boolean().optional().default(false),
});

// --- Board config schema ---
export const boardConfigSchema = z.object({
  name: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  customFields: z.array(customFieldDefSchema).optional().default([]),
});

// --- Recurring definition schema ---
export const recurringSchema = z
  .object({
    frequency: z.literal('weekly'),
    lastReset: z.string().nullable().optional(),
    resetToStatus: z.string().optional(),
  })
  .nullable()
  .optional();

// --- GitHub label schema ---
export const ghLabelSchema = z.object({
  name: z.string(),
  color: z.string().nullable(),
});

// --- Link metadata schema ---
export const linkMetaSchema = z
  .object({
    type: z.enum(['issue', 'pr', 'other']).optional(),
    owner: z.string().optional(),
    repo: z.string().optional(),
    number: z.number().optional(),
    title: z.string().optional(),
    state: z.string().optional(),
    labels: z.array(ghLabelSchema).optional(),
    milestone: z.string().optional(),
    milestoneDueOn: z.string().nullable().optional(),
    assignees: z.array(z.string()).optional(),
    author: z.string().nullable().optional(),
    bodyExcerpt: z.string().nullable().optional(),
    commentsCount: z.number().optional(),
    ghCreatedAt: z.string().nullable().optional(),
    ghUpdatedAt: z.string().nullable().optional(),
    ghClosedAt: z.string().nullable().optional(),
    fetchedAt: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

function isGithubIssueOrPrLink(link) {
  const cleaned = String(link || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return /^github\.com\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(cleaned);
}

// --- Card schema ---
export const cardSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: z.string().min(1),
  link: z.string().nullable().optional(),
  linkMeta: linkMetaSchema,
  deadline: z.string().nullable().optional(),
  recurring: recurringSchema,
  customFields: z.record(z.unknown()).optional().default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
}).refine((card) => card.title.trim() || isGithubIssueOrPrLink(card.link), {
  message: 'Title is required unless a GitHub issue or PR link is provided',
  path: ['title'],
});

// --- Cards array schema ---
export const cardsSchema = z.array(cardSchema);

// --- Board settings schema ---
export const boardSettingsSchema = z.object({
  githubStatusMap: z.record(z.string()).optional().default({}),
});

/**
 * Validate custom field values against the board's customFields definitions.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateCustomFields(fieldValues, fieldDefs) {
  const errors = [];
  if (!fieldDefs || fieldDefs.length === 0) return { valid: true };

  for (const def of fieldDefs) {
    const value = fieldValues?.[def.key];

    // Check required
    if (def.required && (value === undefined || value === null || value === '')) {
      errors.push(`Custom field "${def.label || def.key}" is required`);
      continue;
    }

    if (value === undefined || value === null || value === '') continue;

    // Type validation
    switch (def.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`Custom field "${def.label || def.key}" must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`Custom field "${def.label || def.key}" must be a boolean`);
        }
        break;
      case 'select':
        if (def.options && !def.options.includes(value)) {
          errors.push(
            `Custom field "${def.label || def.key}" must be one of: ${def.options.join(', ')}`
          );
        }
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          errors.push(
            `Custom field "${def.label || def.key}" must be a date (YYYY-MM-DD)`
          );
        }
        break;
      // text — no validation needed
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
