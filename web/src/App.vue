<template>
  <div class="kanban-app">
    <Toast />
    <ConfirmDialog />

    <div v-if="!authReady" class="kanban-loading auth-loading">
      <ProgressSpinner />
    </div>

    <main v-else-if="!user" class="auth-shell">
      <section class="auth-panel">
        <div class="kanban-workspace auth-brand">
          <span class="kanban-workspace-mark">
            <i class="pi pi-th-large"></i>
          </span>
          <div>
            <h1 class="kanban-title">CLIkanban</h1>
            <p class="kanban-subtitle">Sign in to your boards</p>
          </div>
        </div>

        <form class="auth-form" @submit.prevent="onAuthSubmit">
          <div v-if="authMode === 'signup'" class="field">
            <label for="auth-name">Name</label>
            <input
              id="auth-name"
              v-model="authForm.name"
              class="auth-input"
              autocomplete="name"
              placeholder="Your name"
            />
          </div>

          <div class="field">
            <label for="auth-email">Email</label>
            <input
              id="auth-email"
              v-model="authForm.email"
              class="auth-input"
              autocomplete="email"
              placeholder="you@example.com"
              type="email"
              required
            />
          </div>

          <div class="field">
            <label for="auth-password">Password</label>
            <input
              id="auth-password"
              v-model="authForm.password"
              class="auth-input"
              autocomplete="current-password"
              placeholder="At least 8 characters"
              type="password"
              required
            />
          </div>

          <Button
            :label="authMode === 'login' ? 'Sign in' : 'Create account'"
            icon="pi pi-arrow-right"
            type="submit"
            :loading="authLoading"
          />
        </form>

        <div class="auth-divider"><span>or</span></div>

        <Button
          icon="pi pi-github"
          label="Continue with GitHub"
          severity="secondary"
          outlined
          class="auth-github"
          @click="loginWithGithub"
        />

        <button class="auth-switch" type="button" @click="toggleAuthMode">
          {{ authMode === 'login' ? 'Create an account' : 'Sign in instead' }}
        </button>
      </section>
    </main>

    <template v-else>
      <aside class="kanban-sidebar" aria-label="Board controls">
        <div class="kanban-workspace">
          <span class="kanban-workspace-mark">
            <i class="pi pi-th-large"></i>
          </span>
          <div>
            <h1 class="kanban-title">CLIkanban</h1>
            <p class="kanban-subtitle">Local boards</p>
          </div>
        </div>

        <div class="kanban-sidebar-section">
          <span class="kanban-sidebar-label">Board</span>
          <div class="kanban-board-select-wrap">
            <BoardSelector
              :boards="boards"
              :activeBoard="activeBoard"
              @select="onBoardSelect"
            />
          </div>
          <Button
            icon="pi pi-plus"
            label="New Board"
            severity="secondary"
            size="small"
            outlined
            class="kanban-sidebar-action"
            @click="showCreateBoard = true"
          />
        </div>

        <div class="kanban-sidebar-section">
          <span class="kanban-sidebar-label">Status</span>
          <div class="kanban-sidebar-stat">
            <span class="kanban-stat-dot"></span>
            <span>{{ boardData ? `${boardData.cards.length} cards` : 'No board selected' }}</span>
          </div>
          <div class="kanban-sidebar-stat">
            <span class="kanban-stat-dot muted"></span>
            <span>{{ boardData ? `${boardData.config.columns.length} columns` : 'Create or select a board' }}</span>
          </div>
        </div>

        <div class="kanban-sidebar-footer">
          <div class="kanban-sidebar-user">
            <img
              v-if="user.avatarUrl"
              class="kanban-user-avatar is-image"
              :src="user.avatarUrl"
              alt=""
              referrerpolicy="no-referrer"
            />
            <span v-else class="kanban-user-avatar">{{ userInitials }}</span>
            <div>
              <span>{{ user.name || user.email }}</span>
              <small>{{ user.email }}</small>
            </div>
          </div>
          <Button
            :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
            :label="isDark ? 'Light mode' : 'Dark mode'"
            severity="secondary"
            variant="text"
            size="small"
            class="kanban-sidebar-action"
            @click="toggleDark"
          />
          <Button
            icon="pi pi-cog"
            label="Settings"
            severity="secondary"
            variant="text"
            size="small"
            class="kanban-sidebar-action"
            :disabled="!boardData"
            @click="showSettings = true"
          />
          <Button
            icon="pi pi-sign-out"
            label="Sign out"
            severity="secondary"
            variant="text"
            size="small"
            class="kanban-sidebar-action"
            :loading="authLoading"
            @click="onLogout"
          />
        </div>
      </aside>

      <main class="kanban-main">
        <header class="kanban-topbar">
          <div class="kanban-crumb">
            <i class="pi pi-table"></i>
            <strong>{{ activeBoard || 'No board' }}</strong>
            <span>/</span>
            <span>{{ boardData ? 'Board' : 'Select board' }}</span>
          </div>
          <div class="kanban-topbar-actions">
            <div class="kanban-view-toggle" aria-label="Current view">
              <span class="active"><i class="pi pi-th-large"></i> Board</span>
            </div>
            <Button
              icon="pi pi-plus"
              label="Add Card"
              size="small"
              :disabled="!boardData"
              @click="showAddCard = true"
            />
          </div>
        </header>

        <div class="kanban-filterbar">
          <span class="kanban-filter-chip">
            <i class="pi pi-filter"></i>
            Status
            <strong>{{ boardData ? 'All' : '-' }}</strong>
          </span>
          <span class="kanban-filter-chip">
            <i class="pi pi-columns"></i>
            Columns
            <strong>{{ boardData?.config.columns.length || 0 }}</strong>
          </span>
          <span class="kanban-live-pill">
            <span class="kanban-live-dot"></span>
            <strong>{{ boardData?.cards.length || 0 }}</strong>
            cards
          </span>
        </div>

        <section class="kanban-content">
          <div v-if="loading" class="kanban-loading">
            <ProgressSpinner />
          </div>

          <KanbanBoard
            v-else-if="boardData && boardData.cards.length > 0"
            :config="boardData.config"
            :cards="boardData.cards"
            @update:cards="onCardsUpdate"
            @edit-card="onEditCard"
            @delete-card="onDeleteCard"
          />

          <div v-else-if="boardData && boardData.cards.length === 0" class="kanban-empty-board">
            <i class="pi pi-inbox kanban-empty-icon"></i>
            <h2>No cards yet</h2>
            <p>Get started by adding your first card.</p>
            <Button
              icon="pi pi-plus"
              label="Add Card"
              @click="showAddCard = true"
            />
          </div>

          <div v-else class="kanban-empty">
            <i class="pi pi-th-large kanban-empty-icon"></i>
            <h2>No board selected</h2>
            <p>Create a board to get started.</p>
            <Button
              icon="pi pi-plus"
              label="New Board"
              @click="showCreateBoard = true"
            />
          </div>
        </section>
      </main>

      <CardDialog
        v-if="boardData"
        :visible="showAddCard"
        :config="boardData.config"
        :card="editingCard"
        @hide="onDialogHide"
        @save="onCardSave"
      />

      <CreateBoardDialog
        :visible="showCreateBoard"
        @hide="showCreateBoard = false"
        @create="onBoardCreate"
      />

      <SettingsDialog
        v-if="boardData"
        :visible="showSettings"
        :columns="boardData.config.columns"
        :settings="boardSettings"
        @hide="showSettings = false"
        @save="onSettingsSave"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import BoardSelector from './components/BoardSelector.vue';
