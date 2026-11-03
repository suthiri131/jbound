<script setup>

import { computed } from 'vue';

const props = defineProps({
  stacks: { type: Array, default: () => [] }, // [{ id, initial, amount, tint }]
  night: { type: Boolean, default: false },
});

const MAX_COINS = 8;
const COUNTER_Y = 322;
const shown = computed(() => {
  const most = Math.max(...props.stacks.map((s) => s.amount), 1);
  const list = props.stacks.slice(0, 6);
  return list.map((s, i) => ({
    ...s,
    x: 150 + i * (250 / Math.max(list.length - 1, 1)) * (list.length > 1 ? 1 : 0),
    coins: s.amount > 0 ? Math.max(1, Math.round((s.amount / most) * MAX_COINS)) : 0,
  }));
});
const STRIPES = Array.from({ length: 10 }, (_, i) => i);
</script>

<template>
  <svg class="stall" viewBox="0 0 640 520" aria-hidden="true">
    <ellipse cx="320" cy="500" rx="310" ry="20" fill="#000" opacity=".16" />
    <!-- back wall + shelf -->
    <rect x="96" y="120" width="448" height="210" fill="#5b3a22" />
    <rect x="96" y="214" width="448" height="9" fill="#46291a" />
    <g fill="#e0a43b" stroke="#2a1810" stroke-width="2">
      <rect x="128" y="176" width="34" height="38" rx="4" />
      <rect x="172" y="186" width="26" height="28" rx="4" fill="#c94f3d" />
      <rect x="470" y="172" width="38" height="42" rx="4" fill="#3f8f86" />
      <rect x="430" y="188" width="28" height="26" rx="4" fill="#f4efe2" />
    </g>
    <!-- posts -->
    <rect x="84" y="90" width="20" height="400" fill="#4a2c1a" />
    <rect x="536" y="90" width="20" height="400" fill="#4a2c1a" />
    <!-- awning: stripes with a scalloped edge -->
    <g v-for="i in STRIPES" :key="i">
      <path :d="`M${60 + i * 52} 56 h52 v62 a26 20 0 0 1 -52 0Z`" :fill="i % 2 ? '#fbf1e4' : '#e0758c'" stroke="#2a1810" stroke-width="2.5" />
    </g>
    <rect x="52" y="44" width="536" height="16" rx="4" fill="#c2556b" stroke="#2a1810" stroke-width="2.5" />
    <!-- lantern -->
    <path d="M500 120v22" stroke="#2a1810" stroke-width="3" />
    <circle v-if="night" cx="500" cy="162" r="58" fill="#ffd27a" opacity=".3" />
    <rect x="486" y="142" width="28" height="36" rx="5" :fill="night ? '#ffe6a3' : '#f5e3a8'" stroke="#2a1810" stroke-width="3" />
    <!-- sign -->
    <path d="M250 118v20M390 118v20" stroke="#2a1810" stroke-width="3" />
    <rect x="186" y="136" width="268" height="52" rx="6" fill="#8a5a34" stroke="#2a1810" stroke-width="3" />
    <rect x="196" y="145" width="248" height="34" rx="3" fill="#fbf6e9" />
    <text x="320" y="170" text-anchor="middle" class="sign">The Market Stall</text>
    <!-- counter -->
    <rect x="70" y="322" width="500" height="16" rx="3" fill="#a9703f" stroke="#2a1810" stroke-width="2.5" />
    <rect x="84" y="338" width="472" height="150" fill="#7a4a29" stroke="#2a1810" stroke-width="2.5" />
    <path d="M84 388h472M84 438h472" stroke="#5f3820" stroke-width="3" />
    <rect x="434" y="338" width="122" height="150" fill="#5f3820" stroke="#2a1810" stroke-width="2.5" />
    <!-- cash box -->
    <rect x="462" y="270" width="72" height="52" rx="5" fill="#2f5f8a" stroke="#2a1810" stroke-width="2.5" />
    <rect x="474" y="280" width="48" height="18" rx="2" fill="#a8d4e6" />
    <!-- coin stacks: real numbers -->
    <g v-for="s in shown" :key="s.id">
      <ellipse
        v-for="n in s.coins"
        :key="n"
        :cx="s.x"
        :cy="COUNTER_Y - 6 - (n - 1) * 9"
        rx="24"
        ry="8"
        :fill="n % 2 ? '#f2b134' : '#e7a324'"
        stroke="#7a4f12"
        stroke-width="2"
      />
      <rect :x="s.x - 15" y="346" width="30" height="24" rx="4" :fill="s.tint" stroke="#2a1810" stroke-width="2" />
      <text :x="s.x" y="363" text-anchor="middle" class="tag">{{ s.initial }}</text>
    </g>
    <!-- crates -->
    <rect x="566" y="430" width="70" height="60" fill="#8a5a34" stroke="#2a1810" stroke-width="2.5" />
    <rect x="576" y="388" width="50" height="42" fill="#a9703f" stroke="#2a1810" stroke-width="2.5" />
  </svg>
</template>

<style scoped>
.stall {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.sign {
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 24px;
  fill: #1f2a24;
}
.tag {
  font-family: var(--font-round);
  font-weight: 700;
  font-size: 15px;
  fill: #1f2a24;
}
</style>
