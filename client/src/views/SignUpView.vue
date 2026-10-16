<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthShell from '@/components/auth/AuthShell.vue';
import { errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { safeRedirect } from '@/utils/safeRedirect';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const next = computed(() => safeRedirect(route.query.next));
const signInLink = computed(() => ({ name: 'sign-in', query: route.query.next ? { next: route.query.next } : {} }));

const form = reactive({ name: '', username: '', email: '', password: '' });
const showPassword = ref(false);
const saving = ref(false);
const error = ref('');

// Suggest a username from the name until the person types their own.
let usernameEdited = false;
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 20);
watch(
  () => form.name,
  (name) => {
    if (!usernameEdited) form.username = slug(name);
  },
);
function onUsernameInput() {
  usernameEdited = true;
  form.username = slug(form.username);
}

async function submit() {
  if (saving.value) return;
  error.value = '';
  if (!/^[a-z0-9_]{3,20}$/.test(form.username)) {
    error.value = 'Username needs 3–20 characters: letters, numbers or underscores.';
    return;
  }
  if (form.password.length < 8) {
    error.value = 'Use at least 8 characters for your password.';
    return;
  }
  saving.value = true;
  try {
    await auth.signup({ name: form.name.trim(), username: form.username, email: form.email.trim(), password: form.password });
    await router.replace(next.value);
  } catch (e) {
    // the API's validation errors carry a readable first issue in `details`
    error.value = e?.response?.data?.details?.[0]?.message || errorMessage(e, 'Could not create your account.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AuthShell eyebrow="Join the crew" title="Create your account" subtitle="Free, and it takes under a minute.">
    <form class="card card-pad stack" novalidate @submit.prevent="submit">
      <label class="field">
        Name
        <input v-model="form.name" class="input" type="text" autocomplete="name" required maxlength="60" placeholder="What should your crew call you?" />
      </label>
      <label class="field">
        Username
        <input v-model="form.username" class="input" type="text" autocomplete="username" required maxlength="20" placeholder="e.g. jb_explorer" autocapitalize="none" spellcheck="false" @input="onUsernameInput" />
      </label>
      <label class="field">
        Email
        <input v-model="form.email" class="input" type="email" autocomplete="email" required placeholder="you@example.com" />
      </label>
      <label class="field">
        Password
        <span class="pw">
          <input v-model="form.password" class="input" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters" />
          <button type="button" class="btn btn-sm btn-ghost" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
        </span>
      </label>

      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <button class="btn btn-primary" type="submit" :disabled="saving || !form.name.trim() || !form.username || !form.email || !form.password">
        {{ saving ? 'Creating account…' : 'Create account' }}
      </button>
      <p class="muted alt">Already have an account? <RouterLink :to="signInLink">Sign in</RouterLink></p>
    </form>
  </AuthShell>
</template>

<style scoped>
.pw { display: flex; gap: 8px; align-items: stretch; }
.pw .input { flex: 1; min-width: 0; }
.alt { margin: 0; font-size: 14px; }
</style>
