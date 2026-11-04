<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import AppNav from "@/components/common/AppNav.vue";
import { hasSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useCampMusic } from '@/composables/useCampMusic'
import NotificationsPanel from "../components/common/NotificationsPanel.vue";
import AppDialog from "@/components/common/AppDialog.vue";
import { dismissDialogs } from "@/lib/dialog";

const route = useRoute();
const auth = useAuthStore();
const notifOpen = ref(false);
// The sign-in / sign-up pages have their own header, so the app nav + footer are hidden there.
const showChrome = computed(
  () => route.name && !["login", "sign-in", "sign-up"].includes(route.name),
);
const fullBleed = computed(() => Boolean(route.meta.fullBleed));
const peekNav = computed(() => Boolean(route.meta.peekNav));
watch(() => route.path, dismissDialogs); // a question about the page you just left no longer applies
useCampMusic();
// peek nav: the camp's top-right buttons slide down with it, so it never covers them
const navShell = ref(null);
const navHeight = ref(72);
const peekHold = ref(false);
let navObserver = null;
watch(
  navShell,
  (el, old) => {
    navObserver ||= new ResizeObserver(([e]) => (navHeight.value = Math.round(e.target.getBoundingClientRect().height)));
    if (old) navObserver.unobserve(old);
    if (el) navObserver.observe(el);
  },
  { flush: "post" },
);
onBeforeUnmount(() => navObserver?.disconnect());

// moving from the open nav onto those buttons keeps the nav open, so they don't slide back up under the mouse
function onPointerOver(e) {
  if (peekHold.value || !e.target.closest?.(".hud.top-right")) return;
  peekHold.value = (navShell.value?.getBoundingClientRect().bottom ?? 0) > 1;
}
function onPointerOut(e) {
  if (peekHold.value && !e.relatedTarget?.closest?.(".hud.top-right")) peekHold.value = false;
}
</script>

<template>
  <div
    class="app"
    :class="{ 'full-bleed': fullBleed, 'peek-hold': peekHold, 'notif-open': notifOpen }"
    :style="{ '--peek-nav-h': navHeight + 'px' }"
    @pointerover="onPointerOver"
    @pointerout="onPointerOut"
  >    
    <p v-if="!hasSupabase" class="setup-banner" role="status">
        Setup needed: add <code>VITE_SUPABASE_URL</code> and
        <code>VITE_SUPABASE_ANON_KEY</code> to <code>client/.env.local</code> (see
        README).
    </p>
    <div v-if="showChrome" ref="navShell" class="nav-shell" :class="{ peek: peekNav }">      <AppNav
        @open-satchel="satchelOpen = true"
        @open-notifications="notifOpen = true"
      />
    </div>
    <RouterView :key="auth.user?.id || 'guest'" />
    <footer v-if="showChrome && !fullBleed" class="footer hand">
      JBound · Singapore ⇄ Johor Bahru
    </footer>
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

/* the notifications drawer sits on top of the page, so a dropped-down nav goes behind it */
.app.notif-open .nav-shell.peek {
  z-index: 49;
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
  .app.peek-hold .nav-shell.peek {
    transform: none;
    transition-delay: 0s;
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
<style>
/* the camp's top-right buttons ride down with the peek nav (App.vue sets --peek-nav-h to its height) */
@media (hover: hover) and (pointer: fine) {
  .app .hud.top-right {
    transition: translate 0.25s ease 0.35s; /* same timing as the nav hiding */
  }
  .app:has(.nav-shell.peek:hover) .hud.top-right,
  .app:has(.nav-shell.peek:focus-within) .hud.top-right,
  .app:has(.nav-shell.peek .menu) .hud.top-right,
  .app:has(.nav-shell.peek .nav-open) .hud.top-right,
  .app.peek-hold .hud.top-right {
    translate: 0 var(--peek-nav-h, 72px);
    transition-delay: 0s;
  }
}
@media (prefers-reduced-motion: reduce) {
  .app .hud.top-right {
    transition: none;
  }
}
</style>
