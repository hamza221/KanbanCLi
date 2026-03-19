import { ref } from 'vue';

/**
 * Composable for loading and saving board data via the Vite dev API.
 */
export function useBoard() {
  const boards = ref([]);
  const activeBoard = ref(null);
  const boardData = ref(null);
  const boardSettings = ref({ githubStatusMap: {} });
  const loading = ref(false);

  async function loadBoards() {
    try {
      const res = await fetch('/api/boards');
      if (!res.ok) throw new Error(`Failed to fetch boards: ${res.status}`);
      boards.value = await res.json();
    } catch (err) {
      console.error('Failed to load boards:', err);
      boards.value = [];
    }
  }

  async function loadBoard(name) {
    loading.value = true;
    try {
      const res = await fetch(`/api/board?name=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`Failed to fetch board: ${res.status}`);
      boardData.value = await res.json();
      activeBoard.value = name;
    } catch (err) {
      console.error(`Failed to load board "${name}":`, err);
      boardData.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function saveCards(name, cards) {
    try {
      const res = await fetch(`/api/board?name=${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards }),
      });
      if (!res.ok) throw new Error(`Failed to save cards: ${res.status}`);
    } catch (err) {
      console.error(`Failed to save cards for board "${name}":`, err);
    }
  }

  async function createBoard(name, columns) {
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, columns }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create board: ${res.status}`);
      }
      await loadBoards();
      await loadBoard(name);
      return true;
    } catch (err) {
      console.error('Failed to create board:', err);
      throw err;
    }
  }

  async function refreshGitHubMeta(name) {
    try {
      const res = await fetch('/api/github-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardName: name }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      // Reload the board to pick up refreshed metadata
      if (data.updated > 0) {
        await loadBoard(name);
      }
      return data.updated || 0;
    } catch (err) {
      console.error('GitHub refresh failed:', err);
      return 0;
    }
  }

  async function loadSettings(name) {
    try {
      const res = await fetch(`/api/settings?name=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
      boardSettings.value = await res.json();
    } catch {
      boardSettings.value = { githubStatusMap: {} };
    }
  }

  async function saveSettings(name, settings) {
    try {
      const res = await fetch(`/api/settings?name=${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`Failed to save settings: ${res.status}`);
      boardSettings.value = settings;
    } catch (err) {
      console.error(`Failed to save settings for board "${name}":`, err);
      throw err;
    }
  }

  return {
    boards,
    activeBoard,
    boardData,
    boardSettings,
    loading,
    loadBoards,
    loadBoard,
    saveCards,
    createBoard,
    refreshGitHubMeta,
    loadSettings,
    saveSettings,
  };
}
