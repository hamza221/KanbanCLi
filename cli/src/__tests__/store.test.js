import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  listBoards,
  boardExists,
  createBoard,
  deleteBoard,
  readConfig,
  writeConfig,
  readCards,
  writeCards,
  readSettings,
  writeSettings,
} from '../lib/store.js';

// The store module uses import.meta.dirname to locate the boards/ directory.
// For integration tests, we create a real temp directory structure and
// override the boards root by manipulating the file system.
// Since we can't easily override the import.meta-based path, we'll test
// using the real boards/ directory with unique test board names.

const TEST_BOARD = `__test_board_${Date.now()}`;

describe('store', () => {
  afterEach(async () => {
    // Clean up test board if it exists
    try {
      await deleteBoard(TEST_BOARD);
    } catch {
      // ignore
    }
  });

  describe('listBoards', () => {
    it('returns an array of board names', async () => {
      const boards = await listBoards();
      expect(Array.isArray(boards)).toBe(true);
      // The default board should exist
      expect(boards).toContain('default');
    });
  });

  describe('boardExists', () => {
    it('returns true for existing board', async () => {
      expect(await boardExists('default')).toBe(true);
    });

    it('returns false for non-existing board', async () => {
      expect(await boardExists('nonexistent_board_xyz')).toBe(false);
    });
  });

  describe('createBoard / deleteBoard', () => {
    it('creates and deletes a board', async () => {
      // Create
      const config = await createBoard(TEST_BOARD, ['A', 'B', 'C']);
      expect(config.name).toBe(TEST_BOARD);
      expect(config.columns).toEqual(['A', 'B', 'C']);
      expect(await boardExists(TEST_BOARD)).toBe(true);

      // Read back
      const readBack = await readConfig(TEST_BOARD);
      expect(readBack.name).toBe(TEST_BOARD);
      expect(readBack.columns).toEqual(['A', 'B', 'C']);

      const cards = await readCards(TEST_BOARD);
      expect(cards).toEqual([]);

      // Delete
      await deleteBoard(TEST_BOARD);
      expect(await boardExists(TEST_BOARD)).toBe(false);
    });

    it('creates board with default columns', async () => {
      const config = await createBoard(TEST_BOARD);
      expect(config.columns).toEqual(['To Do', 'In Progress', 'Done']);
      await deleteBoard(TEST_BOARD);
    });
  });

  describe('readConfig / writeConfig', () => {
    it('reads and writes config', async () => {
      await createBoard(TEST_BOARD);
      const config = await readConfig(TEST_BOARD);
      config.columns.push('Review');
      await writeConfig(TEST_BOARD, config);

      const updated = await readConfig(TEST_BOARD);
      expect(updated.columns).toContain('Review');
    });
  });

  describe('readCards / writeCards', () => {
    it('reads and writes cards', async () => {
      await createBoard(TEST_BOARD);

      const card = {
        id: 'test-1',
        title: 'Test card',
        status: 'To Do',
        link: null,
        linkMeta: null,
        deadline: null,
        recurring: null,
        customFields: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await writeCards(TEST_BOARD, [card]);
      const cards = await readCards(TEST_BOARD);
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe('Test card');
    });
  });

  describe('readSettings / writeSettings', () => {
    it('returns default settings for board with no settings file', async () => {
      await createBoard(TEST_BOARD);
      const settings = await readSettings(TEST_BOARD);
      expect(settings).toEqual({ githubStatusMap: {} });
    });

    it('reads and writes settings', async () => {
      await createBoard(TEST_BOARD);

      const settings = {
        githubStatusMap: {
          'bug': 'To Do',
          'in-progress': 'In Progress',
        },
      };

      await writeSettings(TEST_BOARD, settings);
      const readBack = await readSettings(TEST_BOARD);
      expect(readBack.githubStatusMap).toEqual({
        'bug': 'To Do',
        'in-progress': 'In Progress',
      });
    });

    it('overwrites existing settings', async () => {
      await createBoard(TEST_BOARD);

      await writeSettings(TEST_BOARD, {
        githubStatusMap: { 'old-label': 'To Do' },
      });

      await writeSettings(TEST_BOARD, {
        githubStatusMap: { 'new-label': 'Done' },
      });

      const readBack = await readSettings(TEST_BOARD);
      expect(readBack.githubStatusMap).toEqual({ 'new-label': 'Done' });
      expect(readBack.githubStatusMap['old-label']).toBeUndefined();
    });
  });
});
