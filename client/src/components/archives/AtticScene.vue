<script setup>
import { computed, ref } from "vue";
import { useOneCupboard } from "@/composables/useOneCupboard";
import DrawerSticker from "./DrawerSticker.vue";
import TentInterior from "./TentInterior.vue";

const props = defineProps({
  drawers: { type: Array, default: () => [] },
  picking: { type: Boolean, default: false },
});
const emit = defineEmits(["open", "pick"]);

const DRESSER = [0, 1, 2, 3];
const CHEST = [4, 5, 6];
const oneCupboard = useOneCupboard();
const pieces = computed(() =>
  oneCupboard.value
    ? [{ id: "dresser", slots: [...DRESSER, ...CHEST] }]
    : [
        { id: "dresser", slots: DRESSER },
        { id: "chest", slots: CHEST },
      ],
);
const STICKERS = [
  "star",
  "sun",
  "palm",
  "chili",
  "heart",
  "car",
  "bowl",
  "compass",
];
const SPOTS = ["tl", "bl", "tr", "br"];

const bySlot = computed(() => new Map(props.drawers.map((d) => [d.slot, d])));

function stickersFor(id) {
  let seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 16;
  const count = next() % 4;
  const spots = [...SPOTS].sort(() => (next() % 2 ? 1 : -1)).slice(0, count);
  return spots.map((spot) => ({
    spot,
    kind: STICKERS[next() % STICKERS.length],
  }));
}

function tagDate(trip) {
  const raw = trip.start_date
    ? `${trip.start_date}T00:00:00`
    : trip.archived_at;
  if (!raw) return "";
  return new Date(raw)
    .toLocaleString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();
}

const opening = ref(null);
function open(drawer) {
  if (opening.value != null) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (still) return emit("open", drawer.trip);
  opening.value = drawer.slot;
  setTimeout(() => {
    opening.value = null;
    emit("open", drawer.trip);
  }, 240);
}
</script>

<template>
  <div class="attic" :class="{ picking }">
    <TentInterior />

    <div class="furniture">
      <div
        v-for="piece in pieces"
        :key="piece.id"
        class="piece"
        :class="piece.id"
      >
        <div v-if="piece.id === 'dresser'" class="crown" aria-hidden="true" />
        <div v-else class="props" aria-hidden="true">
          <span class="scroll" />
          <svg class="globe" viewBox="0 0 100 100">
            <path
              d="M14 62a38 38 0 0 0 72 0"
              fill="none"
              stroke="#c48a2c"
              stroke-width="7"
              stroke-linecap="round"
            />
            <circle
              cx="50"
              cy="45"
              r="31"
              fill="#cfe0d9"
              stroke="#2a2117"
              stroke-width="4"
            />
            <path
              d="M33 30c8-6 16 2 12 10s-12 6-14 14c-4-8-6-18 2-24zM56 52c6-4 14 0 14 6s-8 12-14 8-4-10 0-14zM58 22c6 0 10 4 8 8s-8 2-10-2z"
              fill="#6f9a52"
              stroke="#2a2117"
              stroke-width="2.5"
            />
            <path
              d="M38 88h24l-4-10H42z"
              fill="#8a5a2b"
              stroke="#2a2117"
              stroke-width="3"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="ledge" aria-hidden="true" />
        <div class="body">
          <template v-for="slot in piece.slots" :key="slot">
            <template v-if="bySlot.get(slot)">
              <button
                v-if="picking"
                type="button"
                class="drawer filled pickable"
                :data-slot="slot"
                :data-trip="bySlot.get(slot).trip.id"
                @click="emit('pick', bySlot.get(slot))"
              >
                <span class="tag">
                  <span class="tag-name">{{ bySlot.get(slot).trip.name }}</span>
                  <span class="tag-date">{{
                    tagDate(bySlot.get(slot).trip)
                  }}</span>
                </span>
                <span class="handle" aria-hidden="true" />
                <span class="swap-hint" aria-hidden="true">look inside</span>
              </button>
              <a
                v-else
                :href="`/archives/${bySlot.get(slot).trip.id}`"
                class="drawer filled"
                :class="{
                  opening: opening === slot,
                  fresh: bySlot.get(slot).isNew,
                }"
                :data-slot="slot"
                :data-trip="bySlot.get(slot).trip.id"
                @click.prevent="open(bySlot.get(slot))"
              >
                <span
                  v-for="s in stickersFor(bySlot.get(slot).trip.id)"
                  :key="s.spot"
                  class="stuck"
                  :class="s.spot"
                  ><DrawerSticker :kind="s.kind"
                /></span>
                <span class="tag">
                  <span class="tag-name">{{ bySlot.get(slot).trip.name }}</span>
                  <span class="tag-date">{{
                    tagDate(bySlot.get(slot).trip)
                  }}</span>
                </span>
                <span class="handle" aria-hidden="true" />
              </a>
            </template>
            <div
              v-else
              class="drawer empty"
              :data-slot="slot"
              role="img"
              aria-label="Empty drawer"
            >
              <span class="handle" aria-hidden="true" />
            </div>
          </template>
        </div>
        <div class="base" aria-hidden="true"><span /><span /></div>
      </div>
    </div>
    <div class="floor">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.attic {
  --wood-dark: #2a1810;
  --glow: #f4dfa6;
  position: relative;
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 100%; /* everything under the nav */
  padding-top: 9%; /* keeps the furniture under the window on short screens */
  overflow: hidden;
  background: #dfbf87;
}

