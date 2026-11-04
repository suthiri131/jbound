<script setup>
/** One pin-back badge, drawn around (0, 0) about 30 units across. Use it inside an <svg>. */
defineProps({ kind: { type: String, required: true } });

// durian: a round fruit covered in little spikes
const spikes = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = i % 2 ? 6.4 : 8.6;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(' ');
</script>

<template>
  <g class="badge">
    <!-- the star is a sewn-on patch; every other badge is a round pin -->
    <path v-if="kind === 'star'" class="ln" fill="#c98a4b" d="M0 -15 L4.4 -5 L15 -4.4 L7 2.8 L9.4 14 L0 8 L-9.4 14 L-7 2.8 L-15 -4.4 L-4.4 -5 Z" />
    <template v-else>
      <circle class="ln" r="13.5" :fill="{ mushroom: '#c89a6a', mountain: '#e7c48a', compass: '#f4e7c9', leaf: '#dfe8c8', heart: '#f2c9c0', sun: '#9cc4d8', durian: '#f6e7c8' }[kind]" />
      <circle r="10.5" fill="none" stroke="rgba(58,38,24,.25)" stroke-width="1.2" />

      <g v-if="kind === 'mushroom'">
        <path class="ln" fill="#c84a3a" d="M-10 1 C-10 -10 10 -10 10 1 Z" />
        <path class="ln" fill="#f4e7c9" d="M-3.5 1 L3.5 1 L3 9 L-3 9 Z" />
        <circle cx="-4.5" cy="-4" r="1.6" fill="#fff" /><circle cx="3.5" cy="-5" r="1.4" fill="#fff" /><circle cx="0" cy="-1.5" r="1.1" fill="#fff" />
      </g>
      <g v-else-if="kind === 'mountain'">
        <path class="ln" fill="#7d9a52" d="M-11 7 L-3 -6 L2 1 L5 -3 L11 7 Z" />
        <path fill="#fbf6e9" d="M-5.3 -2.3 L-3 -6 L-0.8 -2.6 L-2.6 -1.4 Z" />
      </g>
      <g v-else-if="kind === 'compass'">
        <circle r="8" fill="none" class="ln" />
        <path class="ln" fill="#c84a3a" d="M0 -8 L3 0 L-3 0 Z" />
        <path class="ln" fill="#5d7a8c" d="M0 8 L3 0 L-3 0 Z" />
        <circle r="1.4" fill="#3a2618" />
      </g>
      <g v-else-if="kind === 'leaf'">
        <path class="ln" fill="#7d9a52" d="M-8 7 C-9 -4 0 -9 9 -8 C9 1 2 8 -8 7 Z" />
        <path class="ln" fill="none" d="M-7 6 L6 -6" />
      </g>
      <g v-else-if="kind === 'heart'">
        <path class="ln" fill="#d2584a" d="M0 8 C-10 0 -10 -8 -5 -8 C-2.5 -8 0 -6 0 -3.5 C0 -6 2.5 -8 5 -8 C10 -8 10 0 0 8 Z" />
      </g>
      <g v-else-if="kind === 'sun'">
        <path class="ln" fill="none" d="M0 -10 V-7.5 M0 10 V7.5 M-10 0 H-7.5 M10 0 H7.5 M-7 -7 L-5.3 -5.3 M7 7 L5.3 5.3 M-7 7 L-5.3 5.3 M7 -7 L5.3 -5.3" />
        <circle class="ln" r="5" fill="#f2c14e" />
      </g>
      <g v-else-if="kind === 'durian'">
        <polygon class="ln" fill="#9cb04a" :points="spikes" />
        <path fill="none" stroke="rgba(58,38,24,.45)" stroke-width="1.1" d="M-3 -3 L3 3 M3 -3 L-3 3" />
        <path class="ln" fill="none" d="M0 -8.6 C1 -11 3 -12 4.5 -12" />
      </g>
    </template>
  </g>
</template>

<style scoped>
.ln {
  stroke: #3a2618;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>