<template>
  <div class="kanban-column" :data-status="name">
    <div class="kanban-column-header">
      <div class="kanban-column-title">
        <span
          class="kanban-column-dot"
          :class="{ 'is-done': isDoneColumn, 'is-hollow': index === 0 && !isDoneColumn }"
          :style="{ '--column-color': columnColor }"
        >
          <i v-if="isDoneColumn" class="pi pi-check"></i>
        </span>
        <span>{{ name }}</span>
      </div>
      <span class="kanban-column-count">{{ cards.length }}</span>
    </div>
    <div class="kanban-column-cards">
      <Sortable
        :list="localCards"
        item-key="id"
        :options="sortableOptions"
        @end="onDragEnd"
      >
        <template #item="{ element }">
          <KanbanCard
            :key="element.id"
            :card="element"
            :config="config"
            @edit="(card) => $emit('edit-card', card)"
            @delete="(card) => $emit('delete-card', card)"
          />
        </template>
      </Sortable>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Sortable } from 'sortablejs-vue3';
import KanbanCard from './KanbanCard.vue';

const props = defineProps({
  name: { type: String, required: true },
  index: { type: Number, default: 0 },
  cards: { type: Array, required: true },
  config: { type: Object, required: true },
});

const emit = defineEmits(['update:cards', 'edit-card', 'delete-card']);

const localCards = ref([...props.cards]);

watch(
  () => props.cards,
  (val) => {
    localCards.value = [...val];
  },
  { deep: true }
);

const sortableOptions = {
  group: 'kanban',
  animation: 150,
  ghostClass: 'ghost-card',
  dragClass: 'sortable-drag',
};

const columnColors = ['#8a8f98', '#9aa0aa', '#e0a526', '#7a5af5', '#3fa663'];

const isDoneColumn = computed(() => {
  return /done|complete|closed/i.test(props.name);
});

const columnColor = computed(() => {
  if (isDoneColumn.value) return '#3fa663';
  return columnColors[props.index % columnColors.length];
});

function onDragEnd(event) {
  const { to } = event;
  const targetStatus = to?.closest('[data-status]')?.dataset?.status;
  if (targetStatus && targetStatus !== props.name) {
    // Card moved to another column — handled by the target column
    return;
  }
  emit('update:cards', localCards.value);
}
</script>
