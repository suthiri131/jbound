<script setup>
/**
 * The big illustrated map of Johor Bahru behind Tales. Every tale tagged to a place gets a pin at its real lat/lng;
 * the newest few also get a polaroid hung around the edge of the map on a string, so they never pile up on
 * each other in the city centre. The coastline and roads are a sketch, not survey-accurate.
 */
import { computed } from 'vue';

const props = defineProps({
  pins: { type: Array, default: () => [] }, // [{ id, lat, lng, label, tint, photo }]
  selected: { type: String, default: null },
});
const emit = defineEmits(['select']);

const BOUNDS = { west: 103.6, east: 103.92, north: 1.585, south: 1.405 };
const x = (lng) => ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
const y = (lat) => ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
const inside = (p) => p.lat <= BOUNDS.north && p.lat >= BOUNDS.south && p.lng >= BOUNDS.west && p.lng <= BOUNDS.east;
const path = (pts) => pts.map(([lng, lat], i) => `${i ? 'L' : 'M'}${x(lng).toFixed(2)} ${y(lat).toFixed(2)}`).join(' ');

// Johor's southern shore and Singapore's northern shore, west to east
const JB_COAST = [[103.6, 1.425], [103.64, 1.418], [103.68, 1.438], [103.72, 1.462], [103.76, 1.468], [103.8, 1.476], [103.84, 1.468], [103.88, 1.46], [103.92, 1.456]];
const SG_COAST = [[103.66, 1.405], [103.69, 1.418], [103.72, 1.436], [103.75, 1.447], [103.79, 1.448], [103.83, 1.434], [103.87, 1.424], [103.92, 1.414]];
const land = `${path(JB_COAST)} L100 0 L0 0 Z`;
const singapore = `${path(SG_COAST)} L100 100 L${x(103.66).toFixed(2)} 100 Z`;
const ROADS = [
  [[103.769, 1.468], [103.762, 1.5], [103.765, 1.535], [103.78, 1.585]], // up from the Causeway to Mount Austin side
  [[103.6, 1.5], [103.66, 1.5], [103.72, 1.51], [103.765, 1.535], [103.84, 1.53], [103.92, 1.52]], // the ring road
  [[103.72, 1.462], [103.69, 1.49], [103.66, 1.5]],
  [[103.8, 1.476], [103.84, 1.53]],
];
const roadPaths = ROADS.map(path);
const causeway = path([[103.769, 1.469], [103.769, 1.447]]);
const PARKS = [[103.68, 1.545, 7, 9], [103.86, 1.56, 8, 8], [103.635, 1.46, 6, 5], [103.885, 1.495, 5, 6]];
const PLACES = [
  { name: 'Mount Austin', lng: 103.785, lat: 1.565 }, { name: 'Skudai', lng: 103.66, lat: 1.535 }, { name: 'Bukit Indah', lng: 103.682, lat: 1.487 },
  { name: 'Danga Bay', lng: 103.715, lat: 1.478 }, { name: 'Taman Pelangi', lng: 103.785, lat: 1.495 }, { name: 'Pasir Gudang', lng: 103.885, lat: 1.478 },
];
const TREES = [[8, 14], [14, 30], [21, 12], [90, 12], [83, 26], [93, 34], [44, 8], [66, 9], [10, 46], [60, 30], [32, 28]];
const pct = (lng, lat) => ({ left: `${x(lng)}%`, top: `${y(lat)}%` });

const placed = computed(() => props.pins.filter(inside).map((p) => ({ ...p, cx: x(p.lng), cy: y(p.lat) })));

// polaroids hang from these spots around the edge; each takes the free spot nearest its pin
const SLOTS = [[11, 24], [11, 60], [31, 14], [55, 14], [79, 16], [90, 42], [30, 90], [58, 92]];
const hung = computed(() => {
  const free = [...SLOTS];
  return placed.value.slice(0, SLOTS.length).map((p) => {
    let best = 0;
    free.forEach(([sx, sy], i) => {
      if (Math.hypot(sx - p.cx, sy - p.cy) < Math.hypot(free[best][0] - p.cx, free[best][1] - p.cy)) best = i;
    });
    const [sx, sy] = free.splice(best, 1)[0];
    return { ...p, sx, sy };
  });
});
const orphaned = computed(() => props.pins.length && !placed.value.length);
</script>

