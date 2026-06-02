import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBoard } from '../useBoard.js';

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

const boardPayload = {
  id: 'board-1',
  name: 'default',
  config: { name: 'default', columns: ['To Do', 'Done'], customFields: [] },
  cards: [],
  settings: { githubStatusMap: {} },
};

describe('useBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state', () => {
    const { boards, activeBoard, activeBoardId, boardData, loading } = useBoard();
    expect(boards.value).toEqual([]);
    expect(activeBoard.value).toBe(null);
    expect(activeBoardId.value).toBe(null);
    expect(boardData.value).toBe(null);
    expect(loading.value).toBe(false);
  });

  it('loadBoards populates board names from account boards', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      jsonResponse([
        { id: 'board-1', name: 'default' },
        { id: 'board-2', name: 'work' },
      ])
    ));

    const { boards, boardSummaries, loadBoards } = useBoard();
    await loadBoards();

    expect(boards.value).toEqual(['default', 'work']);
    expect(boardSummaries.value[0].id).toBe('board-1');
    expect(fetch).toHaveBeenCalledWith('/api/account/boards', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('loadBoards clears state and throws on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      jsonResponse({ error: 'Authentication required' }, false, 401)
    ));

    const { boards, loadBoards } = useBoard();
    await expect(loadBoards()).rejects.toThrow('Authentication required');
    expect(boards.value).toEqual([]);
  });

  it('loadBoard fetches board data by board name', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/account/boards') {
        return jsonResponse([{ id: 'board-1', name: 'default' }]);
      }
      if (url === '/api/account/boards/board-1') {
        return jsonResponse(boardPayload);
      }
      return jsonResponse({}, false, 404);
    }));

    const { boardData, activeBoard, activeBoardId, loading, loadBoards, loadBoard } = useBoard();
    await loadBoards();
    await loadBoard('default');

    expect(boardData.value).toEqual(boardPayload);
    expect(activeBoard.value).toBe('default');
    expect(activeBoardId.value).toBe('board-1');
    expect(loading.value).toBe(false);
  });

  it('saveCards sends a board-scoped PUT request', async () => {
    const cards = [{ id: '1', title: 'Test', status: 'To Do' }];
    vi.stubGlobal('fetch', vi.fn(() =>
      jsonResponse({ ok: true, board: { ...boardPayload, cards } })
    ));

    const { boardData, saveCards } = useBoard();
    await saveCards('board-1', cards);

    expect(fetch).toHaveBeenCalledWith(
      '/api/account/boards/board-1/cards',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'same-origin',
        body: JSON.stringify({ cards }),
      })
    );
    expect(boardData.value.cards).toEqual(cards);
  });

  it('createBoard sends POST and reloads board summaries', async () => {
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (url === '/api/account/boards' && opts?.method === 'POST') {
        return jsonResponse({ ...boardPayload, id: 'board-2', name: 'new-board', config: { ...boardPayload.config, name: 'new-board' } }, true, 201);
      }
      if (url === '/api/account/boards') {
        return jsonResponse([{ id: 'board-2', name: 'new-board' }]);
      }
      return jsonResponse({}, false, 404);
    }));

    const { boards, activeBoard, activeBoardId, boardData, createBoard } = useBoard();
    await createBoard('new-board', ['To Do', 'Done']);

    expect(boards.value).toEqual(['new-board']);
    expect(activeBoard.value).toBe('new-board');
    expect(activeBoardId.value).toBe('board-2');
    expect(boardData.value.id).toBe('board-2');
  });

  it('createCard posts to the active board', async () => {
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (url === '/api/account/boards/board-1/cards' && opts?.method === 'POST') {
        return jsonResponse({ id: 'card-1', title: 'Card', status: 'To Do' }, true, 201);
      }
      if (url === '/api/account/boards/board-1') {
        return jsonResponse({ ...boardPayload, cards: [{ id: 'card-1', title: 'Card', status: 'To Do' }] });
      }
      return jsonResponse({}, false, 404);
    }));

    const { createBoard, createCard, boardData } = useBoard();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve(boardPayload),
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 'board-1', name: 'default' }]),
    });

    await createBoard('default', ['To Do']);
    await createCard({ title: 'Card', status: 'To Do' });

    expect(boardData.value.cards[0].title).toBe('Card');
  });

  it('createCard sends a GitHub reference title when the form title is blank', async () => {
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (url === '/api/account/boards/board-1/cards' && opts?.method === 'POST') {
        return jsonResponse({ id: 'card-1', title: 'acme/repo#42', status: 'To Do' }, true, 201);
      }
      if (url === '/api/account/boards/board-1') {
        return jsonResponse({
          ...boardPayload,
          cards: [{
            id: 'card-1',
            title: 'acme/repo#42',
            status: 'To Do',
            link: 'https://github.com/acme/repo/issues/42',
          }],
        });
      }
      return jsonResponse({}, false, 404);
    }));

    const { createBoard, createCard } = useBoard();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve(boardPayload),
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 'board-1', name: 'default' }]),
    });

    await createBoard('default', ['To Do']);
    await createCard({
      title: '',
      status: 'To Do',
      link: 'https://github.com/acme/repo/issues/42',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/account/boards/board-1/cards',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'acme/repo#42',
          status: 'To Do',
          link: 'https://github.com/acme/repo/issues/42',
        }),
      })
    );
  });

  it('refreshGitHubMeta posts to the account board refresh endpoint', async () => {
    const refreshedBoard = {
      ...boardPayload,
      cards: [{
        id: 'card-1',
        title: 'Card',
        status: 'Done',
        link: 'https://github.com/example/repo/issues/1',
        linkMeta: { title: 'GitHub issue' },
      }],
    };

    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (url === '/api/account/boards/board-1' && !opts?.method) {
        return jsonResponse(boardPayload);
      }
      if (url === '/api/account/boards/board-1/github-refresh') {
        return jsonResponse({ ok: true, updated: 1, moved: 1, failed: 0, board: refreshedBoard });
      }
      return jsonResponse({}, false, 404);
    }));

    const { boardData, loadBoard, refreshGitHubMeta } = useBoard();
    await loadBoard('board-1');
    const updated = await refreshGitHubMeta('board-1');

    expect(updated).toBe(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/account/boards/board-1/github-refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({}),
      })
    );
    expect(boardData.value.cards[0].status).toBe('Done');
    expect(boardData.value.cards[0].linkMeta.title).toBe('GitHub issue');
  });
});
