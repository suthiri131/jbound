<script setup>
import NavAuth from '@/components/auth/NavAuth.vue';

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
});
</script>

<template>
  <div class="trip-page">
    <header class="trip-header">
      <RouterLink to="/" class="brand"><img src="/favicon.svg" alt="" width="32" height="32" /><span>jbound</span></RouterLink>
      <nav aria-label="Trip planning">
        <RouterLink to="/">Basecamp</RouterLink>
        <RouterLink :to="{ name: 'my-trips' }" :class="{ active: $route.path.startsWith('/trips') }">Planner</RouterLink>
        
      </nav>
      <NavAuth />
    </header>
    <main class="trip-content">
      <slot name="heading">
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </slot>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.trip-page { min-height: 100vh; }
.trip-header, .trip-content { width: min(100% - 32px, 1080px); margin-inline: auto; }
.trip-header { display: flex; align-items: center; flex-wrap: wrap; gap: 20px; padding-block: 20px; border-bottom: 1px solid var(--ink); }
.brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 26px; text-decoration: none; color: var(--ink); }
nav a { color: var(--ink); text-decoration: none; font-weight: 700; }
nav a.active { color: var(--ember); text-decoration: underline wavy; text-underline-offset: 6px; }
nav { display: flex; flex-wrap: wrap; gap: 16px; flex: 1; }
.trip-content { padding-block: 40px; }
h1 { font-size: 32px; }
</style>
