<script setup>
/** The inside of the archive tent: canvas walls, a mesh window on the real sky, lantern and string lights. */
import { useCampSky } from '@/composables/useCampSky';

const { sky } = useCampSky({ weather: false });
const BULBS = [[150, 150], [240, 112], [330, 74], [420, 42], [580, 42], [670, 74], [760, 112], [850, 150]];
const SEAMS = ['M500 0 300 700', 'M500 0 700 700', 'M500 0 90 700', 'M500 0 910 700'];
const FLAGS = ['#e2573c', '#f2b134', '#3f8f86', '#fffdf7', '#2f7fbf'];
</script>

<template>
  <div class="tent" aria-hidden="true">
    <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMin slice">
      <defs>
        <radialGradient id="tent-glow" cx="50%" cy="22%" r="70%">
          <stop offset="0%" stop-color="#f9e6bb" />
          <stop offset="55%" stop-color="#dfbf87" />
          <stop offset="100%" stop-color="#ab8552" />
        </radialGradient>
      </defs>
      <rect width="1000" height="700" fill="url(#tent-glow)" />
      <path v-for="(d, i) in SEAMS" :key="i" :d="d" stroke="#a07c4b" stroke-width="3" stroke-dasharray="10 7" fill="none" />

      <!-- the slopes of the roof, a shade darker either side -->
      <path d="M0 0H500L0 300Z" fill="#b48e5a" />
      <path d="M1000 0H500L1000 300Z" fill="#a78350" />
      <path d="M0 300 500 0 1000 300" fill="none" stroke="#7d5e36" stroke-width="10" />

      <!-- mesh window on the real sky -->
      <g>
        <path id="tent-vent" d="M500 26 590 96H410Z" :fill="sky.top" />
        <path d="M410 96H590L500 26Z" :fill="sky.bottom" opacity=".5" />
        <circle v-if="sky.showSun" cx="538" cy="66" r="11" fill="#fff1b8" />
        <circle v-if="sky.showMoon" cx="538" cy="66" r="9" fill="#fff6d8" />
        <path d="M455 96 500 26M545 96 500 26M500 96V26M432 80H568M455 60H545" stroke="#6f5532" stroke-width="1.4" opacity=".55" />
        <path d="M500 26 590 96H410Z" fill="none" stroke="#7d5e36" stroke-width="7" stroke-linejoin="round" />
      </g>

      <!-- string lights along the slopes -->
      <path d="M100 176Q240 130 420 42Q500 10 580 42Q760 130 900 176" fill="none" stroke="#5d4326" stroke-width="2.5" />
      <g v-for="([x, y], i) in BULBS" :key="i">
        <circle :cx="x" :cy="y + 11" r="19" fill="#ffe7a8" opacity=".35" />
        <circle :cx="x" :cy="y + 11" r="7" fill="#fff0bd" stroke="#5d4326" stroke-width="1.6" />
      </g>

      <!-- bunting in the corners -->
      <path v-for="i in 5" :key="`l${i}`" :d="`M${(i - 1) * 42 + 8} ${232 - (i - 1) * 25}l30 -18l-4 30Z`" :fill="FLAGS[i % 5]" />
      <path v-for="i in 5" :key="`r${i}`" :d="`M${992 - (i - 1) * 42} ${232 - (i - 1) * 25}l-30 -18l4 30Z`" :fill="FLAGS[(i + 2) % 5]" />
    </svg>

    <span class="pole" />
    <span class="lantern"><i /></span>
    <span class="sign">The Archive Tent</span>
  </div>
</template>

<style scoped>
.tent {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
/* the centre pole, standing between the two cupboards */
.pole {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 16px;
  margin-left: -8px;
  background: linear-gradient(90deg, #7d5e36, #5d4326);
}
.lantern {
  position: absolute;
  z-index: 1;
  left: 50%;
  top: 15%;
  width: 34px;
  height: 46px;
  margin-left: -17px;
  border: 3px solid #2a1810;
  border-radius: 8px 8px 12px 12px;
  background: #ffe6a3;
  box-shadow: 0 0 40px 26px rgba(255, 224, 150, 0.5);
  animation: glow 5s ease-in-out infinite;
}
.lantern::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 3px;
  height: 12vh;
  margin-left: -1.5px;
  background: #2a1810;
}
.sign {
  position: absolute;
  z-index: 1;
  left: 73%;
  top: 23%;
  translate: -50% 0;
  rotate: 4deg;
  padding: 0.25em 0.8em;
  border: 2.5px solid #2a1810;
  border-radius: 6px;
  background: #fbf6e9;
  color: #1f2a24;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: clamp(13px, 1.5vw, 19px);
  white-space: nowrap;
}
@keyframes glow {
  50% {
    box-shadow: 0 0 34px 22px rgba(255, 224, 150, 0.42);
  }
}
@media (max-width: 720px) {
  .pole,
  .sign {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lantern {
    animation: none;
  }
}
</style>
