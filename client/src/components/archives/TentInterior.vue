<script setup>
import { useCampSky } from "@/composables/useCampSky";

const { sky } = useCampSky({ weather: false });

// One rope, wall to ridge to wall. Flags and bulbs are worked out from it, so they always hang on the line.
const WALL = [0, 218];
const SAG = [240, 124];
const RIDGE = [500, 14];
const ROPE = `M${WALL} Q${SAG} ${RIDGE} Q${1000 - SAG[0]} ${SAG[1]} ${1000 - WALL[0]} ${WALL[1]}`;
const along = (t) =>
  [0, 1].map(
    (i) =>
      (1 - t) ** 2 * WALL[i] + 2 * t * (1 - t) * SAG[i] + t ** 2 * RIDGE[i],
  );
const mirror = ([x, y]) => [1000 - x, y];

// a triangle whose top edge lies on the rope and whose tip hangs straight down
const flag = (t, place) => {
  const [a, b] = [place(along(t)), place(along(t + 0.052))];
  return `M${a} L${b} L${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 34}Z`;
};
const FLAG_SPOTS = [0.03, 0.1, 0.17, 0.24, 0.31];
const BULB_SPOTS = [0.44, 0.6, 0.76, 0.92];
// numbered left to right along the whole rope, so odd and even take turns
const BULBS = [
  ...BULB_SPOTS.map((t) => along(t)),
  ...[...BULB_SPOTS].reverse().map((t) => mirror(along(t))),
];
const SEAMS = [
  "M500 0 300 700",
  "M500 0 700 700",
  "M500 0 90 700",
  "M500 0 910 700",
];
const FLAGS = ["#e2573c", "#f2b134", "#3f8f86", "#fffdf7", "#2f7fbf"];
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
      <path
        v-for="(d, i) in SEAMS"
        :key="i"
        :d="d"
        stroke="#a07c4b"
        stroke-width="3"
        stroke-dasharray="10 7"
        fill="none"
      />

      <!-- the slopes of the roof, a shade darker either side -->
      <path d="M0 0H500L0 300Z" fill="#b48e5a" />
      <path d="M1000 0H500L1000 300Z" fill="#a78350" />
      <path
        d="M0 300 500 0 1000 300"
        fill="none"
        stroke="#7d5e36"
        stroke-width="10"
      />

      <!-- mesh window on the real sky -->
      <g>
        <path id="tent-vent" d="M500 26 590 96H410Z" :fill="sky.top" />
        <path d="M410 96H590L500 26Z" :fill="sky.bottom" opacity=".5" />
        <circle v-if="sky.showSun" cx="538" cy="66" r="11" fill="#fff1b8" />
        <circle v-if="sky.showMoon" cx="538" cy="66" r="9" fill="#fff6d8" />
        <path
          d="M455 96 500 26M545 96 500 26M500 96V26M432 80H568M455 60H545"
          stroke="#6f5532"
          stroke-width="1.4"
          opacity=".55"
        />
        <path
          d="M500 26 590 96H410Z"
          fill="none"
          stroke="#7d5e36"
          stroke-width="7"
          stroke-linejoin="round"
        />
      </g>

      <!-- the rope, its bunting and its lights -->
      <path :d="ROPE" fill="none" stroke="#5d4326" stroke-width="2.5" />
      <path
        v-for="(t, i) in FLAG_SPOTS"
        :key="`l${i}`"
        :d="flag(t, (p) => p)"
        :fill="FLAGS[(i + 1) % 5]"
      />
      <path
        v-for="(t, i) in FLAG_SPOTS"
        :key="`r${i}`"
        :d="flag(t, mirror)"
        :fill="FLAGS[(i + 3) % 5]"
      />
      <g v-for="([x, y], i) in BULBS" :key="i">
        <path :d="`M${x} ${y}v6`" stroke="#5d4326" stroke-width="2.5" />
        <circle
          :cx="x"
          :cy="y + 13"
          r="7"
          fill="#a98f5c"
          stroke="#5d4326"
          stroke-width="1.6"
        />
        <g class="lit" :class="i % 2 ? 'even' : 'odd'">
          <circle :cx="x" :cy="y + 13" r="19" fill="#ffe7a8" opacity=".4" />
          <circle
            :cx="x"
            :cy="y + 13"
            r="7"
            fill="#fff0bd"
            stroke="#5d4326"
            stroke-width="1.6"
          />
        </g>
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
  content: "";
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
