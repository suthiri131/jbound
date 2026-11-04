<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import AppNav from "@/components/common/AppNav.vue";
import SatchelDrawer from "@/components/common/SatchelDrawer.vue";
import { hasSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useCampMusic } from '@/composables/useCampMusic'
import NotificationsPanel from "../components/common/NotificationsPanel.vue";
import AppDialog from "@/components/common/AppDialog.vue";
import { dismissDialogs } from "@/lib/dialog";

const route = useRoute();
const auth = useAuthStore();
const satchelOpen = ref(false);
watch(
  () => auth.user?.id,
  () => {
    satchelOpen.value = false;
  },
);
const notifOpen = ref(false);
// The sign-in / sign-up pages have their own header, so the app nav + footer are hidden there.
const showChrome = computed(
  () => route.name && !["login", "sign-in", "sign-up"].includes(route.name),
);
const fullBleed = computed(() => Boolean(route.meta.fullBleed));
const peekNav = computed(() => Boolean(route.meta.peekNav));
watch(() => route.path, dismissDialogs); // a question about the page you just left no longer applies
useCampMusic();
</script>

<template>
  <div class="app" :class="{ 'full-bleed': fullBleed }">
    <p v-if="!hasSupabase" class="setup-banner" role="status">
      Setup needed: add <code>VITE_SUPABASE_URL</code> and
      <code>VITE_SUPABASE_ANON_KEY</code> to <code>client/.env.local</code> (see
      README).
    </p>
    <div v-if="showChrome" class="nav-shell" :class="{ peek: peekNav }">
      <AppNav
        @open-satchel="satchelOpen = true"
        @open-notifications="notifOpen = true"
      />
    </div>
    <RouterView :key="auth.user?.id || 'guest'" />
    <footer v-if="showChrome && !fullBleed" class="footer hand">
      JBound · Singapore ⇄ Johor Bahru
    </footer>
    <SatchelDrawer v-if="satchelOpen" @close="satchelOpen = false" />
    <NotificationsPanel v-if="notifOpen" @close="notifOpen = false" />
    <AppDialog />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}
.app > :deep(.container) {
  width: 100%;
}
.app.full-bleed {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.app.full-bleed > :deep(main) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.setup-banner {
  margin: 0;
  padding: 10px 16px;
  background: var(--clay);
  border-bottom: 2px solid var(--ink);
  font-size: 14px;
  text-align: center;
}

/* ---- peek nav: hidden above the screen, slides down when the mouse touches the top edge ---- */
/* Mouse devices only. Touch screens can't hover, so they keep the normal nav. */
@media (hover: hover) and (pointer: fine) {
  .nav-shell.peek {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 60;
    transform: translateY(-100%);
    transition: transform 0.25s ease 0.35s; /* short delay before hiding, so a wobbly mouse doesn't flicker it */
  }
  /* invisible strip that pokes out below the hidden nav: hovering it pulls the nav down */
  .nav-shell.peek::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    height: 14px;
  }
  .nav-shell.peek:hover,
  .nav-shell.peek:focus-within,
  .nav-shell.peek:has(.menu),
  .nav-shell.peek:has(.nav-open) {
    transform: none;
    transition-delay: 0s;
  }
  /* the dropped-down nav covers the top of the page, so keep the camp's top-right buttons below it */
  .app:has(.nav-shell.peek) :deep(.hud.top-right) {
    top: 86px;
  }
}@media (prefers-reduced-motion: reduce) {
  .nav-shell.peek {
    transition: none;
  }
}

.footer {
  margin-top: auto;
  border-top: 2px solid var(--ink);
  padding: 26px 24px;
  text-align: center;
  color: var(--ink-soft);
  font-size: 24px;
}
</style>
