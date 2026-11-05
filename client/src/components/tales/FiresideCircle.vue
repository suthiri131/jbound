<script setup>
import Campfire from "@/components/scene/Campfire.vue";

defineProps({
  night: { type: Boolean, default: false },
});

const SKIN = { kai: "#a0663c", mei: "#f3d2b3", raj: "#6e4325", lin: "#e8b48a" };

// little thought clouds drifting up from each head into the big bubble: [x, y, r]
const THOUGHTS = [
  [172, 28, 4],
  [186, 9, 6.5],
  [470, 15, 4],
  [552, 72, 4],
  [540, 48, 6],
  [526, 20, 9],
  [252, 76, 4],
  [264, 50, 6],
  [276, 22, 9],
];
</script>

<template>
  <svg class="circle" viewBox="0 0 720 215" aria-hidden="true">
    <!-- the worn patch of ground the ring sits on -->
    <ellipse cx="360" cy="148" rx="290" ry="66" fill="#d9bb82" opacity=".45" />

    <!-- Mei: far side, facing us and turned in towards the fire -->
    <g transform="translate(478 75) scale(.62)">
      <rect
        x="-44"
        y="0"
        width="88"
        height="23"
        rx="11"
        fill="#6b4426"
        stroke="#2a1810"
        stroke-width="3"
      />
      <ellipse
        cx="38"
        cy="11.5"
        rx="6"
        ry="11"
        fill="#c49a6c"
        stroke="#2a1810"
        stroke-width="2.5"
      />
      <path d="M-20-66c-5 22-6 42-3 58h46c3-16 2-36-3-58Z" fill="#2b1d14" />
      <rect x="-16" y="-42" width="32" height="46" rx="11" fill="#e86fa0" />
      <!-- knees forward, shins down to the ground -->
      <g stroke="#2f4858" stroke-width="13" stroke-linecap="round" fill="none">
        <path d="M-10 0-11 18" />
        <path d="M10 0 11 18" />
      </g>
      <path
        d="M-20 18h17v6h-19c0-3 0-6 2-6ZM3 18h17c2 0 2 3 2 6H3Z"
        fill="#2a2117"
      />
      <rect x="-6" y="-48" width="12" height="10" fill="#dcb595" />
      <g class="chat c-mei">
        <circle cy="-60" r="17" :fill="SKIN.mei" />
        <path
          d="M-17-58a17 17 0 0 1 34 0c-5-6-13-9-20-9-4 4-9 6-14 9Z"
          fill="#2b1d14"
        />
        <circle cx="-9" cy="-58" r="2.1" fill="#1b1410" />
        <circle cx="2" cy="-58" r="2.1" fill="#1b1410" />
        <ellipse cx="-12" cy="-52" rx="3" ry="2" fill="#e98a7a" opacity=".6" />
        <path
          class="smile"
          d="M-8-51c2 2 4 2 6 0"
          fill="none"
          stroke="#1b1410"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <ellipse
          class="talk-mouth"
          cx="-5"
          cy="-50"
          rx="2.6"
          ry="2.2"
          fill="#7a2a22"
        />
      </g>
      <path
        d="M14-36 21-20 12-6"
        fill="none"
        stroke="#c9548a"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="11" cy="-4" r="5.5" :fill="SKIN.mei" />
      <g class="hand c-mei" style="transform-origin: -14px -36px">
        <path
          d="M-14-36-28-24-33-40"
          fill="none"
          stroke="#e86fa0"
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="-34" cy="-45" r="5.5" :fill="SKIN.mei" />
      </g>
    </g>

    <!-- Kai: left of the fire, side on, facing right -->
    <g transform="translate(156 95) scale(.68)">
      <path
        d="M-30-12h30l14 12v24h-30Z"
        fill="#6b4426"
        stroke="#2a1810"
        stroke-width="3"
        stroke-linejoin="round"
        transform="translate(-4 0)"
      />
      <ellipse
        cx="-3"
        cy="11"
        rx="14"
        ry="13"
        fill="#c49a6c"
        stroke="#2a1810"
        stroke-width="3"
      />
      <ellipse
        cx="-3"
        cy="11"
        rx="7"
        ry="6.5"
        fill="none"
        stroke="#8a5a34"
        stroke-width="2"
      />
      <g class="hand c-kai" style="transform-origin: 2px -34px">
        <path
          d="M2-34 20-26 31-42"
          fill="none"
          stroke="#256aa1"
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="33" cy="-47" r="5.5" :fill="SKIN.kai" />
      </g>
      <path
        d="M0-4 32-6 36 18"
        fill="none"
        stroke="#2c2a27"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M26 18h14c5 0 8 3 8 6H26Z"
        fill="#2a2117"
        transform="translate(4 0)"
      />
      <path
        d="M0-6C-3-18-1-28 3-36"
        fill="none"
        stroke="#2f7fbf"
        stroke-width="26"
        stroke-linecap="round"
      />
      <path
        d="M2-4 36-4 42 18"
        fill="none"
        stroke="#3d3a36"
        stroke-width="13"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M32 18h14c5 0 8 3 8 6H32Z" fill="#2a2117" />
      <rect x="0" y="-52" width="12" height="12" :fill="SKIN.kai" />
      <g class="chat c-kai">
        <circle cx="8" cy="-60" r="17" :fill="SKIN.kai" />
        <circle cx="25" cy="-57" r="3" :fill="SKIN.kai" />
        <path d="M-9-62c0 8 3 13 8 16l3-14Z" fill="#1b1410" />
        <path d="M-9-64a17 17 0 0 1 34 0Z" fill="#256aa1" />
        <path d="M24-65h13c0 4-3 5-6 5H22Z" fill="#1d5580" />
        <circle cx="17" cy="-60" r="2.1" fill="#1b1410" />
        <ellipse cx="14" cy="-53" rx="3" ry="2" fill="#e98a7a" opacity=".5" />
        <path
          class="smile"
          d="M16-50c2 1 4 1 6-1"
          fill="none"
          stroke="#1b1410"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <ellipse
          class="talk-mouth"
          cx="19"
          cy="-49.5"
          rx="2.6"
          ry="2.2"
          fill="#5a1f18"
        />
      </g>
      <path
        d="M0-33 10-14 26-10"
        fill="none"
        stroke="#2f7fbf"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="29" cy="-9" r="5.5" :fill="SKIN.kai" />
    </g>

    <Campfire :night="night" x="300" y="48" width="120" height="112" />

    <!-- Raj: right of the fire and nearer us, side on, facing left -->
    <g transform="translate(564 149) scale(-.82 .82)">
      <path
        d="M-30-12h30l14 12v24h-30Z"
        fill="#6b4426"
        stroke="#2a1810"
        stroke-width="3"
        stroke-linejoin="round"
        transform="translate(-4 0)"
      />
      <ellipse
        cx="-3"
        cy="11"
        rx="14"
        ry="13"
        fill="#c49a6c"
        stroke="#2a1810"
        stroke-width="3"
      />
      <ellipse
        cx="-3"
        cy="11"
        rx="7"
        ry="6.5"
        fill="none"
        stroke="#8a5a34"
        stroke-width="2"
      />
      <path
        d="M2-34 16-20 30-26"
        fill="none"
        stroke="#c98f27"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="34" cy="-27" r="5.5" :fill="SKIN.raj" />
      <path
        d="M0-4 32-6 36 18"
        fill="none"
        stroke="#3f5a2e"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M26 18h14c5 0 8 3 8 6H26Z"
        fill="#2a2117"
        transform="translate(4 0)"
      />
      <path
        d="M0-6C-3-18-1-28 3-36"
        fill="none"
        stroke="#f2b134"
        stroke-width="26"
        stroke-linecap="round"
      />
      <path
        d="M2-4 36-4 42 18"
        fill="none"
        stroke="#4f6d3a"
        stroke-width="13"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M32 18h14c5 0 8 3 8 6H32Z" fill="#2a2117" />
      <rect x="0" y="-52" width="12" height="12" :fill="SKIN.raj" />
      <g class="chat c-raj">
        <circle cx="8" cy="-60" r="17" :fill="SKIN.raj" />
        <circle cx="25" cy="-57" r="3" :fill="SKIN.raj" />
        <g fill="#1b1410">
          <circle cx="-8" cy="-60" r="7" />
          <circle cx="-6" cy="-71" r="7.5" />
          <circle cx="4" cy="-77" r="7.5" />
          <circle cx="15" cy="-76" r="7" />
          <circle cx="-6" cy="-51" r="5.5" />
        </g>
        <circle cx="17" cy="-60" r="2.1" fill="#fff6e8" />
        <circle cx="17.4" cy="-60" r="1.3" fill="#1b1410" />
        <ellipse cx="14" cy="-53" rx="3" ry="2" fill="#e98a7a" opacity=".35" />
        <path
          class="smile"
          d="M16-50c2 1 4 1 6-1"
          fill="none"
          stroke="#1b1410"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <ellipse
          class="talk-mouth"
          cx="19"
          cy="-49.5"
          rx="2.6"
          ry="2.2"
          fill="#3a120d"
        />
      </g>
      <g class="hand c-raj" style="transform-origin: 0px -33px">
        <path
          d="M0-33 18-22 33-32"
          fill="none"
          stroke="#f2b134"
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="37" cy="-36" r="5.5" :fill="SKIN.raj" />
      </g>
    </g>

    <!-- Lin: nearest us, back to the viewer, head turned in towards the fire -->
    <g transform="translate(242 165) scale(.85)">
      <rect
        x="-46"
        y="0"
        width="92"
        height="24"
        rx="12"
        fill="#6b4426"
        stroke="#2a1810"
        stroke-width="3"
      />
      <ellipse
        cx="-40"
        cy="12"
        rx="6"
        ry="11.5"
        fill="#c49a6c"
        stroke="#2a1810"
        stroke-width="2.5"
      />
      <path d="M-16-42h32l3 44c0 4-3 6-7 6h-24c-4 0-7-2-7-6Z" fill="#3f8f5b" />
      <path d="M0-42h16l3 44c0 4-3 6-7 6H0Z" fill="#37804f" />
      <path
        d="M-15-36-22-12"
        fill="none"
        stroke="#37804f"
        stroke-width="10"
        stroke-linecap="round"
      />
      <circle cx="-23" cy="-7" r="5.5" :fill="SKIN.lin" />
      <rect x="-6" y="-48" width="12" height="10" :fill="SKIN.lin" />
      <g class="chat c-lin">
        <circle cy="-60" r="17" :fill="SKIN.lin" />
        <path
          d="M-17-60a17 17 0 0 1 34-1c-1 8-4 13-9 16-8 3-16 2-20-3-3-3-5-8-5-12Z"
          fill="#b5793a"
        />
        <circle cx="-1" cy="-81" r="8.5" fill="#b5793a" />
        <path d="M17-62c1 6 0 11-4 15l-3-2c4-3 5-8 5-13Z" :fill="SKIN.lin" />
        <circle cx="13" cy="-56" r="2.6" :fill="SKIN.lin" />
      </g>
      <g class="hand c-lin" style="transform-origin: 14px -36px">
        <path
          d="M14-36 31-28 38-44"
          fill="none"
          stroke="#3f8f5b"
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="40" cy="-49" r="5.5" :fill="SKIN.lin" />
      </g>
    </g>

    <circle
      v-for="([x, y, r], i) in THOUGHTS"
      :key="i"
      class="thought"
      :cx="x"
      :cy="y"
      :r="r"
    />
  </svg>