import KanbanBoard from './components/KanbanBoard.vue';
import CardDialog from './components/CardDialog.vue';
import CreateBoardDialog from './components/CreateBoardDialog.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import { useBoard } from './composables/useBoard.js';
import { useRecurring } from './composables/useRecurring.js';
import { useNotifications } from './composables/useNotifications.js';
import { useDarkMode } from './composables/useDarkMode.js';
import { useAuth } from './composables/useAuth.js';

const toast = useToast();
const confirm = useConfirm();

const {
  boards,
  activeBoard,
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
} = useBoard();

const { processRecurring } = useRecurring();
const { checkDeadlineNotifications } = useNotifications();
const { isDark, toggle: toggleDark } = useDarkMode();
const {
  user,
  authReady,
  authLoading,
  init: initAuth,
  login,
  signup,
  logout,
  loginWithGithub,
} = useAuth();

const showAddCard = ref(false);
const showCreateBoard = ref(false);
const showSettings = ref(false);
const editingCard = ref(null);
const authMode = ref('login');
const authForm = reactive({
  name: '',
  email: '',
  password: '',
});

const userInitials = computed(() => {
  const source = user.value?.name || user.value?.email || '?';
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
});

onMounted(async () => {
  await initAuth();
  if (!user.value) return;
  await loadAccountBoards();
});

