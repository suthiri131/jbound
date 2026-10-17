<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import AddStopForm from './AddStopForm.vue';

defineProps({ trip: Object, item: Object, dates: Array });
const emit = defineEmits(['close', 'saved']);
const dialog = ref(null);
const busy = ref(false);
let previousFocus;
function close() {
  if (!busy.value) emit('close');
}
onMounted(() => {
  previousFocus = document.activeElement;
  dialog.value.showModal();
  dialog.value.querySelector('input')?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="edit-stop-modal" aria-labelledby="edit-stop-heading" :aria-busy="busy" @cancel.prevent="close">
      <h2 id="edit-stop-heading" class="display display-md">Edit stop</h2>
      <AddStopForm :trip="trip" :item="item" :dates="dates" @busy="busy = $event" @close="close" @saved="emit('saved')" />
    </dialog>
  </Teleport>
</template>

<style scoped>
.edit-stop-modal { width: min(560px, calc(100% - 32px)); max-height: calc(100dvh - 48px); overflow-y: auto; padding: 24px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); color: var(--ink); box-shadow: 8px 8px 0 var(--ink); }
.edit-stop-modal::backdrop { background: rgba(42, 33, 23, .55); }
</style>
