<script setup>
import { ref } from "vue";
import { VIBES, VIBE_TINT, VIBE_FLYER } from "@/utils/constants";
import VibeIcon from "@/components/common/VibeIcon.vue";

const props = defineProps({
  name: { type: String, default: "" },
  initial: { type: Array, default: () => [] },
});
const emit = defineEmits(["explore"]);

const picked = ref([...props.initial]);
const leaving = ref(false);

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function toggle(id) {
  const i = picked.value.indexOf(id);
  i === -1 ? picked.value.push(id) : picked.value.splice(i, 1);
}

function explore(vibes = picked.value) {
  if (leaving.value) return;
  if (reducedMotion()) return emit("explore", [...vibes]);
  leaving.value = true;
  setTimeout(() => emit("explore", [...vibes]), 650);
}

// a slightly different tilt per flyer so the board looks hand-pinned
const TILTS = [-3, 2, -1.5, 3, -2.5, 1.5, -1];
</script>

<template>
  <section class="picker" :class="{ leaving }" aria-label="Pick your vibe">
    <!-- greeting, pinned like a paper strip -->
    <header class="greeting">
      <span class="pin" aria-hidden="true" />
      <h2 class="display display-lg">
        What's the vibe today, {{ name || "explorer" }}?
      </h2>
    </header>

    <ul class="flyers" role="group" aria-label="Vibes">
      <li
        v-for="(v, i) in VIBES"
        :key="v.id"
        :style="{ '--tilt': `${TILTS[i % TILTS.length]}deg`, '--i': i }"
      >
        <button
          type="button"
          class="flyer"
          :style="{ background: VIBE_TINT[v.id] }"
          :aria-pressed="picked.includes(v.id)"
          :data-cy="`flyer-${v.id}`"
          @click="toggle(v.id)"
        >
          <span class="tack" aria-hidden="true" />
          <VibeIcon :vibe="v.id" :size="34" :stroke-width="1.8" />
          <span class="flyer-title">{{ v.label }}</span>
          <span class="flyer-sub">{{ VIBE_FLYER[v.id] }}</span>
          <!-- tear-off tabs at the bottom, like a real flyer -->
          <span class="tabs" aria-hidden="true"
            ><i v-for="n in 5" :key="n"
          /></span>
          <span v-if="picked.includes(v.id)" class="stamp" aria-hidden="true"
            >In my vibe ✓</span
          >
        </button>
      </li>
    </ul>

    <footer class="board-foot">
      <p class="hand picked-count" aria-live="polite">
        {{
          picked.length
            ? `${picked.length} flyer${picked.length === 1 ? "" : "s"} in your vibe`
            : "Nothing picked yet"
        }}
      </p>
      <div class="row" style="gap: 10px">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          data-cy="explore-all"
          @click="explore([])"
        >
          Just show me everything
        </button>
        <button
          type="button"
          class="btn btn-ember explore-btn"
          :disabled="!picked.length"
          data-cy="lets-explore"
          @click="explore()"
        >
          Let's Explore!
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.picker {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-body);
}

.greeting {
  position: relative;
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
  padding: 18px 22px 14px;
  text-align: center;
  background: var(--card);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-sm);
  transform: rotate(-1deg);
  animation: note-in 0.4s ease-out backwards;
}
.greeting .hand {
  margin: 6px 0 0;
  color: var(--ink-soft);
}
.pin {
  position: absolute;
  top: -9px;
  left: 50%;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  border-radius: 50%;
  background: var(--ember);
  border: 2px solid var(--ink);
}

