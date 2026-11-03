import { shallowRef } from 'vue';


export const currentDialog = shallowRef(null);
const waiting = [];

function open(dialog) {
  return new Promise((resolve) => {
    waiting.push({ ...dialog, resolve });
    if (!currentDialog.value) currentDialog.value = waiting.shift();
  });
}

/** The user's answer to the popup on screen; the next one in line (if any) then takes its place. */
export function answerDialog(answer) {
  const dialog = currentDialog.value;
  if (!dialog) return;
  currentDialog.value = waiting.shift() || null;
  dialog.resolve(answer);
}

/**
 * Asks a yes/no question. Resolves to true only if the user picks the confirm button.
 * @param {{ title: string, message?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} options
 * @returns {Promise<boolean>}
 */
export function askConfirm({ title, message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  return open({ kind: 'confirm', title, message, confirmLabel, cancelLabel, danger });
}

/** Tells the user something (usually that an action failed). Resolves once they dismiss it. */
export function showAlert(message, { title = 'Something went wrong' } = {}) {
  return open({ kind: 'alert', title, message, confirmLabel: 'OK' });
}

/** Leaving the page: a question about what was on it no longer applies, so treat it as "no". */
export function dismissDialogs() {
  while (currentDialog.value) answerDialog(false);
}
