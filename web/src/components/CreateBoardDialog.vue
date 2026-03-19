<template>
  <Dialog
    :visible="visible"
    header="Create Board"
    modal
    :style="{ width: '28rem' }"
    @update:visible="$emit('hide')"
  >
    <div class="create-board-form">
      <div class="field">
        <label for="board-name">Board Name</label>
        <InputText
          id="board-name"
          v-model="form.name"
          placeholder="my-project"
          fluid
          :invalid="submitted && !isNameValid"
        />
        <small v-if="submitted && !form.name.trim()" class="p-error">
          Name is required
        </small>
        <small v-else-if="submitted && !isNameValid" class="p-error">
          Use only letters, numbers, hyphens, dots, and underscores
        </small>
      </div>

      <div class="field">
        <label for="board-columns">Columns</label>
        <InputText
          id="board-columns"
          v-model="form.columns"
          placeholder="To Do, In Progress, Done"
          fluid
          :invalid="submitted && !hasColumns"
        />
        <small class="field-hint">Comma-separated column names</small>
        <small v-if="submitted && !hasColumns" class="p-error">
          At least one column is required
        </small>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="$emit('hide')" />
      <Button
        label="Create"
        icon="pi pi-plus"
        @click="onCreate"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const props = defineProps({
  visible: { type: Boolean, required: true },
});

const emit = defineEmits(['hide', 'create']);

const submitted = ref(false);

const form = reactive({
  name: '',
  columns: 'To Do, In Progress, Done',
});

const BOARD_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const isNameValid = computed(() => {
  return form.name.trim() && BOARD_NAME_RE.test(form.name.trim());
});

const hasColumns = computed(() => {
  return form.columns
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean).length > 0;
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      submitted.value = false;
      form.name = '';
      form.columns = 'To Do, In Progress, Done';
    }
  }
);

function onCreate() {
  submitted.value = true;
  if (!isNameValid.value || !hasColumns.value) return;

  const columns = form.columns
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  emit('create', { name: form.name.trim(), columns });
}
</script>

<style scoped>
.create-board-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-weight: 600;
  font-size: 0.875rem;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #94a3b8);
}
</style>
