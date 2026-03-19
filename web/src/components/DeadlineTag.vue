<template>
  <Tag :value="label" :severity="severity" :icon="icon" rounded />
</template>

<script setup>
import { computed } from 'vue';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import Tag from 'primevue/tag';

const props = defineProps({
  deadline: { type: String, required: true },
});

const daysUntil = computed(() => {
  try {
    return differenceInCalendarDays(parseISO(props.deadline), new Date());
  } catch {
    return null;
  }
});

const severity = computed(() => {
  const d = daysUntil.value;
  if (d === null) return 'secondary';
  if (d < 0) return 'danger';
  if (d <= 1) return 'danger';
  if (d <= 3) return 'warn';
  if (d <= 7) return 'warn';
  return 'success';
});

const icon = computed(() => {
  const d = daysUntil.value;
  if (d === null) return 'pi pi-calendar';
  if (d < 0) return 'pi pi-exclamation-triangle';
  if (d <= 1) return 'pi pi-clock';
  return 'pi pi-calendar';
});

const label = computed(() => {
  const d = daysUntil.value;
  if (d === null) return 'No date';
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `${d}d left`;
});
</script>
