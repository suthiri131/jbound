<script setup>
/**
 * "Email" section: change the email you sign in with. The password is re-checked first.
 * Like sign-up, the new address is not verified with a link, so the hint tells people to check the spelling.
 */
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/lib/api';

const auth = useAuthStore();
const email = ref('');
const password = ref('');
const emailField = ref(null);
const passwordField = ref(null);
const errors = ref({ email: '', password: '' });
const error = ref('');
const status = ref('');
const busy = ref(false);

async function submit() {
  if (busy.value) return;
  status.value = '';
  error.value = '';
  const next = email.value.trim();
  errors.value = { email: '', password: '' };
  if (!/^\S+@\S+\.\S+$/.test(next)) errors.value.email = 'Enter a valid email address.';
  else if (next.toLowerCase() === String(auth.user?.email).toLowerCase()) errors.value.email = 'That is already your email address.';
  else if (!password.value) errors.value.password = 'Enter your password to confirm.';
  if (errors.value.email) return emailField.value?.focus();
  if (errors.value.password) return passwordField.value?.focus();

  busy.value = true;
  try {
    await auth.changeEmail({ email: next, password: password.value });
    status.value = `Your sign-in email is now ${auth.user?.email}.`;
    email.value = '';
    password.value = '';
  } catch (err) {
    const message = errorMessage(err, 'We could not change your email. Please try again.');
    const code = err?.response?.status;
    if (code === 403) {
      errors.value.password = message; // wrong password
      passwordField.value?.focus();
    } else if (code === 400 || code === 409) {
      errors.value.email = message; // same address / already used by someone else
      emailField.value?.focus();
    } else {
      error.value = message;
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card-flat card-pad block" aria-labelledby="email-title" :aria-busy="busy">
    <h2 id="email-title" class="display display-sm">Email</h2>
    <p class="current">Your sign-in email is <strong>{{ auth.user?.email }}</strong>.</p>
    <form class="stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="profile-new-email">New email</label>
        <input
          id="profile-new-email"
          ref="emailField"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          :readonly="busy"
          :aria-invalid="Boolean(errors.email)"
          :aria-describedby="errors.email ? 'profile-new-email-hint profile-new-email-error' : 'profile-new-email-hint'"
        />
        <p id="profile-new-email-hint" class="hint">You will use this to sign in. We do not send a confirmation link, so check the spelling.</p>
        <p v-if="errors.email" id="profile-new-email-error" class="error-text" role="alert">{{ errors.email }}</p>
      </div>
      <div class="field">
        <label for="profile-email-password">Current password</label>
        <input
          id="profile-email-password"
          ref="passwordField"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          :readonly="busy"
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? 'profile-email-password-error' : undefined"
        />
        <p v-if="errors.password" id="profile-email-password-error" class="error-text" role="alert">{{ errors.password }}</p>
      </div>
      <div><button type="submit" class="btn btn-primary" :aria-disabled="busy">{{ busy ? 'Changing…' : 'Change email' }}</button></div>
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
.current { margin: 0 0 14px; overflow-wrap: anywhere; }
</style>
