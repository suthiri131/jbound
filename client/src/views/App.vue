<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppNav from '@/components/common/AppNav.vue';
import SatchelDrawer from '@/components/common/SatchelDrawer.vue';
import { hasSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
const satchelOpen = ref(false);
watch(() => auth.user?.id, () => { satchelOpen.value = false; });
// The sign-in / sign-up pages have their own header, so the app nav + footer are hidden there.
const showChrome = computed(() => route.name && !['login', 'sign-in', 'sign-up'].includes(route.name));
</script>

<template>
  <div class="app">
    <p v-if="!hasSupabase" class="setup-banner" role="status">
      Setup needed: add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>client/.env.local</code> (see README).
    </p>
    <AppNav v-if="showChrome" @open-satchel="satchelOpen = true" />
    <RouterView :key="auth.user?.id || 'guest'" />
    <footer v-if="showChrome" class="footer hand">JBound · Singapore ⇄ Johor Bahru</footer>
    <SatchelDrawer v-if="satchelOpen" @close="satchelOpen = false" />
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
.app > :deep(.container) { width: 100%; }
.setup-banner { margin: 0; padding: 10px 16px; background: var(--clay); border-bottom: 2px solid var(--ink); font-size: 14px; text-align: center; }
.footer { margin-top: auto; border-top: 2px solid var(--ink); padding: 26px 24px; text-align: center; color: var(--ink-soft); font-size: 24px; }
</style>
