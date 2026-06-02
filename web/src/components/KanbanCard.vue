<template>
  <article class="kanban-card" tabindex="0">
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

    <div class="kanban-card-header">
      <h3 class="kanban-card-title">{{ displayTitle }}</h3>
      <div class="kanban-card-actions">
        <Button
          icon="pi pi-pencil"
          severity="secondary"
          variant="text"
          size="small"
          rounded
          v-tooltip.top="'Edit'"
          @click.stop="$emit('edit', card)"
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          variant="text"
          size="small"
          rounded
          v-tooltip.top="'Delete'"
          @click.stop="$emit('delete', card)"
        />
      </div>
    </div>

    <GithubLink v-if="card.link" :link="card.link" :meta="card.linkMeta" />

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

    <div class="kanban-card-bottom">
      <span class="kanban-card-id">
        <i class="pi pi-chart-bar"></i>
        {{ card.id }}
      </span>
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
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
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

const displayTitle = computed(() => {
  const title = props.card.title?.trim();
  if (title) return title;
  if (props.card.linkMeta?.title) return props.card.linkMeta.title;
  return githubIssueLabel(props.card.link) || 'Untitled card';
});

/**
 * Compute inline style for a GitHub label chip.
 * Uses the label color as background with contrasting text.
 */
function labelStyle(color) {
  if (!color) return {};
  const hex = color.startsWith('#') ? color : `#${color}`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
    color: hex,
    border: 'none',
  };
}

function githubIssueLabel(link) {
  if (!link) return null;
  try {
    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 4 && (parts[2] === 'issues' || parts[2] === 'pull')) {
      return `${parts[0]}/${parts[1]}#${parts[3]}`;
    }
  } catch {
    return null;
  }
  return null;
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
