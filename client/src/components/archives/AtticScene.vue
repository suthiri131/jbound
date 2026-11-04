<script setup>
/**
 * The Archives, inside a canvas tent: a mahogany dresser (drawers 0-3) and an old map chest (drawers 4-6).
 * On phones they combine into one big dresser holding all 7.
 * Filled drawers carry a name tag and open into the trip's scrapbook; empty ones stay shut.
 * In `picking` mode a filled drawer opens for a look, so the user can decide whether to swap it out.
 */
import { computed, ref } from 'vue';
import { useOneCupboard } from '@/composables/useOneCupboard';
import DrawerSticker from './DrawerSticker.vue';
import TentInterior from './TentInterior.vue';
import SoftPaint from '@/components/scene/SoftPaint.vue';

const props = defineProps({
  drawers: { type: Array, default: () => [] }, // [{ slot, trip, isNew }]
  picking: { type: Boolean, default: false },
});
const emit = defineEmits(['open', 'pick']);

const DRESSER = [0, 1, 2, 3];
const CHEST = [4, 5, 6];
const oneCupboard = useOneCupboard();
const pieces = computed(() => (oneCupboard.value
  ? [{ id: 'dresser', slots: [...DRESSER, ...CHEST] }]
  : [{ id: 'dresser', slots: DRESSER }, { id: 'chest', slots: CHEST }]));
const STICKERS = ['star', 'sun', 'palm', 'chili', 'heart', 'car', 'bowl', 'compass'];
const SPOTS = ['tl', 'bl', 'tr', 'br'];

const bySlot = computed(() => new Map(props.drawers.map((d) => [d.slot, d])));

/** A few stickers per drawer, picked from the trip id so they stay put between visits. */
function stickersFor(id) {
  let seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 16;
  const count = next() % 4;
  const spots = [...SPOTS].sort(() => (next() % 2 ? 1 : -1)).slice(0, count);
  return spots.map((spot) => ({ spot, kind: STICKERS[next() % STICKERS.length] }));
}

