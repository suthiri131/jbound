<script setup>
import { RouterLink } from 'vue-router';

defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});

const perks = [
  { n: '01', title: 'Plan together', text: 'One shared itinerary your whole crew can edit.' },
  { n: '02', title: 'Beat the queue', text: 'Check the Woodlands and Tuas crossings before you leave.' },
  { n: '03', title: 'Split it fairly', text: 'Keep the group tab in S$ and RM, settled up at the end.' },
];
</script>

<template>
  <div class="auth-page">
    <header class="auth-top container">
      <RouterLink to="/" class="auth-logo" aria-label="JBound home">
        <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="15" fill="#2E5A3C" />
          <path d="M17 5 21 17 17 29 13 17Z" fill="#F3EAD3" />
          <path d="M17 5 21 17H13Z" fill="#C2502A" />
        </svg>
        <span class="display">jbound</span>
      </RouterLink>
    </header>

    <main class="auth-grid container">
      <!-- Form first in the DOM: it comes first on phones; CSS moves it to the right on desktop. -->
      <section class="auth-form" aria-labelledby="auth-title">
        <p class="eyebrow accent">{{ eyebrow }}</p>
        <h1 id="auth-title" class="display display-lg">{{ title }}</h1>
        <p v-if="subtitle" class="muted auth-sub">{{ subtitle }}</p>
        <slot />
      </section>

      <aside class="auth-pitch" aria-label="Why JBound">
        <span class="tag-stamp">Singapore → Johor Bahru</span>
        <h2 class="display display-lg">Good trips start <span class="accent">together.</span></h2>
        <p class="lead">Bring your people, plans and little travel details into one place.</p>
        <ol class="perks">
          <li v-for="perk in perks" :key="perk.n">
            <span class="perk-n display" aria-hidden="true">{{ perk.n }}</span>
            <div>
              <h3>{{ perk.title }}</h3>
              <p>{{ perk.text }}</p>
            </div>
          </li>
        </ol>
        <p class="hand accent">Same friends. New adventures.</p>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; background: var(--paper); }
.auth-top { padding-block: 16px; }
.auth-logo { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.auth-logo .display { font-size: 28px; }

.auth-grid { display: grid; gap: 40px; padding-block: 12px 72px; }
.auth-form { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.auth-form .display { margin-top: 2px; }
.auth-sub { margin: 0 0 8px; font-size: 15px; }

.auth-pitch { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding-top: 8px; border-top: 2px dashed var(--line-strong); }
.auth-pitch .tag-stamp { margin-top: 24px; }
.auth-pitch .display { margin-top: 4px; }
.auth-pitch .lead { margin-top: 0; }
.auth-pitch .hand { margin: 8px 0 0; }

.perks { width: 100%; margin: 6px 0 0; padding: 0; list-style: none; border-top: 2px solid var(--ink); }
.perks li { display: grid; grid-template-columns: 44px 1fr; align-items: start; gap: 12px; padding-block: 16px; border-bottom: 1px solid var(--line); }
.perk-n { color: var(--ember); font-size: 14px; padding-top: 3px; }
.perks h3 { margin: 0 0 4px; font-size: 16px; }
.perks p { margin: 0; color: var(--ink-soft); font-size: 14px; }

@media (min-width: 960px) {
  .auth-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
    grid-template-areas: 'pitch form';
    align-items: start;
    gap: 72px;
    padding-top: 36px;
  }
  .auth-form { grid-area: form; }
  .auth-pitch { grid-area: pitch; border-top: 0; padding-top: 0; padding-right: 8px; }
  .auth-pitch .tag-stamp { margin-top: 0; }
}
</style>