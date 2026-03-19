<template>
  <Dialog
    :visible="visible"
    header="Board Settings"
    modal
    :style="{ width: '36rem' }"
    @update:visible="$emit('hide')"
  >
    <div class="settings-form">
      <h3 class="settings-section-title">GitHub Label → Status Mapping</h3>
      <p class="settings-description">
        Map GitHub labels to local board columns. When GitHub metadata is synced,
        cards with matching labels can be auto-assigned to the mapped status.
      </p>

      <!-- Existing mappings -->
      <div v-if="mappingEntries.length > 0" class="settings-mappings">
        <div
          v-for="(entry, idx) in mappingEntries"
          :key="idx"
          class="settings-mapping-row"
        >
          <InputText
            v-model="entry.label"
            placeholder="GitHub label"
            fluid
            size="small"
          />
          <i class="pi pi-arrow-right settings-arrow"></i>
          <Select
            v-model="entry.status"
            :options="columns"
            placeholder="Board column"
            fluid
            size="small"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            variant="text"
            size="small"
            rounded
            @click="removeMapping(idx)"
          />
        </div>
      </div>

      <div v-else class="settings-empty">
        No mappings configured yet.
      </div>

      <!-- Add new mapping -->
      <div class="settings-add-row">
        <Button
          icon="pi pi-plus"
          label="Add Mapping"
          severity="secondary"
          size="small"
          outlined
          @click="addMapping"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="$emit('hide')" />
      <Button label="Save" icon="pi pi-check" @click="onSave" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';

const props = defineProps({
  visible: { type: Boolean, required: true },
  columns: { type: Array, required: true },
  settings: { type: Object, required: true },
});

const emit = defineEmits(['hide', 'save']);

const mappingEntries = ref([]);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // Populate from settings
      const map = props.settings.githubStatusMap || {};
      mappingEntries.value = Object.entries(map).map(([label, status]) => ({
        label,
        status,
      }));
    }
  }
);

function addMapping() {
  mappingEntries.value.push({ label: '', status: '' });
}

function removeMapping(idx) {
  mappingEntries.value.splice(idx, 1);
}

function onSave() {
  const githubStatusMap = {};
  for (const entry of mappingEntries.value) {
    const label = entry.label.trim();
    if (label && entry.status) {
      githubStatusMap[label] = entry.status;
    }
  }
  emit('save', { githubStatusMap });
}
</script>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.settings-description {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #94a3b8);
  line-height: 1.4;
}

.settings-mappings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-mapping-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings-arrow {
  flex-shrink: 0;
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 0.875rem;
}

.settings-empty {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #94a3b8);
  font-style: italic;
}

.settings-add-row {
  display: flex;
}
</style>