/* ---------- furniture ---------- */
/* Stands on the floor, sized so the whole attic fits under the nav without scrolling */
.furniture {
  --leg: clamp(16px, 2.86cqw, 34px);
  --chest-leg: clamp(8px, 1.32cqw, 14px);
  container-type: inline-size;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6%;
  width: min(
    100%,
    1180px,
    (100dvh - 72px - 64px - 9vw - 8px) * 1.74
  ); /* nav, floor, roof clearance */
  margin: auto auto 0;
  padding: 0 2%;
}
.piece {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.dresser {
  --wood: #6c2b1d;
  --face: #7d3524;
  --ledge-wood: #5a2117;
  width: 42%;
  padding-bottom: var(--leg);
}
.chest {
  --wood: #6f4325;
  --face: #a7673f;
  --ledge-wood: #5e381f;
  width: 48%;
  padding-bottom: var(--chest-leg);
}

.crown {
  position: relative;
  width: 82%;
  height: clamp(40px, 6.6cqw, 72px);
  background: var(--wood);
  border: 3px solid var(--wood-dark);
  border-bottom: 0;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
}
.crown::before {
  content: "";
  position: absolute;
  inset: 22% 14% -3px;
  border: 2px solid rgba(0, 0, 0, 0.28);
  border-bottom: 0;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
}
.props {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 92%;
  height: clamp(54px, 9.9cqw, 112px);
}
.scroll {
  width: 34%;
  height: 18%;
  min-height: 12px;
  margin-left: 4%;
  margin-bottom: 2px;
  background:
    linear-gradient(
      90deg,
      transparent 8%,
      #b4352a 8% 10%,
      transparent 10% 90%,
      #b4352a 90% 92%,
      transparent 92%
    ),
    #e8d9b5;
  border: 2px solid var(--wood-dark);
  border-radius: 999px;
}
.globe {
  width: 26%;
  height: auto;
  margin-right: 2%;
  margin-bottom: -2px;
}

.ledge {
  width: 100%;
  height: clamp(10px, 1.32cqw, 16px);
  background: var(--ledge-wood);
  border: 3px solid var(--wood-dark);
  border-radius: 3px;
}
.dresser .ledge {
  width: 104%;
}
.body {
  width: 96%;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.21cqw, 14px);
  padding: clamp(10px, 1.54cqw, 18px);
  background: var(--wood);
  border: 3px solid var(--wood-dark);
  border-top: 0;
}
.base {
  position: relative;
  width: 100%;
  height: clamp(10px, 1.54cqw, 18px);
  background: var(--ledge-wood);
  border: 3px solid var(--wood-dark);
  border-top: 0;
  border-radius: 0 0 6px 6px;
}
.base span {
  position: absolute;
  top: 100%;
  width: 9%;
  height: var(--leg);
  background: var(--wood);
  border: 3px solid var(--wood-dark);
  border-top: 0;
}
.base span:first-child {
  left: 6%;
  clip-path: polygon(0 0, 100% 0, 80% 100%, 30% 100%);
}
.base span:last-child {
  right: 6%;
  clip-path: polygon(0 0, 100% 0, 70% 100%, 20% 100%);
}
.chest .base {
  width: 98%;
  border-radius: 0;
}
.chest .base span {
  width: 7%;
  height: var(--chest-leg);
  clip-path: none;
}

