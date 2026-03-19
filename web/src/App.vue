<template>
  <div class="kanban-app">
    <Toast />
    <ConfirmDialog />
    <Toolbar class="kanban-toolbar">
      <template #start>
        <h1 class="kanban-title">CLIkanban</h1>
      </template>
      <template #center>
        <div class="kanban-toolbar-center">
          <BoardSelector
            :boards="boards"
            :activeBoard="activeBoard"
            @select="onBoardSelect"
          />
          <Button
            icon="pi pi-plus-circle"
            label="New Board"
            severity="secondary"
            size="small"
            outlined
            @click="showCreateBoard = true"
          />
        </div>
      </template>
      <template #end>
        <Button
          icon="pi pi-cog"
          severity="secondary"
          variant="text"
          size="small"
          rounded
          v-tooltip.bottom="'Settings'"
          :disabled="!boardData"
          @click="showSettings = true"
        />
        <Button
          :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
          severity="secondary"
          variant="text"
          size="small"
          rounded
          v-tooltip.bottom="isDark ? 'Light mode' : 'Dark mode'"
          @click="toggleDark"
        />
        <Button
          icon="pi pi-plus"
          label="Add Card"
          size="small"
          :disabled="!boardData"
          @click="showAddCard = true"
        />
      </template>
    </Toolbar>

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
      <p>Create a board to get started:</p>
      <Button
        icon="pi pi-plus-circle"
        label="New Board"
        @click="showCreateBoard = true"
      />
    </div>

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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Toolbar from 'primevue/toolbar';
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

const toast = useToast();
const confirm = useConfirm();

const {
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
} = useBoard();

const { processRecurring } = useRecurring();
const { checkDeadlineNotifications } = useNotifications();
const { isDark, toggle: toggleDark } = useDarkMode();

const showAddCard = ref(false);
const showCreateBoard = ref(false);
const showSettings = ref(false);
const editingCard = ref(null);

onMounted(async () => {
  await loadBoards();
  if (boards.value.length > 0) {
    await loadBoard(boards.value[0]);
    await postLoadBoard();
  }
});

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
  await saveCards(activeBoard.value, cards);
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
      boardData.value.cards = boardData.value.cards.filter((c) => c.id !== card.id);
      await saveCards(activeBoard.value, boardData.value.cards);
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
    const idx = boardData.value.cards.findIndex((c) => c.id === card.id);
    if (idx !== -1) {
      boardData.value.cards[idx] = card;
    }
    toast.add({
      severity: 'success',
      summary: 'Card updated',
      detail: `"${card.title}" has been saved.`,
      life: 3000,
    });
  } else {
    boardData.value.cards.push(card);
    toast.add({
      severity: 'success',
      summary: 'Card added',
      detail: `"${card.title}" added to "${card.status}".`,
      life: 3000,
    });
  }
  await saveCards(activeBoard.value, boardData.value.cards);
  showAddCard.value = false;
  editingCard.value = null;
}
</script>
