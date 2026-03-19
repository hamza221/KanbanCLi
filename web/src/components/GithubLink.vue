<template>
  <a
    v-if="link"
    :href="link"
    target="_blank"
    rel="noopener noreferrer"
    class="kanban-card-link"
  >
    <i :class="iconClass"></i>
    <span>{{ displayText }}</span>
  </a>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  link: { type: String, required: true },
  meta: { type: Object, default: null },
});

const isGithub = computed(() => {
  return props.link.includes('github.com');
});

const iconClass = computed(() => {
  if (!isGithub.value) return 'pi pi-external-link';
  if (props.meta?.type === 'pull_request') return 'pi pi-code';
  return 'pi pi-github';
});

const displayText = computed(() => {
  if (props.meta) {
    const prefix = props.meta.type === 'pull_request' ? 'PR' : '#';
    return `${props.meta.repo}${prefix}${props.meta.number}`;
  }
  if (isGithub.value) {
    try {
      const url = new URL(props.link);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 4) {
        return `${parts[0]}/${parts[1]}#${parts[3]}`;
      }
      return url.pathname;
    } catch {
      return props.link;
    }
  }
  return props.link;
});
</script>
