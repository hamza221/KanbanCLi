import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBoard } from '../useBoard.js';

describe('useBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state', () => {
    const { boards, activeBoard, boardData, loading } = useBoard();
    expect(boards.value).toEqual([]);
    expect(activeBoard.value).toBe(null);
    expect(boardData.value).toBe(null);
    expect(loading.value).toBe(false);
  });

  it('loadBoards populates boards list', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(['default', 'work']),
      })
    ));

    const { boards, loadBoards } = useBoard();
    await loadBoards();
    expect(boards.value).toEqual(['default', 'work']);
    expect(fetch).toHaveBeenCalledWith('/api/boards');
  });

  it('loadBoards handles fetch failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    ));

    const { boards, loadBoards } = useBoard();
    await loadBoards();
    expect(boards.value).toEqual([]);
  });

  it('loadBoard fetches board data', async () => {
    const mockData = {
      config: { name: 'test', columns: ['A', 'B'] },
      cards: [{ id: '1', title: 'Card' }],
    };

    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    ));

    const { boardData, activeBoard, loading, loadBoard } = useBoard();
    await loadBoard('test');

    expect(boardData.value).toEqual(mockData);
    expect(activeBoard.value).toBe('test');
    expect(loading.value).toBe(false);
    expect(fetch).toHaveBeenCalledWith('/api/board?name=test');
  });

  it('loadBoard handles failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 })
    ));

    const { boardData, loadBoard } = useBoard();
    await loadBoard('nonexistent');
    expect(boardData.value).toBe(null);
  });

  it('saveCards sends PUT request', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    ));

    const { saveCards } = useBoard();
    const cards = [{ id: '1', title: 'Test' }];
    await saveCards('test', cards);

    expect(fetch).toHaveBeenCalledWith(
      '/api/board?name=test',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards }),
      })
    );
  });

  it('createBoard sends POST and reloads boards', async () => {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      calls.push({ url, method: opts?.method || 'GET' });
      if (url === '/api/boards' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, config: { name: 'new-board', columns: ['A', 'B'] } }),
        });
      }
      if (url === '/api/boards') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(['default', 'new-board']),
        });
      }
      if (url === '/api/board?name=new-board') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            config: { name: 'new-board', columns: ['A', 'B'] },
            cards: [],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }));

    const { boards, activeBoard, boardData, createBoard } = useBoard();
    await createBoard('new-board', ['A', 'B']);

    expect(calls[0]).toEqual({ url: '/api/boards', method: 'POST' });
    expect(boards.value).toContain('new-board');
    expect(activeBoard.value).toBe('new-board');
    expect(boardData.value).not.toBe(null);
  });

  it('createBoard throws on server error', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Board already exists' }),
      })
    ));

    const { createBoard } = useBoard();
    await expect(createBoard('existing', ['A'])).rejects.toThrow('Board already exists');
  });
});
