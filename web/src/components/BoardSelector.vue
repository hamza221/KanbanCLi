<template>
  <Select
    v-model="selected"
    :options="boards"
    placeholder="Select a board"
    class="board-selector"
    @change="$emit('select', selected)"
  />
</template>

<script setup>
import { ref, watch } from 'vue';
import Select from 'primevue/select';

const props = defineProps({
  boards: { type: Array, required: true },
  activeBoard: { type: String, default: null },
});

defineEmits(['select']);

const selected = ref(props.activeBoard);

watch(
  () => props.activeBoard,
  (val) => {
    selected.value = val;
  }
);
</script>
