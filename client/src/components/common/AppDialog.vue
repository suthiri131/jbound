<script setup>
import { nextTick, ref, watch } from "vue";
import { answerDialog, currentDialog as dialog } from "@/lib/dialog";

const root = ref(null);
let previousFocus = null;

watch(dialog, async (now, before) => {
  if (now && !before) previousFocus = document.activeElement;
  if (!now) {
    previousFocus?.focus?.();
    previousFocus = null;
    return;
  }
  await nextTick();
  // the first button: Cancel on a question, so a stray Enter never confirms anything; OK on a notice
  root.value?.querySelector("button")?.focus();
});

function trapFocus(event) {
  event.preventDefault();
  const buttons = [...root.value.querySelectorAll("button")];
  const step = event.shiftKey ? buttons.length - 1 : 1;
  buttons[
    (buttons.indexOf(document.activeElement) + step) % buttons.length
  ]?.focus();
}
</script>

<template>
  <Teleport to="body">
    <template v-if="dialog">
      <div class="scrim app-dialog-scrim" @click="answerDialog(false)" />
      <div
        ref="root"
        class="modal app-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        :aria-describedby="dialog.message ? 'app-dialog-message' : undefined"
        tabindex="-1"
        @keydown.esc.stop.prevent="answerDialog(false)"
        @keydown.tab="trapFocus"
      >
        <h2 id="app-dialog-title" class="display display-md">
          {{ dialog.title }}
        </h2>
        <p v-if="dialog.message" id="app-dialog-message">
          {{ dialog.message }}
        </p>
        <div class="row actions">
          <button
            v-if="dialog.kind === 'confirm'"
            type="button"
            class="btn btn-ghost"
            @click="answerDialog(false)"
          >
            {{ dialog.cancelLabel }}
          </button>
          <button
            type="button"
            class="btn"
            :class="dialog.danger ? 'btn-ember' : 'btn-primary'"
            @click="answerDialog(true)"
          >
            {{ dialog.confirmLabel }}
          </button>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style scoped>
/* above everything, including the photo viewers */
.app-dialog-scrim {
  z-index: 10000;
}
.app-dialog {
  z-index: 10001;
  overflow-wrap: anywhere;
}
.actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
</style>