.floor {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  height: 64px;
  padding: 0 16px;
  border-top: 4px solid #5d4326;
  background:
    radial-gradient(ellipse 34% 62% at 50% 0%, #b4472f 0 96%, transparent 97%),
    #56623d; /* a rug on the groundsheet */
}

/* ---------- drawers ---------- */
.drawer {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: clamp(82px, 10.34cqw, 112px);
  padding: 10px 14%;
  background: var(--face);
  border: 3px solid var(--wood-dark);
  border-radius: 4px;
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.05),
    inset 0 -7px 0 rgba(0, 0, 0, 0.16);
  color: inherit;
  text-decoration: none;
  font: inherit;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.drawer.filled {
  cursor: pointer;
}
.drawer.filled:hover,
.drawer.filled:focus-visible {
  transform: translateY(2px) scale(1.012);
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.07),
    inset 0 -7px 0 rgba(0, 0, 0, 0.16),
    0 6px 0 rgba(0, 0, 0, 0.35);
}
.drawer:focus-visible {
  outline: 3px solid var(--mustard);
  outline-offset: 3px;
}
.drawer.opening {
  z-index: 2;
  transform: translateY(10px) scale(1.06);
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.07),
    0 16px 0 rgba(0, 0, 0, 0.45);
  transition-duration: 0.22s;
}
.drawer.empty {
  filter: brightness(0.82);
}

.tag {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 100%;
  padding: 4px 14px 5px;
  background: #fbf3e1;
  border: 2px solid #d3b06b;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
  text-align: center;
}
.tag-name {
  color: var(--ink);
  font-family: var(--font-hand);
  font-weight: 700;
  font-size: clamp(17px, 2.09cqw, 24px);
  line-height: 1.05;
  overflow-wrap: anywhere;
}
.tag-date {
  margin-top: 2px;
  color: var(--ink-soft);
  font-size: clamp(9px, 0.94cqw, 11px);
  font-weight: 800;
  letter-spacing: 1.6px;
}
.fresh .tag {
  animation: pin-in 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) 0.3s both;
}

.handle {
  flex: none;
  width: clamp(34px, 5.06cqw, 58px);
  height: clamp(8px, 1.1cqw, 12px);
  border: 3px solid #c99332;
  border-top: 0;
  border-radius: 0 0 40px 40px;
}
.chest .handle {
  height: clamp(9px, 1.1cqw, 13px);
  background: #d9a245;
  border: 2px solid var(--wood-dark);
  border-radius: 2px 2px 40px 40px;
}

.stuck {
  position: absolute;
  width: clamp(26px, 3.3cqw, 38px);
  aspect-ratio: 1;
  pointer-events: none;
}
.stuck.tl {
  left: 4%;
  top: 10%;
  transform: rotate(-8deg);
}
.stuck.bl {
  left: 13%;
  bottom: 8%;
  transform: rotate(6deg);
}
.stuck.tr {
  right: 5%;
  top: 12%;
  transform: rotate(10deg);
}
.stuck.br {
  right: 5%;
  bottom: 10%;
  transform: rotate(-5deg);
}

/* ---------- swap mode ---------- */
.picking .drawer.empty {
  opacity: 0.5;
}
.pickable {
  outline: 3px dashed var(--mustard);
  outline-offset: -8px;
}
.pickable:hover,
.pickable:focus-visible {
  outline-style: solid;
}
.swap-hint {
  position: absolute;
  right: 6px;
  bottom: 4px;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--mustard);
  color: var(--ink);
  font-family: var(--font-hand);
  font-weight: 700;
  font-size: 15px;
  opacity: 0;
  transition: opacity 0.15s;
}
.pickable:hover .swap-hint,
.pickable:focus-visible .swap-hint {
  opacity: 1;
}

@keyframes pin-in {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fresh .tag {
    animation: none;
  }
  .drawer {
    transition: none;
  }
}

/* Phones: one big cupboard, roof scales down with the width. */
@media (max-width: 720px) {
  .attic {
    padding-top: 34%;
  }
  .furniture {
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 0 16px;
  }
  .dresser {
    width: 100%;
    max-width: 420px;
  }
  .crown {
    height: 48px;
  }
  .drawer {
    min-height: 84px;
    padding: 10px 16%;
  }
  .tag-name {
    font-size: 19px;
  }
  .tag-date {
    font-size: 10px;
  }
  .handle {
    width: 44px;
    height: 10px;
  }
  .stuck {
    width: 30px;
  }
  .stuck.bl {
    left: 4%;
  }
}
</style>
