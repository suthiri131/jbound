<script setup>
defineProps({
  night: { type: Boolean, default: false }, // the glow reads much stronger after dark
});
</script>

<template>
  <svg class="campfire" viewBox="0 0 160 150" aria-hidden="true">
    <ellipse cx="80" cy="100" rx="78" ry="48" fill="#ffb347" :opacity="night ? 0.38 : 0.14" class="glow" />
    <ellipse cx="80" cy="134" rx="66" ry="12" fill="#000" opacity=".18" />
    <!-- flames, back to front -->
    <path class="flame f1" d="M80 14c10 22 36 40 36 76 0 22-16 36-36 36s-36-14-36-36c0-20 12-28 18-44 4 10 8 14 12 16 2-16 2-32 6-48Z" fill="#e2573c" />
    <path class="flame f2" d="M82 44c6 16 22 28 22 50 0 16-11 28-24 28s-24-12-24-28c0-13 8-20 12-30 3 7 5 9 8 11 2-11 3-21 6-31Z" fill="#f2914a" />
    <path class="flame f3" d="M80 72c4 10 12 17 12 29 0 11-5 19-12 19s-12-8-12-19c0-8 4-12 7-18 1 3 2 5 3 6 1-6 1-11 2-17Z" fill="#ffe08a" />
    <!-- logs -->
    <g stroke="#2a1810" stroke-width="3">
      <rect x="26" y="114" width="108" height="16" rx="8" fill="#6b4426" transform="rotate(-12 80 122)" />
      <rect x="26" y="114" width="108" height="16" rx="8" fill="#7d5230" transform="rotate(12 80 122)" />
    </g>
    <!-- stones -->
    <g fill="#a39a8b" stroke="#2a1810" stroke-width="2.5">
      <ellipse cx="24" cy="134" rx="14" ry="9" />
      <ellipse cx="54" cy="141" rx="15" ry="8" fill="#8f8678" />
      <ellipse cx="86" cy="143" rx="16" ry="7" />
      <ellipse cx="116" cy="140" rx="14" ry="8" fill="#8f8678" />
      <ellipse cx="139" cy="133" rx="13" ry="9" />
    </g>
  </svg>
</template>

<style scoped>
.campfire {
  overflow: visible;
}
.flame {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: flicker 1.1s ease-in-out infinite alternate;
}
.f2 {
  animation-duration: 0.8s;
  animation-delay: -0.3s;
}
.f3 {
  animation-duration: 0.6s;
  animation-delay: -0.15s;
}
.glow {
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse 2.4s ease-in-out infinite alternate;
}
@keyframes flicker {
  from {
    transform: scale(1, 1) skewX(-2deg);
  }
  to {
    transform: scale(0.94, 1.07) skewX(3deg);
  }
}
@keyframes pulse {
  to {
    transform: scale(1.06);
  }
}
@media (prefers-reduced-motion: reduce) {
  .flame,
  .glow {
    animation: none;
  }
}
</style>