</template>

<style scoped>
.circle {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.thought {
  fill: #fdf3da;
  stroke: #1f2a24;
  stroke-width: 2.5;
}
/* a shared 12s loop: each camper talks for their own quarter of it, then listens */
.hand {
  animation: gesture 12s ease-in-out infinite;
}
.chat {
  animation: nod 12s ease-in-out infinite;
  transform-origin: 6px -44px;
}
.talk-mouth {
  opacity: 0;
  animation: mouth 12s linear infinite;
}
.smile {
  animation: smile 12s linear infinite;
}
.c-kai,
.c-kai .talk-mouth,
.c-kai .smile {
  animation-delay: 0s;
}
.c-mei,
.c-mei .talk-mouth,
.c-mei .smile {
  animation-delay: -9s;
}
.c-raj,
.c-raj .talk-mouth,
.c-raj .smile {
  animation-delay: -6s;
}
.c-lin,
.c-lin .talk-mouth,
.c-lin .smile {
  animation-delay: -3s;
}
@keyframes gesture {
  0%,
  26%,
  100% {
    transform: rotate(0deg);
  }
  5%,
  15% {
    transform: rotate(-20deg);
  }
  10%,
  20% {
    transform: rotate(8deg);
  }
}
@keyframes nod {
  0%,
  26%,
  100% {
    transform: rotate(0deg);
  }
  7%,
  18% {
    transform: rotate(4deg);
  }
  12% {
    transform: rotate(-2deg);
  }
}
@keyframes mouth {
  0%,
  25.9%,
  100% {
    opacity: 0;
  }
  1%,
  25% {
    opacity: 1;
  }
}
@keyframes smile {
  0%,
  25.9%,
  100% {
    opacity: 1;
  }
  1%,
  25% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hand,
  .chat,
  .talk-mouth,
  .smile {
    animation: none;
  }
}
</style>