<template>
  <section class="tales-map" aria-label="Map of tales around Johor Bahru">
    <svg class="sea" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="100" fill="#9fd0e4" />
      <path d="M2 74c4-1 7 1 11 0M70 72c3-1 6 1 9 0M40 66c3-1 5 1 8 0" fill="none" stroke="#c4e4f0" stroke-width="2" vector-effect="non-scaling-stroke" />
      <path :d="land" fill="#ecdfb6" stroke="#6b5332" stroke-width="2.5" vector-effect="non-scaling-stroke" />
      <path :d="singapore" fill="#d4e6c6" stroke="#6b5332" stroke-width="2.5" vector-effect="non-scaling-stroke" />
      <ellipse v-for="([lng, lat, w, h], i) in PARKS" :key="i" :cx="x(lng)" :cy="y(lat)" :rx="w" :ry="h" fill="#c6d99f" />
      <path v-for="(d, i) in roadPaths" :key="`r${i}`" :d="d" fill="none" stroke="#d3bd8c" stroke-width="5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      <path :d="causeway" stroke="#4a3a24" stroke-width="7" vector-effect="non-scaling-stroke" />
      <path :d="causeway" stroke="#ecdfb6" stroke-width="3" vector-effect="non-scaling-stroke" />
      <!-- strings from each polaroid to its pin -->
      <line
        v-for="p in hung"
        :key="`s${p.id}`"
        :x1="p.sx"
        :y1="p.sy"
        :x2="p.cx"
        :y2="p.cy"
        class="string"
        :class="{ on: selected === p.id }"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <svg v-for="([tx, ty], i) in TREES" :key="`t${i}`" class="tree" viewBox="0 0 20 22" :style="{ left: `${tx}%`, top: `${ty}%` }" aria-hidden="true">
      <path d="M10 0 18 13H2Z" fill="#7da85c" /><path d="M10 0 18 13H10Z" fill="#6a9650" /><rect x="8.5" y="13" width="3" height="5" fill="#7a5a36" />
    </svg>

    <span v-for="p in PLACES" :key="p.name" class="area" :style="pct(p.lng, p.lat)" aria-hidden="true">{{ p.name }}</span>
    <span class="big jb" aria-hidden="true">JOHOR BAHRU</span>
    <span class="big sg" aria-hidden="true">SINGAPORE</span>
    <span class="water" :style="pct(103.86, 1.442)" aria-hidden="true">Straits of Johor</span>
    <span class="area link" :style="pct(103.77, 1.457)" aria-hidden="true">Causeway</span>
    <span class="area edge" aria-hidden="true">↙ to Tuas Second Link</span>
    <svg class="compass" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="26" fill="#fbf3dc" stroke="#6b5332" stroke-width="2.5" />
      <path d="M30 8 36 30H24Z" fill="#c2412d" /><path d="M30 52 24 30H36Z" fill="#4a3a24" />
      <text x="30" y="7" text-anchor="middle" font-size="9" font-weight="700" fill="#4a3a24">N</text>
    </svg>

    <!-- polaroids -->
    <button
      v-for="(p, i) in hung"
      :key="`h${p.id}`"
      type="button"
      class="polaroid"
      :class="{ on: selected === p.id }"
      :style="{ left: `${p.sx}%`, top: `${p.sy}%`, rotate: `${i % 2 ? 3 : -3}deg` }"
      :aria-label="`Open the postcard from ${p.label}`"
      @click="emit('select', p.id)"
    >
      <img v-if="p.photo" :src="p.photo" alt="" loading="lazy" />
      <span v-else class="blank" :style="{ background: p.tint || '#f6d58e' }" />
      <span class="cap">{{ p.label }}</span>
    </button>

    <!-- pins -->
    <button
      v-for="p in placed"
      :key="p.id"
      type="button"
      class="pin"
      :class="{ on: selected === p.id }"
      :style="{ left: `${p.cx}%`, top: `${p.cy}%` }"
      :aria-label="`Tale at ${p.label}`"
      :aria-pressed="selected === p.id"
      @click="emit('select', p.id)"
    >
      <span class="tip">{{ p.label }}</span>
    </button>

    <p v-if="orphaned" class="hint">None of these tales are tagged to a place on the map yet.</p>
    <slot />
  </section>
