<script setup>
import { watch, onBeforeUnmount } from 'vue';

const props = defineProps({ message: { type: String, default: '' }, linkTo: { type: String, default: '' }, linkLabel: { type: String, default: '' } });
const emit = defineEmits(['close']);
let timer;
watch(
  () => props.message,
  (m) => {
    clearTimeout(timer);
    if (m) timer = setTimeout(() => emit('close'), 6000);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div v-if="message" class="toast" role="status">
    <span>{{ message }}</span>
    <RouterLink v-if="linkTo" :to="linkTo" style="color: var(--ink)">{{ linkLabel }}</RouterLink>
    <button type="button" class="btn btn-sm" aria-label="Dismiss" @click="emit('close')">✕</button>
  </div>
</template>
