<template>
  <div class="kanban-column" :data-status="name">
    <div class="kanban-column-header">
      <span>{{ name }}</span>
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
import { ref, watch } from 'vue';
import { Sortable } from 'sortablejs-vue3';
import KanbanCard from './KanbanCard.vue';

const props = defineProps({
  name: { type: String, required: true },
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