</template>

<style scoped>
.tales-map {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #9fd0e4;
}
.sea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.string {
  stroke: #9e3b1b;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}
.string.on {
  stroke-width: 3;
}
.tree {
  position: absolute;
  width: clamp(16px, 2vw, 26px);
  translate: -50% -100%;
}
.area,
.water,
.big {
  position: absolute;
  font-family: var(--font-hand);
  color: #4a3a24;
  pointer-events: none;
  white-space: nowrap;
}
.area {
  translate: -50% -50%;
  font-size: clamp(14px, 1.5vw, 19px);
}
.link {
  translate: 8px -50%;
  font-size: 14px;
}
.edge {
  left: 3%;
  bottom: 4%;
  translate: 0;
  font-size: 15px;
}
.water {
  translate: -50% -50%;
  color: #1f4e5a;
  font-style: italic;
  font-size: clamp(16px, 1.7vw, 22px);
  rotate: -12deg;
}
.big {
  font-family: var(--font-story);
  font-weight: 800;
  letter-spacing: 0.14em;
  font-size: clamp(16px, 2vw, 26px);
  opacity: 0.55;
}
.jb {
  left: 40%;
  top: 40%;
}
.sg {
  right: 4%;
  bottom: 5%;
  color: #2e6b46;
  opacity: 0.8;
}
.compass {
  position: absolute;
  left: 3%;
  top: 72%;
  width: clamp(44px, 5vw, 64px);
}

/* polaroids */
.polaroid {
  position: absolute;
  z-index: 2;
  width: clamp(84px, 9vw, 118px);
  translate: -50% -50%;
  padding: 6px 6px 4px;
  border: 0;
  background: #fffdf7;
  box-shadow: 0 5px 12px rgba(50, 30, 10, 0.35);
  font: inherit;
  cursor: pointer;
  transition: scale 0.15s;
}
.polaroid::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: #e2573c;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.35);
}
.polaroid:hover,
.polaroid:focus-visible,
.polaroid.on {
  scale: 1.1;
  z-index: 4;
}
.polaroid.on {
  outline: 3px solid #f5bf4f;
}
.polaroid img,
.blank {
  display: block;
  width: 100%;
  aspect-ratio: 5 / 4;
  object-fit: cover;
}
.cap {
  display: block;
  margin-top: 3px;
  font-family: var(--font-hand);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2a24;
}

/* pins */
.pin {
  position: absolute;
  z-index: 3;
  width: 22px;
  height: 22px;
  translate: -50% -100%;
  padding: 0;
  border: 2.5px solid #1f2a24;
  border-radius: 50% 50% 50% 0;
  rotate: -45deg;
  background: #e2573c;
  cursor: pointer;
  transition: scale 0.15s;
}
.pin::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: #fffdf7;
}
.pin:hover,
.pin:focus-visible,
.pin.on {
  scale: 1.3;
  z-index: 5;
}
.pin.on {
  background: #f5bf4f;
}
.tip {
  position: absolute;
  z-index: 1;
  left: 26px;
  top: -18px;
  rotate: 45deg;
  padding: 2px 8px;
  border: 2px solid #1f2a24;
  border-radius: 8px;
  background: #fffdf7;
  color: #1f2a24;
  font-family: var(--font-round);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
}
.pin:hover .tip,
.pin:focus-visible .tip,
.pin.on .tip {
  opacity: 1;
}
.hint {
  position: absolute;
  left: 50%;
  bottom: 40%;
  translate: -50% 0;
  margin: 0;
  padding: 6px 12px;
  background: #fffdf7;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  font-size: 13px;
}
</style>
