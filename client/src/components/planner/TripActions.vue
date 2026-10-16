<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({ canDelete: { type: Boolean, default: false } });
const emit = defineEmits(['edit', 'delete']);
const open = ref(false);
const root = ref(null);
const trigger = ref(null);
function dismiss(event) {
  if (!root.value?.contains(event.target)) open.value = false;
}
function close() {
  open.value = false;
  trigger.value?.focus();
}
function choose(action) {
  if (action === 'delete' && !props.canDelete) return;
  close();
  emit(action);
}
onMounted(() => document.addEventListener('pointerdown', dismiss));
onBeforeUnmount(() => document.removeEventListener('pointerdown', dismiss));
</script>

<template>
  <div ref="root" class="trip-actions" @keydown.esc.stop.prevent="close" @focusout="!root.contains($event.relatedTarget) && (open = false)">
    <button ref="trigger" type="button" class="btn btn-ghost actions-trigger" aria-label="Trip actions" :aria-expanded="open" @click="open = !open">⋮</button>
    <div v-if="open" class="actions-popover">
      <button type="button" @click="choose('edit')">Edit trip</button>
      <button v-if="canDelete" type="button" class="delete-action" @click="choose('delete')">Delete trip</button>
    </div>
  </div>
</template>

<style scoped>
.trip-actions { position: relative; flex: none; }
.actions-trigger { font-size: 28px; line-height: 1; min-width: 44px; min-height: 44px; padding: 4px 10px; }
.actions-popover { position: absolute; right: 0; top: calc(100% + 6px); z-index: 10; min-width: 150px; padding: 6px; background: var(--paper); border: 2px solid var(--ink); border-radius: var(--radius); box-shadow: 3px 3px 0 var(--ink); }
.actions-popover button { display: block; width: 100%; padding: 10px 12px; border: 0; border-radius: 6px; background: transparent; text-align: left; font: inherit; font-weight: 700; cursor: pointer; }
.actions-popover button:hover, .actions-popover button:focus-visible { background: var(--paper-deep); }
.actions-popover .delete-action { color: #a12b20; }
</style>
