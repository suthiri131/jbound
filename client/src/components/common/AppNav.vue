<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { initials } from "@/utils/format";

defineEmits(["open-satchel"]);
const auth = useAuthStore();
const router = useRouter();

// One nav for every page. Names must match the room names used across the app.
const links = [
  { to: "/", label: "Basecamp", exact: true },
  { to: "/planner", label: "Planner" },
  { to: "/explorer", label: "Explorer" },
  { to: "/watcher", label: "Watcher" },
  { to: "/tales", label: "Tales" },
  { to: "/ledger", label: "Ledger" },
  { to: "/archives", label: "Archives" },
];

async function logout() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <header class="nav-wrap">
    <div class="container nav">
      <RouterLink to="/" class="logo" aria-label="JBound Basecamp">
        <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="15" fill="#2E5A3C" />
          <path d="M17 5 21 17 17 29 13 17Z" fill="#F3EAD3" />
          <path d="M17 5 21 17H13Z" fill="#C2502A" />
        </svg>
        <span class="display">jbound</span>
      </RouterLink>

      <nav aria-label="Main" class="links">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="link"
          :exact-active-class="l.exact ? 'is-active' : ''"
          :active-class="l.exact ? '' : 'is-active'"
          >{{ l.label }}</RouterLink
        >
      </nav>

      <div class="actions">
        <button type="button" class="satchel" @click="$emit('open-satchel')">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 8h14l-1 12H6Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            <path d="M5 12h14" />
          </svg>
          Satchel
        </button>
        <button
          type="button"
          class="avatar"
          :aria-label="`Signed in as ${auth.profile?.name}. Sign out`"
          :title="`Sign out (${auth.profile?.name})`"
          @click="logout"
        >
          {{ initials(auth.profile?.name) }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav-wrap {
  border-bottom: 2px solid var(--ink);
  background: var(--paper);
  position: sticky;
  top: 0;
  z-index: 40;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 22px;
  padding-top: 12px;
  padding-bottom: 12px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--ink);
}
.logo .display {
  font-size: 28px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
  flex: 1 1 520px;
}
.link {
  padding: 12px 10px;
  font-weight: 600;
  font-size: 15px;
  color: var(--ink);
  text-decoration: none;
}
.link:hover {
  color: var(--ember);
}
.link.is-active {
  color: var(--ember);
  font-weight: 700;
  text-decoration: underline wavy var(--ember-line);
  text-underline-offset: 6px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.satchel {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 18px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--mustard);
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: var(--sage);
  font-weight: 800;
  cursor: pointer;
}
</style>
