import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInteractive, promptIfMissing, selectIfMissing, confirmPrompt, checkboxPrompt } from '../lib/prompt.js';

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  checkbox: vi.fn(),
}));

function makeMockProgram(opts = {}) {
  return { opts: () => opts };
}

describe('isInteractive', () => {
  let originalIsTTY;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    process.stdin.isTTY = originalIsTTY;
  });

  it('returns false when --no-interactive is set', () => {
    process.stdin.isTTY = true;
    const program = makeMockProgram({ interactive: false });
    expect(isInteractive(program)).toBe(false);
  });

  it('returns false when --ni is set', () => {
    process.stdin.isTTY = true;
    const program = makeMockProgram({ ni: true });
    expect(isInteractive(program)).toBe(false);
  });

  it('returns true when --interactive is set even without TTY', () => {
    process.stdin.isTTY = undefined;
    const program = makeMockProgram({ interactive: true });
    expect(isInteractive(program)).toBe(true);
  });

  it('returns true when stdin is a TTY and no flags', () => {
    process.stdin.isTTY = true;
    const program = makeMockProgram({});
    expect(isInteractive(program)).toBe(true);
  });

  it('returns false when stdin is not a TTY and no flags', () => {
    process.stdin.isTTY = undefined;
    const program = makeMockProgram({});
    expect(isInteractive(program)).toBe(false);
  });

  it('--no-interactive takes priority over TTY', () => {
    process.stdin.isTTY = true;
    const program = makeMockProgram({ interactive: false });
    expect(isInteractive(program)).toBe(false);
  });

  it('--ni takes priority over TTY', () => {
    process.stdin.isTTY = true;
    const program = makeMockProgram({ ni: true, interactive: undefined });
    expect(isInteractive(program)).toBe(false);
  });
});

describe('promptIfMissing', () => {
  it('returns existing value without prompting', async () => {
    const result = await promptIfMissing('hello', { message: 'Test:' }, true);
    expect(result).toBe('hello');
  });

  it('returns undefined when non-interactive and value missing', async () => {
    const result = await promptIfMissing(undefined, { message: 'Test:' }, false);
    expect(result).toBeUndefined();
  });

  it('prompts when interactive and value missing', async () => {
    const { input } = await import('@inquirer/prompts');
    input.mockResolvedValueOnce('prompted-value');
    const result = await promptIfMissing(undefined, { message: 'Test:' }, true);
    expect(result).toBe('prompted-value');
    expect(input).toHaveBeenCalledWith({ message: 'Test:' });
  });

  it('returns existing value for empty string check', async () => {
    const result = await promptIfMissing('', { message: 'Test:' }, true);
    // Empty string is treated as missing
    const { input } = await import('@inquirer/prompts');
    // The empty string case triggers prompt in interactive mode
    expect(input).toHaveBeenCalled();
  });
});

describe('selectIfMissing', () => {
  it('returns existing value without prompting', async () => {
    const result = await selectIfMissing('choice-a', { message: 'Pick:', choices: [] }, true);
    expect(result).toBe('choice-a');
  });

  it('returns undefined when non-interactive and value missing', async () => {
    const result = await selectIfMissing(undefined, { message: 'Pick:', choices: [] }, false);
    expect(result).toBeUndefined();
  });

  it('prompts when interactive and value missing', async () => {
    const { select } = await import('@inquirer/prompts');
    select.mockResolvedValueOnce('selected');
    const opts = { message: 'Pick:', choices: [{ name: 'A', value: 'selected' }] };
    const result = await selectIfMissing(undefined, opts, true);
    expect(result).toBe('selected');
    expect(select).toHaveBeenCalledWith(opts);
  });
});

describe('confirmPrompt', () => {
  it('returns true when non-interactive (skips confirmation)', async () => {
    const result = await confirmPrompt({ message: 'Sure?' }, false);
    expect(result).toBe(true);
  });

  it('prompts when interactive', async () => {
    const { confirm } = await import('@inquirer/prompts');
    confirm.mockResolvedValueOnce(false);
    const result = await confirmPrompt({ message: 'Sure?' }, true);
    expect(result).toBe(false);
    expect(confirm).toHaveBeenCalledWith({ message: 'Sure?' });
  });
});

describe('checkboxPrompt', () => {
  it('returns empty array when non-interactive', async () => {
    const result = await checkboxPrompt({ message: 'Select:', choices: [] }, false);
    expect(result).toEqual([]);
  });

  it('prompts when interactive', async () => {
    const { checkbox } = await import('@inquirer/prompts');
    checkbox.mockResolvedValueOnce(['a', 'b']);
    const opts = { message: 'Select:', choices: [{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }] };
    const result = await checkboxPrompt(opts, true);
    expect(result).toEqual(['a', 'b']);
    expect(checkbox).toHaveBeenCalledWith(opts);
  });
});
