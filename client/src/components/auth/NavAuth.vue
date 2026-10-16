<script setup>
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

async function signOut() {
  await auth.logout();
  router.push('/');
}
</script>

<template>
  <div class="nav-auth">
    <template v-if="auth.ready">
      <template v-if="auth.isLoggedIn">
        <span class="nav-auth-name">{{ auth.profile?.name }}</span>
        <button type="button" class="btn btn-sm" @click="signOut">Sign out</button>
      </template>
      <template v-else>
        <RouterLink class="btn btn-sm btn-ghost" :to="{ name: 'sign-in', query: { next: route.fullPath } }">Sign in</RouterLink>
        <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'sign-up', query: { next: route.fullPath } }">Sign up</RouterLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.nav-auth { display: flex; align-items: center; gap: 10px; min-height: 38px; }
.nav-auth-name { font-weight: 700; font-size: 14px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 640px) { .nav-auth-name { display: none; } }
</style>
