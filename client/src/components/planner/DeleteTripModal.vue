<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  trip: { type: Object, required: true },
  busy: Boolean,
  error: { type: String, default: '' },
});
const emit = defineEmits(['close', 'confirm']);
const cancel = ref(null);
const confirm = ref(null);
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  cancel.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
function close() {
  if (!props.busy) emit('close');
}
function trapFocus(event) {
  event.preventDefault();
  if (props.busy) return;
  (document.activeElement === cancel.value ? confirm.value : cancel.value)?.focus();
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click="close" />
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-trip-title" aria-describedby="delete-trip-description" :aria-busy="busy" tabindex="-1" @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus">
      <h2 id="delete-trip-title" class="display display-md">Delete trip?</h2>
      <p id="delete-trip-description">Permanently delete “{{ trip.name }}” and all its stops, memories and other trip records? This cannot be undone.</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 20px">
        <button ref="cancel" type="button" class="btn btn-ghost" :disabled="busy" @click="close">Cancel</button>
        <button ref="confirm" type="button" class="btn delete-button" :disabled="busy" @click="!busy && emit('confirm')">{{ busy ? 'Deleting…' : 'Yes, delete trip' }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.delete-button { background: #a12b20; color: var(--card); }
</style>
