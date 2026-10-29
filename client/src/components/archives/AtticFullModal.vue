<script setup>
/** Shown when a newly archived trip arrives and all 7 attic drawers are taken. The user must choose. */
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  trip: { type: Object, required: true },
  capacity: { type: Number, default: 7 },
  waiting: { type: Number, default: 0 }, // more archives queued behind this one
  busy: Boolean,
  error: { type: String, default: '' },
});
const emit = defineEmits(['clear', 'swap']);
const clearBtn = ref(null);
const swapBtn = ref(null);
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  swapBtn.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
function trapFocus(event) {
  event.preventDefault();
  if (props.busy) return;
  (document.activeElement === swapBtn.value ? clearBtn.value : swapBtn.value)?.focus();
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" />
    <div class="modal attic-full" role="alertdialog" aria-modal="true" aria-labelledby="attic-full-title" aria-describedby="attic-full-description" :aria-busy="busy" tabindex="-1" @keydown.tab="trapFocus">
      <span class="eyebrow muted">All {{ capacity }} drawers are taken</span>
      <h2 id="attic-full-title" class="display display-md">The attic is full.</h2>
      <div id="attic-full-description">
        <p>
          <strong>“{{ trip.name }}”</strong> just came up from the Memory Box, but there's no empty drawer for it.
          Clear it out, or swap it into one of your old drawers.
        </p>
        <p class="hand muted note">Either way, this only changes your attic. The rest of the crew keeps their copy.</p>
        <p v-if="waiting" class="hand muted note">{{ waiting }} more trip{{ waiting === 1 ? ' is' : 's are' }} waiting after this one.</p>
      </div>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="row actions">
        <button ref="clearBtn" type="button" class="btn btn-ghost" :disabled="busy" @click="emit('clear')">{{ busy ? 'Clearing…' : 'Clear it out' }}</button>
        <button ref="swapBtn" type="button" class="btn btn-mustard" :disabled="busy" @click="emit('swap')">Swap for an old drawer</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.note { margin: 6px 0 0; font-size: 18px; }
.actions { justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
</style>
