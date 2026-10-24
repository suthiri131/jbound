<script setup>
/**
 * "Delete your account?" dialog. It only collects the password and shows what happened; the parent
 * (ProfileView) makes the API call and passes `busy` / `error` / `blockedTrips` back in.
 *
 * Accessibility: role="dialog" + aria-modal with a label and description, focus moves in (to the password
 * field) and is trapped, the rest of the app is made `inert` while it is open, Esc and Cancel close it, focus
 * returns to the button that opened it, and errors are announced (role="alert").
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  busy: Boolean,
  error: { type: String, default: '' },
  // trips the person owns that other people are in (the server refuses to delete the account until they are sorted)
  blockedTrips: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'confirm']);

const password = ref('');
const localError = ref('');
const dialog = ref(null);
const field = ref(null);
const errorBox = ref(null);
const message = computed(() => localError.value || props.error);
let previousFocus;
let appRoot;

onMounted(() => {
  previousFocus = document.activeElement;
  appRoot = document.getElementById('app');
  appRoot?.setAttribute('inert', ''); // the dialog is teleported to <body>, so it stays interactive
  field.value?.focus();
});
onBeforeUnmount(() => {
  appRoot?.removeAttribute('inert'); // must come first: an inert element cannot take focus
  previousFocus?.focus?.();
});

// After a failed attempt the busy buttons come back; put focus somewhere sensible instead of losing it.
watch(
  () => props.busy,
  async (busy, wasBusy) => {
    if (!wasBusy || busy || !props.error) return;
    await nextTick();
    if (props.blockedTrips.length) errorBox.value?.focus();
    else {
      field.value?.focus();
      field.value?.select();
    }
  },
);

function close() {
  if (!props.busy) emit('close');
}

function submit() {
  if (props.busy) return;
  localError.value = '';
  if (!password.value) {
    localError.value = 'Enter your password to confirm.';
    field.value?.focus();
    return;
  }
  emit('confirm', password.value);
}

/** Keep Tab / Shift+Tab inside the dialog. */
function trapFocus(event) {
  const items = [...dialog.value.querySelectorAll('a[href], button, input')].filter((el) => !el.disabled);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!dialog.value.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click="close" />
    <div
      ref="dialog"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-description"
      :aria-busy="busy"
      tabindex="-1"
      @keydown.esc.stop.prevent="close"
      @keydown.tab="trapFocus"
    >
      <h2 id="delete-account-title" class="display display-md">Delete your account?</h2>
      <p id="delete-account-description">
        This permanently deletes your JBound account and cannot be undone. Enter your password to confirm it is you.
      </p>

      <form novalidate @submit.prevent="submit">
        <label class="field" for="delete-account-password">
          Password
          <input
            id="delete-account-password"
            ref="field"
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            :readonly="busy"
            :aria-invalid="Boolean(message)"
            :aria-describedby="message ? 'delete-account-error' : undefined"
          />
        </label>

        <div v-if="message" id="delete-account-error" ref="errorBox" class="error-text problem" role="alert" tabindex="-1">
          <p>{{ message }}</p>
          <ul v-if="blockedTrips.length" aria-label="Trips to sort out first">
            <li v-for="trip in blockedTrips" :key="trip.id">
              <RouterLink :to="`/planner/${trip.id}`">{{ trip.name }}</RouterLink>
            </li>
          </ul>
        </div>

        <!-- always in the DOM so screen readers announce the text when it changes -->
        <p class="sr-only" role="status">{{ busy ? 'Deleting your account…' : '' }}</p>

        <div class="row actions">
          <button type="button" class="btn btn-ghost" :aria-disabled="busy" @click="close">Cancel</button>
          <button type="submit" class="btn delete-button" :aria-disabled="busy">
            {{ busy ? 'Deleting…' : 'Delete my account permanently' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
/* The global focus ring (mustard) is only ~2:1 against the paper background; WCAG wants 3:1 for focus indicators. */
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.delete-button { background: #a12b20; color: var(--card); }
.problem { margin-top: 12px; }
.problem p { margin: 0; }
.problem ul { margin: 8px 0 0; padding-left: 20px; }
.problem a { color: inherit; }
.actions { justify-content: flex-end; margin-top: 20px; }
</style>