async function loadAccountBoards() {
  await loadBoards();
  if (boards.value.length > 0) {
    await loadBoard(boards.value[0]);
    await postLoadBoard();
  }
}

function toggleAuthMode() {
  authMode.value = authMode.value === 'login' ? 'signup' : 'login';
}

async function onAuthSubmit() {
  try {
    if (authMode.value === 'login') {
      await login(authForm.email, authForm.password);
    } else {
      await signup({
        email: authForm.email,
        name: authForm.name,
        password: authForm.password,
      });
    }
    await loadAccountBoards();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: authMode.value === 'login' ? 'Sign in failed' : 'Signup failed',
      detail: err.message,
      life: 5000,
    });
  }
}

async function onLogout() {
  await logout();
  resetBoards();
}

async function postLoadBoard() {
  if (!boardData.value) return;

  // Load board settings
  await loadSettings(activeBoard.value);

  const updated = processRecurring(boardData.value.cards, boardData.value.config);
  if (updated) {
    await saveCards(activeBoard.value, boardData.value.cards);
    toast.add({
      severity: 'info',
      summary: 'Recurring tasks reset',
      detail: 'Weekly recurring cards have been moved back to their starting column.',
      life: 4000,
    });
  }
  checkDeadlineNotifications(boardData.value.cards);

  // Refresh GitHub metadata in the background
  const hasGhCards = boardData.value.cards.some(
    (c) => c.link && c.link.includes('github.com')
  );
  if (hasGhCards) {
    refreshGitHubMeta(activeBoard.value).then((count) => {
      if (count > 0) {
        toast.add({
          severity: 'info',
          summary: 'GitHub sync',
          detail: `Updated metadata for ${count} card(s).`,
          life: 3000,
        });
      }
    });
  }
}

async function onBoardSelect(boardName) {
  await loadBoard(boardName);
  await postLoadBoard();
}

async function onBoardCreate({ name, columns }) {
  try {
    await createBoard(name, columns);
    showCreateBoard.value = false;
    toast.add({
      severity: 'success',
      summary: 'Board created',
      detail: `Board "${name}" is ready.`,
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Failed to create board',
      detail: err.message,
      life: 5000,
    });
  }
}

async function onCardsUpdate(cards) {
  boardData.value.cards = cards;
  try {
    await saveCards(activeBoard.value, cards);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Failed to save cards',
      detail: err.message,
      life: 5000,
    });
  }
}

function onEditCard(card) {
  editingCard.value = { ...card };
  showAddCard.value = true;
}

function onDeleteCard(card) {
  confirm.require({
    message: `Delete "${card.title}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await deleteCard(card);
      toast.add({
        severity: 'success',
        summary: 'Card deleted',
        detail: `"${card.title}" has been removed.`,
        life: 3000,
      });
    },
  });
}

function onDialogHide() {
  showAddCard.value = false;
  editingCard.value = null;
}

async function onSettingsSave(settings) {
  try {
    await saveSettings(activeBoard.value, settings);
    showSettings.value = false;
    toast.add({
      severity: 'success',
      summary: 'Settings saved',
      detail: 'Board settings have been updated.',
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Failed to save settings',
      detail: err.message,
      life: 5000,
    });
  }
}

async function onCardSave(card) {
  if (editingCard.value) {
    await updateCard(card);
    toast.add({
      severity: 'success',
      summary: 'Card updated',
      detail: `"${card.title}" has been saved.`,
      life: 3000,
    });
  } else {
    await createCard(card);
    toast.add({
      severity: 'success',
      summary: 'Card added',
      detail: `"${card.title}" added to "${card.status}".`,
      life: 3000,
    });
  }
  showAddCard.value = false;
  editingCard.value = null;
}
</script>
