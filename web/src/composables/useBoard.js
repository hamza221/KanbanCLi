import { ref } from 'vue';

/**
 * Composable for loading and saving account-scoped board data.
 */
export function useBoard() {
  const boards = ref([]);
  const boardSummaries = ref([]);
  const activeBoard = ref(null);
  const activeBoardId = ref(null);
  const boardData = ref(null);
  const boardSettings = ref({ githubStatusMap: {} });
  const loading = ref(false);

  function resetBoards() {
    boards.value = [];
    boardSummaries.value = [];
    activeBoard.value = null;
    activeBoardId.value = null;
    boardData.value = null;
    boardSettings.value = { githubStatusMap: {} };
  }

  function boardIdFor(identifier) {
    const summary = boardSummaries.value.find(
      (board) => board.id === identifier || board.name === identifier
    );
    return summary?.id || (identifier === activeBoard.value ? activeBoardId.value : identifier);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }

    return res.status === 204 ? null : res.json();
  }

  function setActiveBoard(payload) {
    boardData.value = payload;
    activeBoard.value = payload.name;
    activeBoardId.value = payload.id;
    boardSettings.value = payload.settings || { githubStatusMap: {} };
  }

  async function loadBoards() {
    try {
      boardSummaries.value = await api('/api/account/boards');
      boards.value = boardSummaries.value.map((board) => board.name);
    } catch (err) {
      console.error('Failed to load boards:', err);
      boardSummaries.value = [];
      boards.value = [];
      throw err;
    }
  }

  async function loadBoard(identifier) {
    loading.value = true;
    try {
      const boardId = boardIdFor(identifier);
      if (!boardId) throw new Error('Board not found');
      const payload = await api(`/api/account/boards/${encodeURIComponent(boardId)}`);
      setActiveBoard(payload);
    } catch (err) {
      console.error(`Failed to load board "${identifier}":`, err);
      boardData.value = null;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function saveCards(identifier, cards) {
    const boardId = boardIdFor(identifier);
    if (!boardId) throw new Error('No active board selected');

    const payload = await api(`/api/account/boards/${encodeURIComponent(boardId)}/cards`, {
      method: 'PUT',
      body: JSON.stringify({ cards }),
    });
    setActiveBoard(payload.board);
  }

  async function createBoard(name, columns) {
    const payload = await api('/api/account/boards', {
      method: 'POST',
      body: JSON.stringify({ name, columns }),
    });
    await loadBoards();
    setActiveBoard(payload);
    return true;
  }

  async function createCard(card) {
    if (!activeBoardId.value) throw new Error('No active board selected');
    const created = await api(`/api/account/boards/${encodeURIComponent(activeBoardId.value)}/cards`, {
      method: 'POST',
      body: JSON.stringify(card),
    });
    await loadBoard(activeBoardId.value);
    return created;
  }

  async function updateCard(card) {
    await api(`/api/account/cards/${encodeURIComponent(card.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(card),
    });
    await loadBoard(activeBoardId.value);
  }

  async function deleteCard(card) {
    await api(`/api/account/cards/${encodeURIComponent(card.id)}`, {
      method: 'DELETE',
    });
    await loadBoard(activeBoardId.value);
  }

  async function refreshGitHubMeta(identifier = activeBoardId.value) {
    const boardId = boardIdFor(identifier);
    if (!boardId) return 0;

    const payload = await api(`/api/account/boards/${encodeURIComponent(boardId)}/github-refresh`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setActiveBoard(payload.board);
    return payload.updated || 0;
  }

  async function loadSettings(identifier) {
    const boardId = boardIdFor(identifier);
    if (!boardId) {
      boardSettings.value = { githubStatusMap: {} };
      return;
    }

    try {
      boardSettings.value = await api(`/api/account/boards/${encodeURIComponent(boardId)}/settings`);
    } catch {
      boardSettings.value = { githubStatusMap: {} };
    }
  }

  async function saveSettings(identifier, settings) {
    const boardId = boardIdFor(identifier);
    if (!boardId) throw new Error('No active board selected');

    await api(`/api/account/boards/${encodeURIComponent(boardId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    boardSettings.value = settings;
  }

  return {
    boards,
    boardSummaries,
    activeBoard,
    activeBoardId,
    boardData,
    boardSettings,
    loading,
    resetBoards,
    loadBoards,
    loadBoard,
    saveCards,
    createBoard,
    createCard,
    updateCard,
    deleteCard,
    refreshGitHubMeta,
    loadSettings,
    saveSettings,
  };
}
