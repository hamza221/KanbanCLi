<template>
  <Dialog
    :visible="visible"
    :header="isEditing ? 'Edit Card' : 'Add Card'"
    modal
    :style="{ width: '30rem' }"
    @update:visible="$emit('hide')"
  >
    <div class="card-dialog-form">
      <div class="field">
        <label for="card-title">Title</label>
        <InputText
          id="card-title"
          v-model="form.title"
          placeholder="Card title"
          fluid
          :invalid="submitted && !form.title.trim()"
        />
        <small v-if="submitted && !form.title.trim()" class="p-error">
          Title is required
        </small>
      </div>

      <div class="field">
        <label for="card-status">Status</label>
        <Select
          id="card-status"
          v-model="form.status"
          :options="config.columns"
          placeholder="Select status"
          fluid
        />
      </div>

      <div class="field">
        <label for="card-link">Link</label>
        <InputText
          id="card-link"
          v-model="form.link"
          placeholder="https://github.com/..."
          fluid
        />
      </div>

      <div class="field">
        <label for="card-deadline">Deadline</label>
        <DatePicker
          id="card-deadline"
          v-model="form.deadlineDate"
          showIcon
          dateFormat="yy-mm-dd"
          placeholder="Select date"
          fluid
        />
      </div>

      <div class="field">
        <Checkbox
          v-model="form.isRecurring"
          binary
          inputId="card-recurring"
        />
        <label for="card-recurring" style="margin-inline-start: 0.5rem">
          Weekly recurring
        </label>
      </div>

      <template v-if="config.customFields?.length">
        <div
          v-for="fieldDef in config.customFields"
          :key="fieldDef.key"
          class="field"
        >
          <label :for="'cf-' + fieldDef.key">
            {{ fieldDef.label || fieldDef.key }}
          </label>

          <Select
            v-if="fieldDef.type === 'select'"
            :id="'cf-' + fieldDef.key"
            v-model="form.customFields[fieldDef.key]"
            :options="fieldDef.options"
            :placeholder="'Select ' + (fieldDef.label || fieldDef.key)"
            fluid
          />
          <InputNumber
            v-else-if="fieldDef.type === 'number'"
            :id="'cf-' + fieldDef.key"
            v-model="form.customFields[fieldDef.key]"
            fluid
          />
          <Checkbox
            v-else-if="fieldDef.type === 'boolean'"
            :id="'cf-' + fieldDef.key"
            v-model="form.customFields[fieldDef.key]"
            binary
          />
          <DatePicker
            v-else-if="fieldDef.type === 'date'"
            :id="'cf-' + fieldDef.key"
            v-model="form.customFields[fieldDef.key]"
            showIcon
            fluid
          />
          <InputText
            v-else
            :id="'cf-' + fieldDef.key"
            v-model="form.customFields[fieldDef.key]"
            fluid
          />
        </div>
      </template>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="$emit('hide')" />
      <Button
        :label="isEditing ? 'Update' : 'Save'"
        icon="pi pi-check"
        @click="onSave"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { reactive, computed, ref, watch } from 'vue';
import { nanoid } from 'nanoid';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import { format, parseISO } from 'date-fns';

const props = defineProps({
  visible: { type: Boolean, required: true },
  config: { type: Object, required: true },
  card: { type: Object, default: null },
});

const emit = defineEmits(['hide', 'save']);

const submitted = ref(false);

const isEditing = computed(() => !!props.card);

const form = reactive({
  title: '',
  status: '',
  link: '',
  deadlineDate: null,
  isRecurring: false,
  customFields: {},
});

watch(
  () => props.visible,
  (val) => {
    submitted.value = false;
    if (val && props.card) {
      // Editing mode — populate form from card
      form.title = props.card.title || '';
      form.status = props.card.status || props.config.columns?.[0] || '';
      form.link = props.card.link || '';
      form.deadlineDate = props.card.deadline ? parseISO(props.card.deadline) : null;
      form.isRecurring = !!props.card.recurring;
      form.customFields = { ...(props.card.customFields || {}) };
    } else if (val) {
      // Adding mode — reset
      form.title = '';
      form.status = props.config.columns?.[0] || '';
      form.link = '';
      form.deadlineDate = null;
      form.isRecurring = false;
      form.customFields = {};
    }
  }
);

function onSave() {
  submitted.value = true;
  if (!form.title.trim()) return;

  const now = new Date().toISOString();

  if (isEditing.value) {
    // Update existing card
    const card = {
      ...props.card,
      title: form.title.trim(),
      status: form.status,
      link: form.link || null,
      deadline: form.deadlineDate ? format(form.deadlineDate, 'yyyy-MM-dd') : null,
      recurring: form.isRecurring
        ? props.card.recurring || {
            frequency: 'weekly',
            lastReset: format(new Date(), 'yyyy-MM-dd'),
            resetToStatus: props.config.columns?.[0] || form.status,
          }
        : null,
      customFields: Object.keys(form.customFields).length > 0 ? { ...form.customFields } : {},
      updatedAt: now,
    };
    emit('save', card);
  } else {
    // Create new card
    const card = {
      id: nanoid(10),
      title: form.title.trim(),
      status: form.status,
      link: form.link || null,
      linkMeta: null,
      deadline: form.deadlineDate ? format(form.deadlineDate, 'yyyy-MM-dd') : null,
      recurring: form.isRecurring
        ? {
            frequency: 'weekly',
            lastReset: format(new Date(), 'yyyy-MM-dd'),
            resetToStatus: props.config.columns?.[0] || form.status,
          }
        : null,
      customFields: Object.keys(form.customFields).length > 0 ? { ...form.customFields } : {},
      createdAt: now,
      updatedAt: now,
    };
    emit('save', card);
  }
}
</script>

<style scoped>
.card-dialog-form {
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
</style>
