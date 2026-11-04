<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
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
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="archive-trip-title" aria-describedby="archive-trip-description" :aria-busy="busy" tabindex="-1" @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus">
      <h2 id="archive-trip-title" class="display display-md">Send this trip up to the Archives now?</h2>
      <p id="archive-trip-description">Nobody will be able to add more photos.</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 20px">
        <button ref="cancel" type="button" class="btn btn-ghost" :disabled="busy" @click="close">Cancel</button>
        <button ref="confirm" type="button" class="btn btn-ember" :disabled="busy" @click="!busy && emit('confirm')">{{ busy ? 'Sending…' : 'Send to the Archives' }}</button>
      </div>
    </div>
  </Teleport>
</template>
