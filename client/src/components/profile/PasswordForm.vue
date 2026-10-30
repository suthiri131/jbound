<script setup>
/**
 * "Password" section: current password + new password (typed twice). The API signs every other device out, so the
 * status says so. A single "Show passwords" checkbox reveals all three boxes.
 */
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/lib/api';

const auth = useAuthStore();
const current = ref('');
const next = ref('');
const confirm = ref('');
const show = ref(false);
const currentField = ref(null);
const nextField = ref(null);
const confirmField = ref(null);
const errors = ref({ current: '', next: '', confirm: '' });
const error = ref('');
const status = ref('');
const busy = ref(false);

// live hint once they start typing in the confirm box
const mismatch = computed(() => confirm.value !== '' && next.value !== confirm.value);
const type = computed(() => (show.value ? 'text' : 'password'));

async function submit() {
  if (busy.value) return;
  status.value = '';
  error.value = '';
  errors.value = { current: '', next: '', confirm: '' };
  if (!current.value) errors.value.current = 'Enter your current password.';
  else if (next.value.length < 8) errors.value.next = 'Use at least 8 characters.';
  else if (next.value.length > 72) errors.value.next = 'Use 72 characters or fewer.';
  else if (next.value === current.value) errors.value.next = 'Your new password must be different from your current one.';
  else if (next.value !== confirm.value) errors.value.confirm = 'Passwords do not match.';
  if (errors.value.current) return currentField.value?.focus();
  if (errors.value.next) return nextField.value?.focus();
  if (errors.value.confirm) return confirmField.value?.focus();

  busy.value = true;
  try {
    const result = await auth.changePassword({ currentPassword: current.value, newPassword: next.value });
    if (result.signedOut) return; // the page is about to redirect to sign-in
    current.value = '';
    next.value = '';
    confirm.value = '';
    status.value = result.otherDevicesSignedOut
      ? 'Your password has been changed. You were signed out of your other devices.'
      : 'Your password has been changed.';
  } catch (err) {
    const message = errorMessage(err, 'We could not change your password. Please try again.');
    const code = err?.response?.status;
    if (code === 403) {
      errors.value.current = message; // wrong current password
      currentField.value?.focus();
    } else if (code === 400) {
      errors.value.next = message; // same as before, or rejected as too weak
      nextField.value?.focus();
    } else {
      error.value = message;
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card-flat card-pad block" aria-labelledby="password-title" :aria-busy="busy">
    <h2 id="password-title" class="display display-sm">Password</h2>
    <form class="stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="profile-current-password">Current password</label>
        <input
          id="profile-current-password"
          ref="currentField"
          v-model="current"
          class="input"
          :type="type"
          autocomplete="current-password"
          :readonly="busy"
          :aria-invalid="Boolean(errors.current)"
          :aria-describedby="errors.current ? 'profile-current-password-error' : undefined"
        />
        <p v-if="errors.current" id="profile-current-password-error" class="error-text" role="alert">{{ errors.current }}</p>
      </div>
      <div class="field">
        <label for="profile-new-password">New password</label>
        <input
          id="profile-new-password"
          ref="nextField"
          v-model="next"
          class="input"
          :type="type"
          autocomplete="new-password"
          :readonly="busy"
          :aria-invalid="Boolean(errors.next)"
          :aria-describedby="errors.next ? 'profile-new-password-hint profile-new-password-error' : 'profile-new-password-hint'"
        />
        <p id="profile-new-password-hint" class="hint">At least 8 characters.</p>
        <p v-if="errors.next" id="profile-new-password-error" class="error-text" role="alert">{{ errors.next }}</p>
      </div>
      <div class="field">
        <label for="profile-confirm-password">Confirm new password</label>
        <input
          id="profile-confirm-password"
          ref="confirmField"
          v-model="confirm"
          class="input"
          :type="type"
          autocomplete="new-password"
          :readonly="busy"
          :aria-invalid="Boolean(errors.confirm) || mismatch"
          :aria-describedby="errors.confirm || mismatch ? 'profile-confirm-password-error' : undefined"
        />
        <p v-if="errors.confirm || mismatch" id="profile-confirm-password-error" class="error-text" role="alert">
          {{ errors.confirm || 'Passwords do not match.' }}
        </p>
      </div>
      <label class="check"><input v-model="show" type="checkbox" /> Show passwords</label>
      <div><button type="submit" class="btn btn-primary" :aria-disabled="busy">{{ busy ? 'Changing…' : 'Change password' }}</button></div>
      <p class="status" role="status">{{ status }}</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    </form>
  </section>
</template>

<style scoped>
/* The global focus ring (mustard) is only ~2:1 against the paper background; WCAG wants 3:1 for focus indicators. */
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.block h2 { margin-bottom: 14px; }
.stack { display: grid; gap: 16px; }
.hint { margin: 0; font-size: 14px; color: var(--ink-mute); }
.status { margin: 0; min-height: 1.4em; font-size: 14px; font-weight: 600; }
.error-text { margin: 0; }
.check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; font-weight: 600; cursor: pointer; }
.check input { width: 22px; height: 22px; accent-color: var(--ink); }
</style>
