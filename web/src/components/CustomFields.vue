<template>
  <template v-for="fieldDef in schema" :key="fieldDef.key">
    <Chip
      v-if="fields[fieldDef.key] !== undefined && fields[fieldDef.key] !== null"
      :label="formatField(fieldDef, fields[fieldDef.key])"
      class="kanban-custom-field"
    />
  </template>
</template>

<script setup>
import Chip from 'primevue/chip';

defineProps({
  fields: { type: Object, required: true },
  schema: { type: Array, required: true },
});

function formatField(fieldDef, value) {
  const label = fieldDef.label || fieldDef.key;
  if (fieldDef.type === 'boolean') {
    return value ? `${label}` : null;
  }
  return `${label}: ${value}`;
}
</script>
