<script setup>
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthShell from '@/components/auth/AuthShell.vue';
import { errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { safeRedirect } from '@/utils/safeRedirect';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const next = computed(() => safeRedirect(route.query.next));
const signUpLink = computed(() => ({ name: 'sign-up', query: route.query.next ? { next: route.query.next } : {} }));

const form = reactive({ email: '', password: '' });
const showPassword = ref(false);
const saving = ref(false);
const error = ref('');

async function submit() {
  if (saving.value) return;
  error.value = '';
  saving.value = true;
  try {
    await auth.login(form.email.trim(), form.password);
    await router.replace(next.value);
  } catch (e) {
    error.value = e?.response?.data?.details?.[0]?.message || errorMessage(e, 'Could not sign you in.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AuthShell eyebrow="Welcome back" title="Sign in" subtitle="Pick up your trips where you left off.">
    <form class="card card-pad stack" novalidate @submit.prevent="submit">
      <label class="field">
        Email
        <input v-model="form.email" class="input" type="email" autocomplete="email" required placeholder="you@example.com" />
      </label>
      <label class="field">
        Password
        <span class="pw">
          <input v-model="form.password" class="input" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required />
          <button type="button" class="btn btn-sm btn-ghost" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
        </span>
      </label>

      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <button class="btn btn-primary" type="submit" :disabled="saving || !form.email || !form.password">
        {{ saving ? 'Signing in…' : 'Sign in' }}
      </button>
      <p class="muted alt">New here? <RouterLink :to="signUpLink">Create an account</RouterLink></p>
    </form>
  </AuthShell>
</template>

<style scoped>
.pw { display: flex; gap: 8px; align-items: stretch; }
.pw .input { flex: 1; min-width: 0; }
.alt { margin: 0; font-size: 14px; }
</style>