function tagDate(trip) {
  const raw = trip.start_date ? `${trip.start_date}T00:00:00` : trip.archived_at;
  if (!raw) return '';
  return new Date(raw).toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

const opening = ref(null);
function open(drawer) {
  if (opening.value != null) return;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (still) return emit('open', drawer.trip);
  opening.value = drawer.slot;
  setTimeout(() => {
    opening.value = null;
    emit('open', drawer.trip);
  }, 240);
}
</script>

<template>
  <div class="attic" :class="{ picking }">
    <SoftPaint />
    <TentInterior />

    <div class="furniture">
      <div v-for="piece in pieces" :key="piece.id" class="piece" :class="piece.id">
        <div v-if="piece.id === 'dresser'" class="crown" aria-hidden="true" />
        <div v-else class="props" aria-hidden="true">
          <span class="scroll" />
          <svg class="globe" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="globe-sea" cx="36%" cy="30%" r="78%">
                <stop offset="0%" stop-color="#eaf5ef" />
                <stop offset="55%" stop-color="#b4d0c6" />
                <stop offset="100%" stop-color="#6f9288" />
              </radialGradient>
              <radialGradient id="globe-land" cx="36%" cy="30%" r="80%">
                <stop offset="0%" stop-color="#8fbd6e" />
                <stop offset="100%" stop-color="#4c7538" />
              </radialGradient>
              <linearGradient id="globe-brass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#ecc877" />
                <stop offset="100%" stop-color="#8f6620" />
              </linearGradient>
              <linearGradient id="globe-wood" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#b0794a" />
                <stop offset="100%" stop-color="#5e381f" />
              </linearGradient>
            </defs>
            <g filter="url(#soft-paint-dark)">
              <ellipse cx="55" cy="93" rx="30" ry="4.5" fill="#1a0c04" opacity=".4" />
              <path d="M14 62a38 38 0 0 0 72 0" fill="none" stroke="#2a2117" stroke-width="10" stroke-linecap="round" />
              <path d="M14 62a38 38 0 0 0 72 0" fill="none" stroke="url(#globe-brass)" stroke-width="6" stroke-linecap="round" />
              <circle cx="50" cy="45" r="31" fill="url(#globe-sea)" stroke="#2a2117" stroke-width="3.5" />
              <path d="M33 30c8-6 16 2 12 10s-12 6-14 14c-4-8-6-18 2-24zM56 52c6-4 14 0 14 6s-8 12-14 8-4-10 0-14zM58 22c6 0 10 4 8 8s-8 2-10-2z" fill="url(#globe-land)" stroke="#2a2117" stroke-width="2.2" />
              <ellipse cx="39" cy="28" rx="9" ry="5" transform="rotate(-28 39 28)" fill="#fff" opacity=".55" />
              <path d="M38 88h24l-4-10H42z" fill="url(#globe-wood)" stroke="#2a2117" stroke-width="3" stroke-linejoin="round" />
            </g>
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
                  <span class="tag-date">{{ tagDate(bySlot.get(slot).trip) }}</span>
                </span>
                <span class="handle" aria-hidden="true" />
                <span class="swap-hint" aria-hidden="true">look inside</span>
              </button>
              <a
                v-else
                :href="`/archives/${bySlot.get(slot).trip.id}`"
                class="drawer filled"
                :class="{ opening: opening === slot, fresh: bySlot.get(slot).isNew }"
                :data-slot="slot"
                :data-trip="bySlot.get(slot).trip.id"
                @click.prevent="open(bySlot.get(slot))"
              >
                <span v-for="s in stickersFor(bySlot.get(slot).trip.id)" :key="s.spot" class="stuck" :class="s.spot"><DrawerSticker :kind="s.kind" /></span>
                <span class="tag">
                  <span class="tag-name">{{ bySlot.get(slot).trip.name }}</span>
                  <span class="tag-date">{{ tagDate(bySlot.get(slot).trip) }}</span>
                </span>
                <span class="handle" aria-hidden="true" />
              </a>
            </template>
            <div v-else class="drawer empty" :data-slot="slot" role="img" aria-label="Empty drawer">
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
  position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: center; gap: 6%;
  width: min(100%, 1180px, (100dvh - 72px - 64px - 9vw - 8px) * 1.74); /* nav, floor, roof clearance */ margin: auto auto 0; padding: 0 2%;
}
.piece { display: flex; flex-direction: column; align-items: center; }
.dresser { --wood: #6c2b1d; --wood-light: #8d4630; --wood-deep: #4a1a10; --face: #7d3524; --face-light: #9a4a35; --ledge-wood: #5a2117; width: 42%; padding-bottom: var(--leg); }
.chest { --wood: #6f4325; --wood-light: #8f5c36; --wood-deep: #4c2c16; --face: #a7673f; --face-light: #c28459; --ledge-wood: #5e381f; width: 48%; padding-bottom: var(--chest-leg); }

/* Light comes from the lantern above and to the left: top and left edges catch it, bottom and right fall into shade.
   Solid wood is painted directly; anything holding a label is painted on a layer behind it, so the text stays crisp. */
.crown {
  position: relative; width: 82%; height: clamp(40px, 6.6cqw, 72px);
  background: linear-gradient(var(--wood-light), var(--wood) 70%); border: 3px solid var(--wood-dark); border-bottom: 0;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  filter: url(#soft-paint-dark);
}
.crown::before {
  content: ''; position: absolute; inset: 22% 14% -3px; border: 2px solid rgba(0, 0, 0, .28); border-bottom: 0;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
}
.props { position: relative; display: flex; align-items: flex-end; justify-content: space-between; width: 92%; height: clamp(54px, 9.9cqw, 112px); }
/* a rolled-up map: paper curving away top and bottom, tied with red ribbon, one rolled end showing */
.scroll {
  position: relative;
  width: 34%; height: 20%; min-height: 15px; margin-left: 4%; margin-bottom: 1px;
  background:
    linear-gradient(90deg, transparent 12%, rgba(120, 24, 16, .9) 12% 15%, transparent 15% 85%, rgba(120, 24, 16, .9) 85% 88%, transparent 88%),
    linear-gradient(#cdb98d, #fbf1d8 28%, #e8d9b5 58%, #a48d60);
  border: 2px solid var(--wood-dark); border-radius: 999px;
  box-shadow: 2px 4px 4px rgba(20, 10, 4, .45);
  filter: url(#soft-paint-dark);
}
.scroll::after {
  content: ''; position: absolute; top: 12%; bottom: 12%; right: 1.5%; aspect-ratio: 1;
  border: 2px solid #8f7a4e; border-radius: 50%;
  background: radial-gradient(circle, #6d5833 0 20%, #efe1bd 22%);
}
.globe { width: 26%; height: auto; margin-right: 2%; margin-bottom: -2px; }

.ledge {
  position: relative; z-index: 1; width: 100%; height: clamp(10px, 1.32cqw, 16px);
  background: linear-gradient(var(--wood-light), var(--ledge-wood) 55%); border: 3px solid var(--wood-dark); border-radius: 3px;
  box-shadow: 0 4px 5px rgba(20, 10, 4, .45);
  filter: url(#soft-paint-dark);
}
.dresser .ledge { width: 104%; }
.body {
  position: relative; isolation: isolate;
  width: 96%; display: flex; flex-direction: column; gap: clamp(8px, 1.21cqw, 14px);
  padding: clamp(10px, 1.54cqw, 18px); border: 3px solid transparent; border-top: 0;
}
/* the carcass: drawers sit recessed in it, and the whole piece throws a shadow on the canvas */
.body::before {
  content: ''; position: absolute; z-index: -1; inset: 0 -3px -3px;
  background: var(--wood); border: 3px solid var(--wood-dark); border-top: 0;
  box-shadow:
    inset 5px 0 0 var(--wood-light),
    inset -7px 0 0 var(--wood-deep),
    inset 0 12px 10px -7px rgba(0, 0, 0, .5),
    10px 6px 16px rgba(50, 30, 10, .4);
  filter: url(#soft-paint-dark);
}
.base { position: relative; z-index: 1; width: 100%; height: clamp(10px, 1.54cqw, 18px); }
.base::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(var(--ledge-wood), var(--wood-deep)); border: 3px solid var(--wood-dark); border-top: 0; border-radius: 0 0 6px 6px;
  filter: url(#soft-paint-dark);
}
.base span {
  position: absolute; top: 100%; width: 9%; height: var(--leg);
  background: linear-gradient(90deg, var(--wood-light) 0 22%, var(--wood) 22% 62%, var(--wood-deep) 62%); border: 3px solid var(--wood-dark); border-top: 0;
}
.base span:first-child { left: 6%; clip-path: polygon(0 0, 100% 0, 80% 100%, 30% 100%); }
.base span:last-child { right: 6%; clip-path: polygon(0 0, 100% 0, 70% 100%, 20% 100%); }
.chest .base { width: 98%; }
.chest .base::before { border-radius: 0; }
.chest .base span { width: 7%; height: var(--chest-leg); clip-path: none; }

.floor {
  position: relative; z-index: 1; display: grid; place-items: center; height: 64px; padding: 0 16px;
  border-top: 4px solid #5d4326;
}
/* a rug on the groundsheet, darker where the furniture shades it and further back */
.floor::before {
  content: ''; position: absolute; z-index: -1; inset: -4px 0 0;
  background:
    linear-gradient(rgba(20, 15, 5, .42), transparent 34%),
    radial-gradient(ellipse 34% 62% at 50% 0%, #b4472f 0 96%, transparent 97%),
    #56623d;
  filter: url(#soft-paint-dark);
}

/* ---------- drawers ---------- */
.drawer {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  width: 100%; min-height: clamp(82px, 10.34cqw, 112px); padding: 10px 14%;
  isolation: isolate; border: 3px solid transparent; border-radius: 4px;
  box-shadow: 0 3px 4px rgba(20, 10, 4, .5);
  color: inherit; text-decoration: none; font: inherit;
  transition: transform .18s ease, box-shadow .18s ease;
}
/* the drawer front: a raised panel, with a faint grain running along it */
.drawer::before {
  content: ''; position: absolute; z-index: -1; inset: -3px;
  background:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, .045) 0 2px, transparent 2px 7px),
    linear-gradient(var(--face-light), var(--face) 26%);
  border: 3px solid var(--wood-dark); border-radius: 4px;
  box-shadow:
    inset 3px 0 0 rgba(255, 240, 215, .14),
    inset -4px 0 0 rgba(0, 0, 0, .16),
    inset 0 -7px 0 rgba(0, 0, 0, .24);
  filter: url(#soft-paint-dark);
}
.drawer.filled { cursor: pointer; }
.drawer.filled:hover, .drawer.filled:focus-visible {
  transform: translateY(2px) scale(1.012);
  box-shadow: 0 7px 8px rgba(20, 10, 4, .55);
}
.drawer:focus-visible { outline: 3px solid var(--mustard); outline-offset: 3px; }
.drawer.opening {
  z-index: 2; transform: translateY(10px) scale(1.06);
  box-shadow: 0 16px 14px rgba(20, 10, 4, .55);
  transition-duration: .22s;
}
.drawer.empty { filter: brightness(.82); }

.tag {
  display: flex; flex-direction: column; align-items: center; max-width: 100%; padding: 4px 14px 5px;
  background: #fbf3e1; border: 2px solid #d3b06b; box-shadow: 2px 4px 5px rgba(0, 0, 0, .4); text-align: center;
}
.tag-name { color: var(--ink); font-family: var(--font-hand); font-weight: 700; font-size: clamp(17px, 2.09cqw, 24px); line-height: 1.05; overflow-wrap: anywhere; }
.tag-date { margin-top: 2px; color: var(--ink-soft); font-size: clamp(9px, 0.94cqw, 11px); font-weight: 800; letter-spacing: 1.6px; }
.fresh .tag { animation: pin-in .6s cubic-bezier(.3, 1.6, .5, 1) .3s both; }

.handle { flex: none; width: clamp(34px, 5.06cqw, 58px); height: clamp(8px, 1.1cqw, 12px); border: 3px solid #d8a544; border-top: 0; border-radius: 0 0 40px 40px; filter: drop-shadow(1px 3px 1px rgba(0, 0, 0, .5)); }
.chest .handle { height: clamp(9px, 1.1cqw, 13px); background: linear-gradient(#efc56c, #b98227); border: 2px solid var(--wood-dark); border-radius: 2px 2px 40px 40px; }

.stuck { position: absolute; width: clamp(26px, 3.3cqw, 38px); aspect-ratio: 1; pointer-events: none; }
.stuck.tl { left: 4%; top: 10%; transform: rotate(-8deg); }
.stuck.bl { left: 13%; bottom: 8%; transform: rotate(6deg); }
.stuck.tr { right: 5%; top: 12%; transform: rotate(10deg); }
.stuck.br { right: 5%; bottom: 10%; transform: rotate(-5deg); }

/* ---------- swap mode ---------- */
.picking .drawer.empty { opacity: .5; }
.pickable { outline: 3px dashed var(--mustard); outline-offset: -8px; }
.pickable:hover, .pickable:focus-visible { outline-style: solid; }
.swap-hint {
  position: absolute; right: 6px; bottom: 4px; padding: 1px 7px; border-radius: 4px; background: var(--mustard); color: var(--ink);
  font-family: var(--font-hand); font-weight: 700; font-size: 15px; opacity: 0; transition: opacity .15s;
}
.pickable:hover .swap-hint, .pickable:focus-visible .swap-hint { opacity: 1; }

@keyframes pin-in { from { opacity: 0; transform: scale(.5) rotate(-8deg); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .fresh .tag { animation: none; }
  .drawer { transition: none; }
}

/* Phones: one big cupboard, roof scales down with the width. */
@media (max-width: 720px) {
  .attic { padding-top: 34%; }
  .furniture { flex-direction: column; align-items: center; width: 100%; padding: 0 16px; }
  .dresser { width: 100%; max-width: 420px; }
  .crown { height: 48px; }
  .drawer { min-height: 84px; padding: 10px 16%; }
  .tag-name { font-size: 19px; }
  .tag-date { font-size: 10px; }
  .handle { width: 44px; height: 10px; }
  .stuck { width: 30px; }
  .stuck.bl { left: 4%; }
}
</style>
