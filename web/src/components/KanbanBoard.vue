<template>
  <div class="kanban-board">
    <KanbanColumn
      v-for="(column, index) in config.columns"
      :key="column"
      :name="column"
      :index="index"
      :cards="cardsByColumn(column)"
      :config="config"
      @update:cards="(updated) => onColumnUpdate(column, updated)"
      @edit-card="(card) => $emit('edit-card', card)"
      @delete-card="(card) => $emit('delete-card', card)"
    />
  </div>
</template>

<script setup>
import KanbanColumn from './KanbanColumn.vue';

const props = defineProps({
  config: { type: Object, required: true },
  cards: { type: Array, required: true },
});

const emit = defineEmits(['update:cards', 'edit-card', 'delete-card']);

function cardsByColumn(columnName) {
  return props.cards.filter((c) => c.status === columnName);
}

function onColumnUpdate(column, updatedColumnCards) {
  // Replace cards for this column, keep other columns intact
  const otherCards = props.cards.filter((c) => c.status !== column);
  // Mark all updated cards with the correct status
  const withStatus = updatedColumnCards.map((c) => ({ ...c, status: column }));
  emit('update:cards', [...otherCards, ...withStatus]);
}
</script>
