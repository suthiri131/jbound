<script setup>
/**
 * A hand-drawn style map of Johor Bahru and the Straits, with a pin per tale.
 * Pins sit at the place's real lat/lng; the coastline is a simplified sketch, not survey-accurate.
 */
import { computed } from 'vue';

const props = defineProps({
  pins: { type: Array, default: () => [] }, // [{ id, lat, lng, label, tint }]
  selected: { type: String, default: null },
});
const emit = defineEmits(['select']);

const W = 400;
const H = 260;
const BOUNDS = { west: 103.6, east: 103.9, north: 1.56, south: 1.4 };
const x = (lng) => ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W;
const y = (lat) => ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H;
const inside = (p) => p.lat <= BOUNDS.north && p.lat >= BOUNDS.south && p.lng >= BOUNDS.west && p.lng <= BOUNDS.east;

const line = (pts) => pts.map(([lng, lat], i) => `${i ? 'L' : 'M'}${x(lng).toFixed(1)} ${y(lat).toFixed(1)}`).join(' ');
// Johor's southern shore and Singapore's northern shore, west to east
const JB_COAST = [[103.55, 1.405], [103.6, 1.398], [103.64, 1.39], [103.68, 1.425], [103.72, 1.458], [103.76, 1.466], [103.8, 1.474], [103.84, 1.466], [103.88, 1.458], [103.92, 1.455]];
const SG_COAST = [[103.62, 1.38], [103.64, 1.362], [103.67, 1.385], [103.71, 1.432], [103.75, 1.446], [103.79, 1.446], [103.83, 1.43], [103.87, 1.418], [103.92, 1.41]];
const jbLand = `${line(JB_COAST)} L${W} 0 L0 0 Z`;
const sgLand = `${line(SG_COAST)} L${W} ${H} L${x(103.62)} ${H} Z`;
const causeway = { x1: x(103.769), y1: y(1.465), x2: x(103.769), y2: y(1.446) };

const shown = computed(() => props.pins.filter(inside).map((p) => ({ ...p, cx: x(p.lng), cy: y(p.lat) })));
const trees = [[60, 40], [90, 70], [300, 50], [340, 90], [150, 30], [230, 80], [40, 100]];
</script>

<template>
  <figure class="jb-map">
    <svg :viewBox="`0 0 ${W} ${H}`" role="group" aria-label="Map of tales around Johor Bahru">
      <rect :width="W" :height="H" fill="#a8d4e6" />
      <path :d="jbLand" fill="#e9dfb9" stroke="#1f2a24" stroke-width="2" />
      <path :d="sgLand" fill="#d9ead0" stroke="#1f2a24" stroke-width="2" />
      <line v-bind="causeway" stroke="#1f2a24" stroke-width="5" />
      <line v-bind="causeway" stroke="#e9dfb9" stroke-width="2" />
      <g v-for="([tx, ty], i) in trees" :key="i" aria-hidden="true">
        <path :d="`M${tx} ${ty - 9} L${tx + 7} ${ty + 4} L${tx - 7} ${ty + 4} Z`" fill="#6aa84f" stroke="#1f2a24" stroke-width="1.2" />
      </g>
      <text x="16" y="22" class="lbl big">JOHOR BAHRU</text>
      <text :x="x(103.68)" :y="y(1.448)" class="lbl water">Straits of Johor</text>
      <text :x="W - 16" :y="H - 12" text-anchor="end" class="lbl big sg">SINGAPORE</text>
      <text :x="causeway.x1 + 8" :y="causeway.y2 + 4" class="lbl tiny">Causeway</text>

      <g
        v-for="p in shown"
        :key="p.id"
        class="pin"
        :class="{ on: p.id === selected }"
        :transform="`translate(${p.cx} ${p.cy})`"
        role="button"
        tabindex="0"
        :aria-label="`Tale at ${p.label}`"
        :aria-pressed="p.id === selected"
        @click="emit('select', p.id)"
        @keydown.enter.prevent="emit('select', p.id)"
        @keydown.space.prevent="emit('select', p.id)"
      >
        <path d="M0 0 C-8 -10 -9 -14 -9 -18 A9 9 0 1 1 9 -18 C9 -14 8 -10 0 0 Z" :fill="p.tint || '#e2603f'" stroke="#1f2a24" stroke-width="2" />
        <circle cy="-18" r="3.5" fill="#fffdf7" stroke="#1f2a24" stroke-width="1.5" />
      </g>
    </svg>
    <figcaption v-if="pins.length && !shown.length">None of these tales are tagged to a place on the map yet.</figcaption>
  </figure>
</template>

<style scoped>
.jb-map {
  margin: 0;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  border: 2.5px solid #1f2a24;
  border-radius: 12px;
  background: #a8d4e6;
}
.lbl {
  font-family: var(--font-hand);
  font-size: 15px;
  fill: #1f2a24;
}
.big {
  font-family: var(--font-round);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 2px;
}
.sg {
  fill: #2e6b46;
}
.water {
  fill: #1f4e5a;
  font-style: italic;
}
.tiny {
  font-size: 12px;
}
.pin {
  cursor: pointer;
  transition: transform 0.2s;
}
.pin path {
  transition: transform 0.15s;
  transform-origin: 0 0;
}
.pin:hover path,
.pin:focus-visible path,
.pin.on path {
  transform: scale(1.35);
}
.pin.on path {
  fill: #f5bf4f;
}
.pin:focus {
  outline: none; /* the bigger, thicker pin is the focus indicator */
}
.pin:focus-visible path {
  stroke-width: 3;
}
figcaption {
  margin-top: 6px;
  font-size: 12.5px;
  opacity: 0.75;
}
</style>
