<script setup>
import NotificationsList from './NotificationsList.vue';

const emit = defineEmits(['close']);
</script>

<template>
  <div class="scrim" @click="emit('close')" />
  <aside class="drawer pouch-paper" aria-label="Notifications" @keydown.esc="emit('close')">
    <NotificationsList @navigate="emit('close')">
      <template #actions>
        <button type="button" class="btn btn-icon close" aria-label="Close notifications" @click="emit('close')">✕</button>
      </template>
    </NotificationsList>
  </aside>
</template>

<style scoped>
/* the inside of a kraft mail pouch, stitched down its open edge */
.drawer {
  position: fixed;
  z-index: 51;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100%);
  overflow: auto;
  padding: 24px 22px 32px 28px;
  border-left: 3px solid var(--ink);
  box-shadow: inset 12px 0 0 #c9a971, -6px 0 18px rgba(30, 20, 8, 0.4);
}
.drawer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  border-left: 2px dashed #fbf6e9;
}
.close {
  flex: none;
  border-radius: 50%;
  background: var(--card);
}
</style>
