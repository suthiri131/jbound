<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import BasecampView from '@/views/BasecampView.vue';

defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});

// The live 3D basecamp fills the page; the form floats on top of it (right side on desktop, a bottom sheet on
// phones). The camp slides over by half the card so it sits centred in the space that's left.
const card = ref(null);
const shift = reactive({ x: 0, y: 0 });
const WIDE = '(min-width: 861px)';

function measure() {
  const el = card.value;
  if (!el) return;
  const wide = window.matchMedia(WIDE).matches;
  shift.x = wide ? Math.round((el.offsetWidth + 32) / 2) : 0;
  shift.y = wide ? 0 : Math.round(el.offsetHeight / 2);
}

let ro;
onMounted(() => {
  measure();
  ro = new ResizeObserver(measure);
  ro.observe(card.value);
  window.addEventListener('resize', measure);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  window.removeEventListener('resize', measure);
});

// Tapping a place that needs an account (Trips, Tales, Ledger, Archives) lands you on the form instead.
const hint = ref('');
const nudge = ref(false);
function onLocked(station) {
  hint.value = `${station.name} is for signed-in campers. Sign in or make an account to go in.`;
  nudge.value = false;
  requestAnimationFrame(() => (nudge.value = true));
  card.value?.querySelector('input')?.focus({ preventScroll: true });
}
</script>

<template>
  <div class="auth-page">
    <BasecampView preview class="auth-camp" :view-shift="shift" @locked="onLocked" />

    <RouterLink to="/" class="auth-logo" aria-label="JBound home">
      <svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="15" fill="#2E5A3C" />
        <path d="M17 5 21 17 17 29 13 17Z" fill="#F3EAD3" />
        <path d="M17 5 21 17H13Z" fill="#C2502A" />
      </svg>
      <span class="display">jbound</span>
    </RouterLink>

    <section
      ref="card"
      class="auth-card"
      :class="{ nudge }"
      aria-labelledby="auth-title"
      @animationend="nudge = false"
    >
      <span class="grabber" aria-hidden="true" />
      <p class="eyebrow accent">{{ eyebrow }}</p>
      <h1 id="auth-title" class="display">{{ title }}</h1>
      <p v-if="subtitle" class="muted auth-sub">{{ subtitle }}</p>
      <p v-if="hint" class="auth-hint" role="status">{{ hint }}</p>
      <slot />
      <p class="hand accent tagline">Same friends. New adventures.</p>
    </section>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--paper);
}
.auth-camp {
  position: absolute;
  inset: 0;
  min-height: 0;
}

/* logo pill, top-left over the camp */
.auth-logo {
  position: absolute;
  z-index: 5;
  top: 16px;
  left: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 8px;
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  background: var(--card);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  color: var(--ink);
  text-decoration: none;
}
.auth-logo .display {
  font-size: 22px;
  line-height: 1;
}

/* the sign-in card: a small panel floating on the right */
.auth-card {
  position: absolute;
  z-index: 5;
  top: 50%;
  right: 24px;
  translate: 0 -50%;
  width: min(380px, calc(100% - 48px));
  max-height: calc(100% - 140px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 22px 16px;
  border: 2.5px solid var(--ink);
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.auth-card h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.05;
}
.auth-card .eyebrow {
  margin: 0;
}
.auth-sub {
  margin: 0 0 6px;
  font-size: 14px;
}
.auth-hint {
  margin: 0 0 4px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--sand);
  border: 2px solid var(--mustard);
  font-size: 14px;
  font-weight: 600;
}
.tagline {
  margin: 4px 0 0;
  font-size: 20px;
  text-align: center;
}
.grabber {
  display: none;
}

/* the form inside already brings its own card styling: flatten it, the panel is the card now */
.auth-card :deep(form.card) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

/* a little bump when you tap a locked place, so your eye lands here */
.auth-card.nudge {
  animation: nudge 0.45s ease-out;
}
@keyframes nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-8px);
  }
  60% {
    transform: translateX(5px);
  }
}

/* phones and small tablets: a bottom sheet, the camp above it */
@media (max-width: 860px) {
  .auth-card {
    top: auto;
    right: 0;
    left: 0;
    bottom: 0;
    translate: none;
    width: auto;
    max-height: 66dvh;
    padding: 10px 18px calc(14px + env(safe-area-inset-bottom));
    border-width: 2.5px 0 0;
    border-radius: 22px 22px 0 0;
    box-shadow: 0 -4px 0 rgba(0, 0, 0, 0.18);
  }
  .grabber {
    display: block;
    align-self: center;
    width: 44px;
    height: 5px;
    margin-bottom: 6px;
    border-radius: 999px;
    background: var(--line-strong);
  }
  .auth-card h1 {
    font-size: 28px;
  }
  .tagline {
    display: none;
  }
  .auth-logo {
    top: 12px;
    left: 12px;
  }
  .auth-logo .display {
    font-size: 19px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-card.nudge {
    animation: none;
  }
}
</style>