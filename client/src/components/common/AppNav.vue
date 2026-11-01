<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { initials } from "@/utils/format";
 
defineEmits(["open-satchel"]);
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
 
// Account menu (avatar -> name, @username, Sign out)
const menuOpen = ref(false);
const menuRoot = ref(null);
// Below 860px the page links fold into a hamburger. navOpen = the dropdown is showing.
const navOpen = ref(false);
const navRoot = ref(null);
const MOBILE_QUERY = "(max-width: 860px)";
let mobileMedia;
const closeNavOnDesktop = (e) => {
  if (!e.matches) navOpen.value = false; // grew back to desktop width
};
 
const closeOnOutsideClick = (e) => {
  if (menuOpen.value && menuRoot.value && !menuRoot.value.contains(e.target)) menuOpen.value = false;

  if (navOpen.value && navRoot.value && !navRoot.value.contains(e.target)) navOpen.value = false;
};
const closeOnEscape = (e) => {
  if (e.key === "Escape") {
    menuOpen.value = false;
    navOpen.value = false; 
  }
};
onMounted(() => {
  document.addEventListener("click", closeOnOutsideClick);
  document.addEventListener("keydown", closeOnEscape);
  mobileMedia = window.matchMedia(MOBILE_QUERY);
  mobileMedia.addEventListener("change", closeNavOnDesktop);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", closeOnOutsideClick);
  document.removeEventListener("keydown", closeOnEscape);
  mobileMedia?.removeEventListener("change", closeNavOnDesktop);
});
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
    navOpen.value = false; 
  },
);
 
// One nav for every page. Names must match the room names used across the app.
const links = [
  { to: "/", label: "Basecamp", exact: true },
  { to: "/planner", label: "Planner" },
  { to: "/watcher", label: "Watcher" },
  { to: "/tales", label: "Tales" },
  { to: "/ledger", label: "Ledger" },
  { to: "/archives", label: "Archives" },
  { to: "/explorer", label: "Explorer" },
];
 
async function logout() {
  menuOpen.value = false;
  navOpen.value = false;
  await auth.logout();
  router.push("/login");
}
</script>
 
<template>
  <header ref="navRoot" class="nav-wrap" :class="{ 'nav-open': navOpen }">
    <div class="container nav">
      <RouterLink to="/" class="logo" aria-label="JBound Basecamp">
        <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="15" fill="#2E5A3C" />
          <path d="M17 5 21 17 17 29 13 17Z" fill="#F3EAD3" />
          <path d="M17 5 21 17H13Z" fill="#C2502A" />
        </svg>
        <span class="display">jbound</span>
      </RouterLink>
 
      <nav id="main-nav" aria-label="Main" class="links">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="link"
          :class="{ 'is-active': l.to === '/planner' && route.path.startsWith('/planner/') }"
          :exact-active-class="l.exact ? 'is-active' : ''"
          :active-class="l.exact ? '' : 'is-active'"
          @click="navOpen = false"
          >{{ l.label }}</RouterLink
        >
        <div v-if="!auth.isLoggedIn && auth.ready" class="mobile-auth">
          <RouterLink class="btn btn-ghost" :to="{ name: 'sign-in', query: { next: route.fullPath } }">Sign in</RouterLink>
          <RouterLink class="btn btn-primary" :to="{ name: 'sign-up', query: { next: route.fullPath } }">Sign up</RouterLink>
        </div>
      </nav>
 
      <div class="actions">
        <button v-if="auth.isLoggedIn" type="button" class="satchel" @click="$emit('open-satchel')">
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
          <span class="satchel-label">Your trips</span>
        </button>
        <div v-if="auth.isLoggedIn" ref="menuRoot" class="account">
          <button
            type="button"
            class="avatar"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            :aria-label="`Account menu for ${auth.profile?.name}`"
            @click="menuOpen = !menuOpen"
          >
            <UserAvatar :name="auth.profile?.name" :url="auth.profile?.avatar_url" :size="40" />
          </button>
          <div v-if="menuOpen" class="menu" role="menu">
            <p class="menu-name">{{ auth.profile?.name }}</p>
            <p v-if="auth.profile?.username" class="menu-meta">@{{ auth.profile.username }}</p>
            <p v-if="auth.user?.email" class="menu-meta">{{ auth.user.email }}</p>
            <RouterLink to="/profile" class="btn btn-sm menu-link" role="menuitem">Profile</RouterLink>
            <button type="button" class="btn btn-sm menu-out" role="menuitem" @click="logout">Sign out</button>
          </div>
        </div>
        <template v-else-if="auth.ready">
          <RouterLink class="btn btn-sm btn-ghost desktop-auth" :to="{ name: 'sign-in', query: { next: route.fullPath } }">Sign in</RouterLink>
          <RouterLink class="btn btn-sm btn-primary desktop-auth" :to="{ name: 'sign-up', query: { next: route.fullPath } }">Sign up</RouterLink>
        </template>
 
        <button
          type="button"
          class="burger"
          aria-controls="main-nav"
          :aria-expanded="navOpen"
          :aria-label="navOpen ? 'Close menu' : 'Open menu'"
          data-cy="nav-burger"
          @click="navOpen = !navOpen"
        >
          <span /><span /><span />
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
  display: grid;
  place-items: center;
  padding: 0;
  overflow: hidden;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: var(--sage);
  font-weight: 800;
  cursor: pointer;
}
.account {
  position: relative;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: 50;
  min-width: 220px;
  padding: 14px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: var(--shadow-sm);
}
.menu-name {
  margin: 0;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.menu-meta {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}
.menu-link,
.menu-out {
  width: 100%;
  margin-top: 12px;
}
 
.burger,
.mobile-auth {
  display: none;
}
@media (max-width: 860px) {
  .nav {
    flex-wrap: nowrap;
    justify-content: space-between;
  }
  .logo .display {
    font-size: 24px;
  }
 
  /* page links become a dropdown under the header */
  .links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 0;
    padding: 6px 16px 18px;
    background: var(--paper);
    border-bottom: 2px solid var(--ink);
    box-shadow: 0 8px 0 rgba(42, 33, 23, 0.12);
    max-height: calc(100vh - 72px);
    overflow-y: auto;
  }
  .nav-open .links {
    display: flex;
    animation: drop 0.18s ease-out;
  }
  .link {
    padding: 14px 4px;
    font-size: 17px;
    border-bottom: 1.5px dashed var(--line);
  }
  .link.is-active {
    text-underline-offset: 5px;
  }
 
  .mobile-auth {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }
  .mobile-auth .btn {
    flex: 1;
  }
  .desktop-auth {
    display: none;
  }
 
  /* "Your trips" shrinks to just the satchel icon */
  .satchel {
    width: 46px;
    padding: 0;
    justify-content: center;
  }
  .satchel-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
 
  /* three bars → an X when open */
  .burger {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 46px;
    height: 46px;
    padding: 0 11px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    cursor: pointer;
  }
  .burger span {
    display: block;
    height: 2.5px;
    border-radius: 2px;
    background: var(--ink);
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .nav-open .burger span:nth-child(1) {
    transform: translateY(7.5px) rotate(45deg);
  }
  .nav-open .burger span:nth-child(2) {
    opacity: 0;
  }
  .nav-open .burger span:nth-child(3) {
    transform: translateY(-7.5px) rotate(-45deg);
  }
}
@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nav-open .links,
  .burger span {
    animation: none;
    transition: none;
  }
}
</style>
