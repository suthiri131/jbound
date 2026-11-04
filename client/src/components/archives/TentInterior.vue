<script setup>
/** The inside of the archive tent: canvas walls, a mesh window on the real sky, lantern and string lights. */
import { useCampSky } from '@/composables/useCampSky';

const { sky } = useCampSky({ weather: false });

// One rope, wall to ridge to wall. Flags and bulbs are worked out from it, so they always hang on the line.
const WALL = [0, 218];
const SAG = [240, 124];
const RIDGE = [500, 14];
const ROPE = `M${WALL} Q${SAG} ${RIDGE} Q${1000 - SAG[0]} ${SAG[1]} ${1000 - WALL[0]} ${WALL[1]}`;
const along = (t) => [0, 1].map((i) => (1 - t) ** 2 * WALL[i] + 2 * t * (1 - t) * SAG[i] + t ** 2 * RIDGE[i]);
const mirror = ([x, y]) => [1000 - x, y];

// a triangle whose top edge lies on the rope and whose tip hangs straight down
const flag = (t, place) => {
  const [a, b] = [place(along(t)), place(along(t + 0.052))];
  return `M${a} L${b} L${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 34}Z`;
};
const FLAG_SPOTS = [0.03, 0.1, 0.17, 0.24, 0.31];
const BULB_SPOTS = [0.44, 0.6, 0.76, 0.92];
// numbered left to right along the whole rope, so odd and even take turns
const BULBS = [...BULB_SPOTS.map((t) => along(t)), ...[...BULB_SPOTS].reverse().map((t) => mirror(along(t)))];
const SEAMS = ['M500 0 300 700', 'M500 0 700 700', 'M500 0 90 700', 'M500 0 910 700'];
const FLAGS = ['#e2573c', '#f2b134', '#3f8f86', '#fffdf7', '#2f7fbf'];
const BUNTING = [
  ...FLAG_SPOTS.map((t, i) => ({ d: flag(t, (p) => p), fill: FLAGS[(i + 1) % 5] })),
  ...FLAG_SPOTS.map((t, i) => ({ d: flag(t, mirror), fill: FLAGS[(i + 3) % 5] })),
];
</script>

