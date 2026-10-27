<script setup>
// CHANGES FOR EXPLORER: new component
/**
 * Explorer intro: two doors swing open onto a cork bulletin board of vibe flyers.
 * Tap flyers to add them to your vibe, then "Let's Explore!" → flyers poof away → emits `explore`.
 *
 * Props:  name        first name for the greeting ('' → "explorer")
 *         initial     vibe ids picked last time (when coming back via "Change my vibe")
 *         skipDoors   true when coming back, so the doors don't play again
 * Emits:  explore(vibeIds)   [] means "show me everything"
 */
import { ref, onMounted } from "vue";
import { VIBES, VIBE_TINT, VIBE_FLYER } from "@/utils/constants";
import VibeIcon from "@/components/common/VibeIcon.vue";

const props = defineProps({
  name: { type: String, default: "" },
  initial: { type: Array, default: () => [] },
  skipDoors: { type: Boolean, default: false },
});
const emit = defineEmits(["explore"]);

const picked = ref([...props.initial]);
const doorsOpen = ref(props.skipDoors);
const doorsGone = ref(props.skipDoors);
const poofing = ref(false);

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

onMounted(() => {
  if (props.skipDoors) return;
  if (reducedMotion()) {
    doorsOpen.value = doorsGone.value = true;
    return;
  }
  // short pause so people see the closed doors, then swing them open
  setTimeout(() => (doorsOpen.value = true), 350);
  setTimeout(() => (doorsGone.value = true), 1500);
});

function toggle(id) {
  const i = picked.value.indexOf(id);
  i === -1 ? picked.value.push(id) : picked.value.splice(i, 1);
}

function explore(vibes = picked.value) {
  if (poofing.value) return;
  if (reducedMotion()) return emit("explore", [...vibes]);
  poofing.value = true;
  setTimeout(() => emit("explore", [...vibes]), 650);
}

// a slightly different tilt per flyer so the board looks hand-pinned
const TILTS = [-3, 2, -1.5, 3, -2.5, 1.5, -1];
</script>

<template>
  <section class="board-wrap" :class="{ poofing }" aria-label="Pick your vibe">
    <div class="board">
      <!-- greeting, pinned like a paper strip -->
      <header class="greeting">
        <span class="pin" aria-hidden="true" />
        <h1 class="display display-lg">
          What's the vibe today, {{ name || "explorer" }}?
        </h1>
        <p class="hand">
          Tap the flyers you're feeling. Pick as many as you like.
        </p>
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

      <!-- poof cloud -->
      <div v-if="poofing" class="puffs" aria-hidden="true">
        <i v-for="n in 7" :key="n" :style="{ '--n': n }" />
      </div>
    </div>

    <!-- the doors (drawn on top, swing open on load) -->
    <div
      v-if="!doorsGone"
      class="doors"
      :class="{ open: doorsOpen }"
      aria-hidden="true"
    >
      <div class="door left"><span class="knob" /></div>
      <div class="door right"><span class="knob" /></div>
    </div>
  </section>
</template>

<style scoped>
.board-wrap {
  position: relative;
  perspective: 1600px;
}

/* cork board in a wooden frame */
.board {
  position: relative;
  overflow: hidden;
  padding: 34px 28px 26px;
  border: 14px solid #6b4a2b;
  border-radius: 18px;
  box-shadow:
    inset 0 0 0 2px var(--ink),
    0 0 0 2px var(--ink),
    8px 8px 0 var(--ink);
  background-color: #c99a66;
  background-image:
    radial-gradient(rgba(90, 60, 30, 0.35) 1px, transparent 1.5px),
    radial-gradient(rgba(255, 240, 210, 0.25) 1px, transparent 1.5px);
  background-size:
    14px 14px,
    22px 22px;
  background-position:
    0 0,
    7px 11px;
}

.greeting {
  position: relative;
  max-width: 620px;
  margin: 0 auto;
  padding: 18px 22px 14px;
  text-align: center;
  background: var(--card);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-sm);
  transform: rotate(-1deg);
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
  margin: 30px 0 0;
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
}
.flyers li:has(.flyer[aria-pressed="true"]) {
  transform: rotate(0deg) translateY(-4px);
}
.flyer {
  position: relative;
  width: 100%;
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
  margin-top: 28px;
  padding: 14px 18px;
  background: var(--card);
  border: 2px solid var(--ink);
  border-radius: 10px;
}
.picked-count {
  margin: 0;
}
.explore-btn {
  min-height: 52px;
  padding: 0 26px;
  font-size: 18px;
}

/* doors */
.doors {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 2;
  pointer-events: none;
}
.door {
  flex: 1;
  border: 2px solid var(--ink);
  background-color: #8a5a2b;
  background-image: repeating-linear-gradient(
    90deg,
    rgba(42, 33, 23, 0.25) 0 2px,
    transparent 2px 46px
  );
  transition: transform 1s cubic-bezier(0.5, 0, 0.2, 1);
  position: relative;
}
.door.left {
  border-radius: 18px 0 0 18px;
  transform-origin: left center;
}
.door.right {
  border-radius: 0 18px 18px 0;
  transform-origin: right center;
}
.doors.open .door.left {
  transform: rotateY(-105deg);
}
.doors.open .door.right {
  transform: rotateY(105deg);
}
.knob {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--mustard);
  border: 2px solid var(--ink);
}
.left .knob {
  right: 18px;
}
.right .knob {
  left: 18px;
}

/* poof: flyers puff away, then the feed takes over */
.poofing .flyers li {
  animation: poof 0.5s ease-in forwards;
  animation-delay: calc(var(--i) * 30ms);
}
.poofing .greeting,
.poofing .board-foot {
  transition: opacity 0.4s;
  opacity: 0;
}
@keyframes poof {
  to {
    transform: scale(0.2) rotate(20deg);
    opacity: 0;
    filter: blur(4px);
  }
}
.puffs {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.puffs i {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--card);
  border: 2px solid var(--ink);
  transform: translate(-50%, -50%) rotate(calc(var(--n) * 51deg)) translateX(0)
    scale(0.2);
  animation: puff 0.65s ease-out forwards;
}
@keyframes puff {
  60% {
    opacity: 1;
  }
  to {
    transform: translate(-50%, -50%) rotate(calc(var(--n) * 51deg))
      translateX(160px) scale(1.3);
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .board {
    padding: 28px 14px 18px;
    border-width: 10px;
  }
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
  .door,
  .stamp {
    transition: none;
    animation: none;
  }
}
</style>
