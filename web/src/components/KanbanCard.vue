<template>
  <Card class="kanban-card">
    <template #content>
      <div class="kanban-card-header">
        <div class="kanban-card-title">{{ card.title }}</div>
        <div class="kanban-card-actions">
          <Button
            icon="pi pi-pencil"
            severity="secondary"
            variant="text"
            size="small"
            rounded
            v-tooltip.top="'Edit'"
            @click="$emit('edit', card)"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            variant="text"
            size="small"
            rounded
            v-tooltip.top="'Delete'"
            @click="$emit('delete', card)"
          />
        </div>
      </div>

      <GithubLink v-if="card.link" :link="card.link" :meta="card.linkMeta" />

      <!-- GitHub labels as colored chips -->
      <div
        v-if="card.linkMeta?.labels?.length"
        class="kanban-card-labels"
      >
        <Tag
          v-for="label in card.linkMeta.labels"
          :key="label.name"
          :value="label.name"
          rounded
          :style="labelStyle(label.color)"
        />
      </div>

      <!-- GitHub metadata row (author, assignees, comments) -->
      <div v-if="hasGhMeta" class="kanban-card-gh-meta">
        <span v-if="card.linkMeta.author" class="gh-meta-item" v-tooltip.top="'Author'">
          <i class="pi pi-user"></i> {{ card.linkMeta.author }}
        </span>
        <span v-if="card.linkMeta.assignees?.length" class="gh-meta-item" v-tooltip.top="'Assignees'">
          <i class="pi pi-users"></i> {{ card.linkMeta.assignees.join(', ') }}
        </span>
        <span v-if="card.linkMeta.commentsCount > 0" class="gh-meta-item" v-tooltip.top="'Comments'">
          <i class="pi pi-comments"></i> {{ card.linkMeta.commentsCount }}
        </span>
      </div>

      <div class="kanban-card-meta">
        <DeadlineTag v-if="card.deadline" :deadline="card.deadline" />

        <Tag
          v-if="card.recurring"
          value="Weekly"
          icon="pi pi-refresh"
          severity="info"
          rounded
        />

        <CustomFields
          v-if="card.customFields && config.customFields"
          :fields="card.customFields"
          :schema="config.customFields"
        />
      </div>
    </template>
  </Card>
</template>

<script setup>
import { computed } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import GithubLink from './GithubLink.vue';
import DeadlineTag from './DeadlineTag.vue';
import CustomFields from './CustomFields.vue';

const props = defineProps({
  card: { type: Object, required: true },
  config: { type: Object, required: true },
});

defineEmits(['edit', 'delete']);

const hasGhMeta = computed(() => {
  const m = props.card.linkMeta;
  return m && (m.author || m.assignees?.length || m.commentsCount > 0);
});

/**
 * Compute inline style for a GitHub label chip.
 * Uses the label color as background with contrasting text.
 */
function labelStyle(color) {
  if (!color) return {};
  const hex = color.startsWith('#') ? color : `#${color}`;
  // Compute perceived luminance to pick black or white text
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '#000000' : '#ffffff';
  return {
    backgroundColor: hex,
    color: textColor,
    border: 'none',
  };
}
</script>

<style scoped>
.kanban-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.kanban-card-actions {
  display: flex;
  gap: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.kanban-card:hover .kanban-card-actions {
  opacity: 1;
}

.kanban-card-gh-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block-start: 0.375rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #94a3b8);
}

.gh-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}
</style>
