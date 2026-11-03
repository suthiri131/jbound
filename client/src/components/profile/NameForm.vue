<script setup>

import { ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/lib/api';

const auth = useAuthStore();
const firstName = ref('');
const lastName = ref('');
const firstField = ref(null);
const lastField = ref(null);
const errors = ref({ firstName: '', lastName: '' });
const error = ref('');
const status = ref('');
const busy = ref(false);

// keep the boxes in step with the saved name (also fills them in once the profile has loaded)
watch(
  () => [auth.profile?.first_name, auth.profile?.last_name],
  ([first, last]) => {
    firstName.value = first || '';
    lastName.value = last || '';
  },
  { immediate: true },
);

function check(value, label) {
  if (!value) return `Enter your ${label}.`;
  if (value.length > 30) return `Use 30 characters or fewer for your ${label}.`;
  return '';
}

async function submit() {
  if (busy.value) return;
  status.value = '';
  error.value = '';
  const first = firstName.value.trim();
  const last = lastName.value.trim();
  errors.value = { firstName: check(first, 'first name'), lastName: check(last, 'last name') };
  if (errors.value.firstName) return firstField.value?.focus();
  if (errors.value.lastName) return lastField.value?.focus();

  busy.value = true;
  try {
    await auth.updateName({ firstName: first, lastName: last });
    status.value = 'Your name has been updated.';
  } catch (err) {
    error.value = errorMessage(err, 'We could not save your name. Please try again.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card-flat card-pad block" aria-labelledby="name-title" :aria-busy="busy">
    <h2 id="name-title" class="display display-sm">Name</h2>
    <form class="stack" novalidate @submit.prevent="submit">
      <div class="two">
        <div class="field">
          <label for="profile-first-name">First name</label>
          <input
            id="profile-first-name"
            ref="firstField"
            v-model="firstName"
            class="input"
            type="text"
            autocomplete="given-name"
            maxlength="30"
            :readonly="busy"
            :aria-invalid="Boolean(errors.firstName)"
            :aria-describedby="errors.firstName ? 'profile-first-name-error' : undefined"
          />
          <p v-if="errors.firstName" id="profile-first-name-error" class="error-text" role="alert">{{ errors.firstName }}</p>
        </div>
        <div class="field">
          <label for="profile-last-name">Last name</label>
          <input
            id="profile-last-name"
            ref="lastField"
            v-model="lastName"
            class="input"
            type="text"
            autocomplete="family-name"
            maxlength="30"
            :readonly="busy"
            :aria-invalid="Boolean(errors.lastName)"
            :aria-describedby="errors.lastName ? 'profile-last-name-error' : undefined"
          />
          <p v-if="errors.lastName" id="profile-last-name-error" class="error-text" role="alert">{{ errors.lastName }}</p>
        </div>
      </div>
      <p class="hint">This is the name your crew sees. A first name with a space, like “Albert Stein”, is kept as one first name.</p>
      <div><button type="submit" class="btn btn-primary" :aria-disabled="busy">{{ busy ? 'Saving…' : 'Save name' }}</button></div>
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
.two { display: grid; gap: 16px; }
@media (min-width: 560px) { .two { grid-template-columns: 1fr 1fr; } }
</style>