<template>
  <div class="tent" aria-hidden="true">
    <!-- everything still gets the paint, on its own layer; only the blinking lights stay out, so it isn't repainted every second -->
    <svg class="walls" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMin slice">
      <defs>
        <radialGradient id="tent-glow" cx="50%" cy="22%" r="70%">
          <stop offset="0%" stop-color="#f9e6bb" />
          <stop offset="55%" stop-color="#dfbf87" />
          <stop offset="100%" stop-color="#ab8552" />
        </radialGradient>
        <linearGradient id="tent-slope-left" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stop-color="#c29c67" />
          <stop offset="100%" stop-color="#a98552" />
        </linearGradient>
        <linearGradient id="tent-slope-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#bc9662" />
          <stop offset="100%" stop-color="#a07c4b" />
        </linearGradient>
        <!-- cloth catching the light on one side and folding away on the other -->
        <linearGradient id="flag-fold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#fff" stop-opacity=".3" />
          <stop offset="48%" stop-color="#fff" stop-opacity="0" />
          <stop offset="52%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity=".26" />
        </linearGradient>
        <radialGradient id="bulb-off" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#dcc99a" />
          <stop offset="100%" stop-color="#84693c" />
        </radialGradient>
        <linearGradient id="bulb-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f4d58c" />
          <stop offset="100%" stop-color="#8f6620" />
        </linearGradient>
      </defs>

      <g filter="url(#soft-paint-dark)">
        <rect x="-10" y="-10" width="1020" height="720" fill="url(#tent-glow)" />
        <path v-for="(d, i) in SEAMS" :key="i" :d="d" stroke="#a07c4b" stroke-width="3" stroke-dasharray="10 7" fill="none" />

        <!-- the slopes of the roof, a shade darker either side, falling away from the lantern -->
        <path d="M-10 -10H500L-10 306Z" fill="url(#tent-slope-left)" />
        <path d="M1010 -10H500L1010 306Z" fill="url(#tent-slope-right)" />
        <!-- the fold in the canvas where roof meets wall: a shadow below, then the seam -->
        <path d="M-10 316 500 10 1010 316" fill="none" stroke="#6b4e2b" stroke-opacity=".22" stroke-width="14" />
        <path d="M-10 306 500 0 1010 306" fill="none" stroke="#7d5e36" stroke-width="10" />

        <!-- mesh window on the real sky -->
        <path d="M500 26 590 96H410Z" :fill="sky.top" />
        <path d="M410 96H590L500 26Z" :fill="sky.bottom" opacity=".5" />
        <circle v-if="sky.showSun" cx="538" cy="66" r="11" fill="#fff1b8" />
        <circle v-if="sky.showMoon" cx="538" cy="66" r="9" fill="#fff6d8" />
        <path d="M455 96 500 26M545 96 500 26M500 96V26M432 80H568M455 60H545" stroke="#6f5532" stroke-width="1.4" opacity=".55" />
        <path d="M500 26 590 96H410Z" fill="none" stroke="#7d5e36" stroke-width="7" stroke-linejoin="round" />

        <!-- the rope, with the shadow of the rope, flags and bulbs falling on the canvas behind -->
        <g transform="translate(5 9)" fill="#3a2410" stroke="none" opacity=".2">
          <path :d="ROPE" fill="none" stroke="#3a2410" stroke-width="3" />
          <path v-for="(f, i) in BUNTING" :key="i" :d="f.d" />
          <circle v-for="([x, y], i) in BULBS" :key="i" :cx="x" :cy="y + 14" r="8" />
        </g>
        <path :d="ROPE" fill="none" stroke="#2a1810" stroke-width="3" />

        <g v-for="(f, i) in BUNTING" :key="i">
          <path :d="f.d" :fill="f.fill" />
          <path :d="f.d" fill="url(#flag-fold)" stroke="#2a1810" stroke-width="2.4" stroke-linejoin="round" />
        </g>

        <!-- the bulbs, unlit -->
        <g v-for="([x, y], i) in BULBS" :key="i">
          <path :d="`M${x} ${y}v4`" stroke="#2a1810" stroke-width="2.5" />
          <circle :cx="x" :cy="y + 14" r="8" fill="url(#bulb-off)" stroke="#2a1810" stroke-width="2" />
          <rect :x="x - 4.5" :y="y + 3" width="9" height="6" rx="1.5" fill="url(#bulb-cap)" stroke="#2a1810" stroke-width="1.8" />
        </g>
      </g>
    </svg>

    <!-- the lights coming on: a soft glow, a bright bulb and a glint on the glass -->
    <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMin slice">
      <defs>
        <radialGradient id="bulb-halo">
          <stop offset="0%" stop-color="#ffe7a8" stop-opacity=".75" />
          <stop offset="100%" stop-color="#ffe7a8" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="bulb-on" cx="42%" cy="36%" r="70%">
          <stop offset="0%" stop-color="#fffdf0" />
          <stop offset="100%" stop-color="#ffcf6b" />
        </radialGradient>
      </defs>
      <g v-for="([x, y], i) in BULBS" :key="i" class="lit" :class="i % 2 ? 'even' : 'odd'">
        <circle :cx="x" :cy="y + 14" r="26" fill="url(#bulb-halo)" />
        <circle :cx="x" :cy="y + 14" r="7" fill="url(#bulb-on)" />
      </g>
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
.walls {
  will-change: transform; /* painted once, then left alone */
}
/* the centre pole, standing between the two cupboards */
.pole {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 16px;
  margin-left: -8px;
  background: linear-gradient(90deg, #5d4326, #9a7747 28%, #7d5e36 55%, #46321b);
  box-shadow: 6px 0 10px rgba(50, 30, 10, 0.3);
}
/* a glass lantern: lit from inside, with a metal cap and foot */
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
  background: radial-gradient(circle at 42% 52%, #fffdf0, #ffe6a3 45%, #eeb95c);
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
.lantern::after,
.lantern i {
  content: '';
  position: absolute;
  left: -6px;
  right: -6px;
  height: 9px;
  border: 2px solid #2a1810;
  border-radius: 3px;
  background: linear-gradient(90deg, #e3bd6c, #a5772c 60%, #6f4d1a);
}
.lantern::after {
  top: -6px;
}
.lantern i {
  display: block;
  bottom: -6px;
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
  box-shadow: 3px 6px 8px rgba(50, 30, 10, 0.35);
  color: #1f2a24;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: clamp(13px, 1.5vw, 19px);
  white-space: nowrap;
}
/* bulbs 1, 3, 5... for one second, then 2, 4, 6... for one second, and repeat */
.lit {
  animation: blink 2s steps(1) infinite;
}
.lit.even {
  animation-delay: -1s;
}
@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
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
  .lantern,
  .lit,
  .lit.even {
    animation: none;
    opacity: 1; /* no flashing: all lights stay on */
  }
}
</style>
