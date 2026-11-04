<script setup>
import { computed } from 'vue';

const props = defineProps({
  size: { type: [Number, String], default: 64 }, // width in px (or any CSS length); height is 4/9 of it
  text: { type: String, default: '' }, // visible caption, e.g. "Plotting the route…"
  label: { type: String, default: 'Loading' }, // what screen readers hear when there's no text
  center: { type: Boolean, default: false },
  eyeScale: { type: Number, default: 0.62 },
  gapScale: { type: Number, default: 0.09 },
  pupilScale: { type: Number, default: 0.32 },
  blinkScale: { type: Number, default: 0.375 },
  travelScale: { type: Number, default: 0.3125 },
  duration: { type: String, default: '10s' },
});

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const vars = computed(() => ({
  '--we-width': typeof props.size === 'number' ? `${props.size}px` : props.size,
  '--we-eye': `${(clamp(props.eyeScale, 0.28, 0.7) * 100).toFixed(2)}cqmin`,
  '--we-gap': `${(clamp(props.gapScale, 0.04, 0.3) * 100).toFixed(2)}cqmin`,
  '--we-pupil': `${clamp(props.pupilScale, 0.12, 0.45)}`,
  '--we-blink': `${clamp(props.blinkScale, 0.15, 1)}`,
  '--we-travel': `${clamp(props.travelScale, 0.08, 0.5)}`,
  '--we-duration': props.duration,
}));
</script>

<template>
  <span class="wandering" :class="{ center }" role="status">
    <span class="eyes" :style="vars" aria-hidden="true">
      <span class="pair">
        <span class="eye" />
        <span class="eye" />
      </span>
    </span>
    <span v-if="text" class="text">{{ text }}</span>
    <span v-else class="sr-only">{{ label }}</span>
  </span>
</template>

<style scoped>
.wandering {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  vertical-align: middle;
}
.wandering.center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 24px 12px;
  text-align: center;
}
.eyes {
  container-type: size;
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--we-width);
  aspect-ratio: 9 / 4;
  --eye-color: color-mix(in srgb, currentColor 16%, transparent);
  --pupil-color: currentColor;
}
.pair {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--we-gap);
}
.eye {
  display: inline-block;
  width: var(--we-eye);
  height: var(--we-eye);
  border-radius: 50%;
  background-color: var(--eye-color);
  background-image: radial-gradient(circle calc(var(--we-eye) * var(--we-pupil)), var(--pupil-color) 100%, transparent 0);
  background-repeat: no-repeat;
  animation:
    we-move var(--we-duration) infinite,
    we-blink var(--we-duration) infinite;
  /* start 13% into the cycle, so the first thing they do is glance to the side */
  animation-delay: calc(var(--we-duration) * -0.13);
}.text {
  font-family: var(--font-hand);
  font-size: 20px;
  line-height: 1.1;
}

@keyframes we-move {
  0%, 10% { background-position: 0 0; }
  13%, 40% { background-position: calc(var(--we-eye) * var(--we-travel) * -1) 0; }
  43%, 70% { background-position: calc(var(--we-eye) * var(--we-travel)) 0; }
  73%, 90% { background-position: 0 calc(var(--we-eye) * var(--we-travel)); }
  93%, 100% { background-position: 0 0; }
}
@keyframes we-blink {
  0%, 10%, 12%, 20%, 22%, 40%, 42%, 60%, 62%, 70%, 72%, 90%, 92%, 98%, 100% { height: var(--we-eye); }
  11%, 21%, 41%, 61%, 71%, 91%, 99% { height: calc(var(--we-eye) * var(--we-blink)); }
}
@media (prefers-reduced-motion: reduce) {
  .eye { animation: none; }
}
</style>