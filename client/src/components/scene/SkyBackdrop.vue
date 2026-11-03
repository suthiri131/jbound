<script setup>

import { computed } from 'vue';
import { useCampSky } from '@/composables/useCampSky';

const props = defineProps({
  sky: { type: Object, default: null }, // flatSky() result; defaults to right now
  path: { type: Boolean, default: true }, // the sandy path running up the middle
});

const camp = useCampSky();
const s = computed(() => props.sky || camp.sky.value);

// [x, base y, height]; kept to the sides so the middle stays clear for the page's main object
const PINES = [
  [70, 800, 270], [190, 850, 200], [-10, 880, 230], [330, 690, 120],
  [1530, 800, 280], [1420, 860, 190], [1625, 880, 220], [1270, 690, 120], [1190, 660, 86], [420, 660, 84],
];
const DOTS = [
  [120, 870, '#e86f8a'], [260, 790, '#f4efe2'], [410, 860, '#f2b134'], [520, 750, '#b48ad8'], [600, 835, '#e86f8a'], [330, 760, '#f4efe2'],
  [1010, 845, '#f4efe2'], [1090, 760, '#f2b134'], [1170, 860, '#b48ad8'], [1300, 790, '#e86f8a'], [1400, 740, '#f4efe2'], [1480, 880, '#f2b134'],
  [700, 880, '#b48ad8'], [960, 760, '#e86f8a'], [40, 760, '#f2b134'], [1580, 760, '#b48ad8'],
];
const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 37.3) % 100, y: (i * 17.9) % 44, r: i % 5 === 0 ? 2.6 : 1.6 }));
const CLOUDS = [
  { top: 8, width: 170, speed: 70, delay: -12 }, { top: 18, width: 120, speed: 95, delay: -60 }, { top: 5, width: 210, speed: 120, delay: -30 },
  { top: 24, width: 150, speed: 85, delay: -5 }, { top: 12, width: 130, speed: 105, delay: -80 }, { top: 28, width: 190, speed: 130, delay: -100 },
];
const DROPS = Array.from({ length: 70 }, (_, i) => ({ left: (i * 13.7) % 100, delay: -((i * 0.17) % 1.1), dur: 0.7 + (i % 5) * 0.08 }));
</script>

<template>
  <div class="backdrop" :class="{ storm: s.storm }" aria-hidden="true" :style="{ background: `linear-gradient(${s.top}, ${s.bottom} 62%)` }">
    <i v-for="(st, i) in STARS" :key="i" class="star" :style="{ left: `${st.x}%`, top: `${st.y}%`, width: `${st.r}px`, height: `${st.r}px`, opacity: s.stars }" />
    <i v-if="s.showSun" class="sun" :style="{ left: `${s.sunX}%`, top: `${s.sunY}%` }" />
    <i v-if="s.showMoon" class="moon" />
    <svg
      v-for="(c, i) in CLOUDS.slice(0, s.clouds)"
      :key="`c${i}`"
      class="cloud"
      viewBox="0 0 200 70"
      :style="{ top: `${c.top}%`, width: `${c.width}px`, animationDuration: `${c.speed}s`, animationDelay: `${c.delay}s` }"
    >
      <path d="M22 62h156c14 0 20-20 2-26 2-16-22-24-34-12C138 4 104 2 92 22 78 12 58 18 58 34 34 28 8 56 22 62Z" :fill="s.cloudTint" />
    </svg>

    <svg class="land" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" :style="{ filter: s.landFilter }">
      <path d="M0 470 300 340 620 450 900 330 1240 440 1600 350V900H0Z" fill="#bcd69a" />
      <path d="M0 540 260 470 560 530 980 450 1320 530 1600 480V900H0Z" fill="#a3c77f" />
      <path d="M0 610C320 570 620 590 820 600S1320 570 1600 600V900H0Z" fill="#7fb35a" />
      <path d="M0 680C400 650 1100 650 1600 690V900H0Z" fill="#6ea34e" />
      <path v-if="path" d="M730 600h140l120 300H610Z" fill="#d9bb82" />
      <g v-for="([x, y, h], i) in PINES" :key="i">
        <rect :x="x - h * 0.05" :y="y - h * 0.18" :width="h * 0.1" :height="h * 0.2" fill="#6b4426" />
        <path :d="`M${x} ${y - h} L${x + h * 0.26} ${y - h * 0.5} L${x - h * 0.26} ${y - h * 0.5}Z M${x} ${y - h * 0.72} L${x + h * 0.34} ${y - h * 0.26} L${x - h * 0.34} ${y - h * 0.26}Z M${x} ${y - h * 0.48} L${x + h * 0.42} ${y - h * 0.08} L${x - h * 0.42} ${y - h * 0.08}Z`" fill="#2f7a4b" />
        <path :d="`M${x} ${y - h} L${x + h * 0.26} ${y - h * 0.5} L${x} ${y - h * 0.5}Z M${x} ${y - h * 0.72} L${x + h * 0.34} ${y - h * 0.26} L${x} ${y - h * 0.26}Z M${x} ${y - h * 0.48} L${x + h * 0.42} ${y - h * 0.08} L${x} ${y - h * 0.08}Z`" fill="#256339" />
      </g>
      <rect v-for="([x, y, c], i) in DOTS" :key="`d${i}`" :x="x" :y="y" width="13" height="13" rx="2" :fill="c" :transform="`rotate(${i * 23} ${x} ${y})`" />
    </svg>

    <div v-if="s.haze" class="haze" />
    <div v-if="s.rain" class="rain">
      <i v-for="(d, i) in DROPS" :key="i" :style="{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }" />
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.star {
  position: absolute;
  border-radius: 50%;
  background: #fff;
}
.sun {
  position: absolute;
  width: 74px;
  height: 74px;
  translate: -50% -50%;
  border-radius: 50%;
  background: #fff1b8;
  box-shadow: 0 0 0 26px rgba(255, 241, 184, 0.35), 0 0 90px 60px rgba(255, 241, 184, 0.35);
}
.moon {
  position: absolute;
  right: 12%;
  top: 9%;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #fff6d8;
  box-shadow: 0 0 44px 14px rgba(255, 246, 216, 0.3);
}
.cloud {
  position: absolute;
  left: -240px;
  animation: drift linear infinite;
}
@keyframes drift {
  to {
    transform: translateX(calc(100vw + 480px));
  }
}
.land {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.haze {
  position: absolute;
  inset: 0;
  background: rgba(214, 200, 170, 0.35);
}
.rain i {
  position: absolute;
  top: -60px;
  width: 2px;
  height: 34px;
  border-radius: 2px;
  background: rgba(214, 230, 255, 0.65);
  animation: fall linear infinite;
}
@keyframes fall {
  to {
    transform: translateY(110vh);
  }
}
.storm::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  animation: flash 9s infinite;
}
@keyframes flash {
  0%, 91%, 93.5%, 100% {
    opacity: 0;
  }
  92%, 94.5% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cloud,
  .rain,
  .storm::after {
    animation: none;
  }
  .rain {
    display: none;
  }
}
</style>
