<script setup>
import { computed } from 'vue';
import { normaliseLook } from '@/lib/camp/look';

const props = defineProps({
  look: { type: Object, default: null },
  height: { type: Number, default: 180 },
  still: { type: Boolean, default: false }, // no idle bobbing
});

const l = computed(() => normaliseLook(props.look));
const darker = (hex, by = 0.82) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * by).toString(16).padStart(2, '0')).join('')}`;
const CURLS = [[42, 42], [34, 56], [78, 42], [86, 56], [52, 30], [68, 30], [60, 26]];
</script>

<template>
  <svg class="avatar-flat" :class="{ still }" viewBox="0 0 120 200" :style="{ height: `${height}px` }" aria-hidden="true">
    <ellipse cx="60" cy="191" rx="38" ry="8" fill="#000" opacity=".18" />
    <g class="bob">
      <!-- long hair sits behind everything -->
      <path v-if="l.hairStyle === 'long'" d="M30 52c-4 30-2 52 4 66h52c6-14 8-36 4-66Z" :fill="l.hair" />
      <!-- legs + shoes -->
      <rect x="44" y="136" width="14" height="44" rx="5" :fill="l.bottom" />
      <rect x="62" y="136" width="14" height="44" rx="5" :fill="darker(l.bottom)" />
      <path d="M41 180h18v8H37c0-4 1-8 4-8ZM61 180h18c3 0 4 4 4 8H61Z" fill="#2a2117" />
      <!-- arms -->
      <rect x="22" y="88" width="15" height="48" rx="7" :fill="l.top" />
      <rect x="83" y="88" width="15" height="48" rx="7" :fill="darker(l.top)" />
      <circle cx="29.5" cy="138" r="7.5" :fill="l.skin" />
      <circle cx="90.5" cy="138" r="7.5" :fill="l.skin" />
      <!-- body, shaded down one side -->
      <rect x="35" y="82" width="50" height="60" rx="10" :fill="l.top" />
      <path d="M60 82h15a10 10 0 0 1 10 10v40a10 10 0 0 1-10 10H60Z" :fill="darker(l.top, 0.9)" />
      <!-- head -->
      <rect x="53" y="72" width="14" height="14" :fill="darker(l.skin)" />
      <circle cx="60" cy="52" r="30" :fill="l.skin" />
      <circle cx="49" cy="55" r="3.2" fill="#1b1410" />
      <circle cx="71" cy="55" r="3.2" fill="#1b1410" />
      <ellipse cx="42" cy="63" rx="5" ry="3" fill="#e98a7a" opacity=".65" />
      <ellipse cx="78" cy="63" rx="5" ry="3" fill="#e98a7a" opacity=".65" />
      <path d="M54 66c3 3 9 3 12 0" fill="none" stroke="#1b1410" stroke-width="2" stroke-linecap="round" />
      <!-- hair on top -->
      <g :fill="l.hair">
        <path v-if="l.hairStyle === 'buzz'" d="M31 46a29 29 0 0 1 58 0c-18-7-40-7-58 0Z" opacity=".85" />
        <path v-else d="M29 52a31 31 0 0 1 62 0c-6-8-16-13-24-13-10 6-26 6-34 5-2 2-3 5-4 8Z" />
        <circle v-if="l.hairStyle === 'bun'" cx="60" cy="16" r="11" />
        <template v-if="l.hairStyle === 'curly'">
          <circle v-for="([x, y], i) in CURLS" :key="i" :cx="x" :cy="y" r="10" />
        </template>
      </g>
      <!-- hats -->
      <g v-if="l.hat === 'cap'">
        <path d="M30 42a30 28 0 0 1 60 0Z" :fill="l.top" />
        <path d="M30 42h72c0 5-4 7-10 7H30Z" :fill="darker(l.top)" />
      </g>
      <g v-else-if="l.hat === 'bucket'">
        <path d="M38 36c2-14 42-14 44 0l3 10H35Z" fill="#d9c9a3" />
        <path d="M22 46h76c2 3 1 7-3 7H25c-4 0-5-4-3-7Z" fill="#c4b38b" />
      </g>
      <g v-else-if="l.hat === 'beanie'">
        <path d="M30 42a30 30 0 0 1 60 0Z" :fill="l.top" />
        <rect x="27" y="38" width="66" height="11" rx="5" :fill="darker(l.top)" />
        <circle cx="60" cy="13" r="7" fill="#f4efe2" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.avatar-flat {
  display: block;
  width: auto;
  overflow: visible;
}
.bob {
  animation: breathe 2.6s ease-in-out infinite;
  transform-origin: 60px 190px;
}
.still .bob {
  animation: none;
}
@keyframes breathe {
  50% {
    transform: scaleY(1.012) translateY(-1px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bob {
    animation: none;
  }
}
</style>