/* flyers */
.flyers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 22px 18px;
}
.flyers li {
  flex: 0 1 190px;
  transform: rotate(var(--tilt));
  transition: transform 0.25s ease;
  animation: pin-up 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
  animation-delay: calc(var(--i) * 45ms);
}
.flyers li:has(.flyer[aria-pressed="true"]) {
  transform: rotate(0deg) translateY(-4px);
}
.flyer {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 22px 12px 46px; /* room for the tabs + stamp */
  border: 2px solid var(--ink);
  border-radius: 4px;
  box-shadow: 4px 4px 0 rgba(42, 33, 23, 0.55);
  color: var(--ink);
  font: inherit;
  text-align: center;
  cursor: pointer;
  transition:
    box-shadow 0.2s,
    outline-color 0.2s;
  outline: 3px solid transparent;
  outline-offset: 3px;
}
.flyer:hover {
  box-shadow: 6px 6px 0 rgba(42, 33, 23, 0.6);
}
.flyer[aria-pressed="true"] {
  outline-color: var(--ink);
  box-shadow: 6px 6px 0 var(--ink);
}
.flyer:focus-visible {
  outline-color: var(--mustard);
}
.tack {
  position: absolute;
  top: -8px;
  left: 50%;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  border-radius: 50%;
  background: var(--mustard);
  border: 2px solid var(--ink);
}
.flyer-title {
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.1;
}
.flyer-sub {
  font-size: 13px;
  line-height: 1.35;
  color: var(--ink-soft);
}
.tabs {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 6px;
  display: flex;
  justify-content: space-between;
}
.tabs i {
  width: 12%;
  height: 18px;
  border-left: 1.5px dashed rgba(42, 33, 23, 0.45);
}
.tabs i:first-child {
  border-left: 0;
}
.stamp {
  position: absolute;
  bottom: 8px;
  right: -10px; /* sits over the tear-off tabs, so it never hides the title */
  padding: 3px 8px;
  border: 2.5px solid var(--ember);
  border-radius: 6px;
  color: var(--ember);
  background: rgba(251, 246, 233, 0.85);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
  transform: rotate(12deg);
  animation: stamp 0.25s ease-out;
}
@keyframes stamp {
  from {
    transform: rotate(12deg) scale(1.8);
    opacity: 0;
  }
}

.board-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  background: var(--card);
  border: 2px solid var(--ink);
  border-radius: 10px;
  animation: note-in 0.4s ease-out backwards;
}
.picked-count {
  margin: 0;
}
.explore-btn {
  min-height: 52px;
  padding: 0 26px;
  font-size: 18px;
}

/* arriving: each flyer is pressed onto the cork */
@keyframes pin-up {
  from {
    opacity: 0;
    translate: 0 -18px;
    scale: 1.1;
  }
}
@keyframes note-in {
  from {
    opacity: 0;
  }
}

/* leaving: the pins come out and the flyers flutter off the bottom of the board */
.leaving {
  pointer-events: none;
}
.leaving .flyers li {
  animation: unpin 0.55s cubic-bezier(0.5, 0, 0.9, 0.6) forwards;
  animation-delay: calc(var(--i) * 30ms);
}
.leaving .greeting,
.leaving .board-foot {
  transition: opacity 0.35s;
  opacity: 0;
  animation: none;
}
@keyframes unpin {
  to {
    translate: calc((var(--i) - 3) * 14px) 420px;
    rotate: calc(var(--tilt) * 7);
    opacity: 0;
  }
}

/* a wide but short window: every flyer on one row, so the whole screen fits without scrolling */
@media (min-width: 1100px) and (max-height: 880px) {
  .picker {
    gap: 20px;
  }
  .greeting {
    max-width: 760px;
    padding: 14px 20px 10px;
  }
  .greeting .display-lg {
    font-size: 30px;
  }
  .flyers {
    flex-wrap: nowrap;
    gap: 14px;
  }
  .flyers li {
    flex: 1 1 0;
    min-width: 0;
  }
  .flyer {
    min-height: 150px;
    padding: 18px 8px 34px;
  }
  .flyer-title {
    font-size: 17px;
  }
  .flyer-sub {
    font-size: 12px;
  }
  .board-foot {
    padding: 8px 16px;
  }
  .explore-btn {
    min-height: 44px;
  }
}
@media (max-width: 640px) {
  .flyers {
    gap: 18px 12px;
  }
  .flyers li {
    flex-basis: calc(50% - 6px);
  }
  .flyer {
    min-height: 150px;
    padding: 20px 8px 44px;
  }
  .flyer-title {
    font-size: 17px;
  }
  .board-foot {
    justify-content: center;
    text-align: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .flyers li,
  .greeting,
  .board-foot,
  .stamp {
    transition: none;
    animation: none;
  }
}
</style>
