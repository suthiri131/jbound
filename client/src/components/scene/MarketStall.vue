<script setup>

import { computed } from 'vue';
import SoftPaint from './SoftPaint.vue';

const props = defineProps({
  stacks: { type: Array, default: () => [] }, // [{ id, initial, amount, tint }]
  night: { type: Boolean, default: false },
});

const MAX_COINS = 8;
const COUNTER_Y = 318; // where the coins sit, part way back on the counter top
const COIN_H = 9;
const shown = computed(() => {
  const most = Math.max(...props.stacks.map((s) => s.amount), 1);
  const list = props.stacks.slice(0, 6);
  return list.map((s, i) => ({
    ...s,
    x: 150 + i * (250 / Math.max(list.length - 1, 1)) * (list.length > 1 ? 1 : 0),
    coins: s.amount > 0 ? Math.max(1, Math.round((s.amount / most) * MAX_COINS)) : 0,
  }));
});

// The awning: stripes converge towards the back of the slope, then drop as a scalloped valance at the front.
const STRIPE_COUNT = 10;
const BACK = { x: 104, w: 43.2, y: 16 };
const FRONT = { x: 50, w: 54, y: 72 };
const STRIPES = Array.from({ length: STRIPE_COUNT }, (_, i) => {
  const backX = BACK.x + i * BACK.w;
  const frontX = FRONT.x + i * FRONT.w;
  return {
    slope: `M${backX} ${BACK.y}h${BACK.w}L${frontX + FRONT.w} ${FRONT.y}h${-FRONT.w}Z`,
    valance: `M${frontX} ${FRONT.y}h${FRONT.w}v26a${FRONT.w / 2} 20 0 0 1 ${-FRONT.w} 0Z`,
    striped: i % 2 === 0,
  };
});
// jars on the shelf: x, top, width, colour
const JARS = [
  [134, 170, 36, '#e0a43b'],
  [178, 184, 28, '#c94f3d'],
  [434, 186, 30, '#f4efe2'],
  [472, 168, 38, '#3f8f86'],
];
const SHELF_Y = 214;
</script>

<template>
  <SoftPaint />
  <svg class="stall" viewBox="0 0 640 520" aria-hidden="true">
    <defs>
      <!-- light from the top left: a rounded thing is bright on its left and turns away on its right -->
      <linearGradient id="stall-round" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#fff" stop-opacity=".12" />
        <stop offset="28%" stop-color="#fff" stop-opacity=".38" />
        <stop offset="58%" stop-color="#000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000" stop-opacity=".32" />
      </linearGradient>
      <linearGradient id="stall-post" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#8a5a34" />
        <stop offset="35%" stop-color="#6b4227" />
        <stop offset="100%" stop-color="#37200f" />
      </linearGradient>
      <linearGradient id="stall-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2f1b0f" />
        <stop offset="30%" stop-color="#533420" />
        <stop offset="100%" stop-color="#5f3c24" />
      </linearGradient>
      <linearGradient id="stall-side-l" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6e4629" />
        <stop offset="100%" stop-color="#3f2515" />
      </linearGradient>
      <linearGradient id="stall-side-r" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stop-color="#553420" />
        <stop offset="100%" stop-color="#301b0e" />
      </linearGradient>
      <linearGradient id="stall-slope" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity=".26" />
        <stop offset="100%" stop-color="#000" stop-opacity=".05" />
      </linearGradient>
      <linearGradient id="stall-valance" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity=".24" />
        <stop offset="45%" stop-color="#000" stop-opacity=".06" />
        <stop offset="100%" stop-color="#000" stop-opacity=".16" />
      </linearGradient>
      <linearGradient id="stall-counter-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8f5e34" />
        <stop offset="100%" stop-color="#c58e58" />
      </linearGradient>
      <linearGradient id="stall-counter" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6c4023" />
        <stop offset="12%" stop-color="#855430" />
        <stop offset="100%" stop-color="#6d4225" />
      </linearGradient>
      <linearGradient id="stall-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#e3bd6c" />
        <stop offset="60%" stop-color="#a5772c" />
        <stop offset="100%" stop-color="#6f4d1a" />
      </linearGradient>
      <radialGradient id="stall-glass" cx="42%" cy="52%" r="65%">
        <stop offset="0%" stop-color="#fffdf0" />
        <stop offset="50%" stop-color="#ffe6a3" />
        <stop offset="100%" stop-color="#eeb95c" />
      </radialGradient>
      <radialGradient id="stall-glass-off" cx="38%" cy="40%" r="75%">
        <stop offset="0%" stop-color="#fbf2cf" />
        <stop offset="100%" stop-color="#cdb477" />
      </radialGradient>
      <radialGradient id="stall-halo">
        <stop offset="0%" stop-color="#ffd27a" stop-opacity=".55" />
        <stop offset="100%" stop-color="#ffd27a" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="stall-coin-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffdf85" />
        <stop offset="100%" stop-color="#eaa628" />
      </linearGradient>
      <linearGradient id="stall-coin-edge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#e9ab35" />
        <stop offset="100%" stop-color="#9b6714" />
      </linearGradient>
    </defs>

    <g filter="url(#soft-paint-dark)">
      <ellipse cx="320" cy="498" rx="318" ry="20" fill="#000" opacity=".26" />

      <!-- inside the stall: back wall set behind two side walls -->
      <rect x="130" y="72" width="380" height="240" fill="url(#stall-wall)" stroke="#2a1810" stroke-width="2" />
      <path d="M130 170H510M130 255H510" stroke="#3a2212" stroke-width="2" opacity=".6" />
      <path d="M100 72 130 72V312L100 330Z" fill="url(#stall-side-l)" stroke="#2a1810" stroke-width="2" stroke-linejoin="round" />
      <path d="M540 72 510 72V312L540 330Z" fill="url(#stall-side-r)" stroke="#2a1810" stroke-width="2" stroke-linejoin="round" />

      <!-- shelf: its top, its front edge and the shadow under it -->
      <rect x="130" :y="SHELF_Y + 13" width="380" height="12" fill="#1c0e06" opacity=".32" />
      <rect x="130" :y="SHELF_Y - 7" width="380" height="8" fill="#9a6a3e" />
      <rect x="130" :y="SHELF_Y + 1" width="380" height="12" fill="#5f3a21" stroke="#2a1810" stroke-width="2" />

      <!-- jars -->
      <g v-for="[x, top, w, colour] in JARS" :key="x">
        <rect :x="x + 4" :y="top + 3" :width="w" :height="SHELF_Y - top - 3" rx="4" fill="#1c0e06" opacity=".3" />
        <rect :x="x" :y="top" :width="w" :height="SHELF_Y - top" rx="4" :fill="colour" />
        <rect :x="x" :y="top" :width="w" :height="SHELF_Y - top" rx="4" fill="url(#stall-round)" stroke="#2a1810" stroke-width="2.2" />
        <rect :x="x + 3" :y="top - 7" :width="w - 6" height="8" rx="2" fill="url(#stall-post)" stroke="#2a1810" stroke-width="2" />
      </g>

      <!-- the awning's shadow across the inside -->
      <rect x="100" y="72" width="440" height="58" fill="#120803" opacity=".36" />

      <!-- posts -->
      <rect x="84" y="72" width="20" height="418" fill="url(#stall-post)" stroke="#2a1810" stroke-width="2.2" />
      <rect x="536" y="72" width="20" height="418" fill="url(#stall-post)" stroke="#2a1810" stroke-width="2.2" />

      <!-- lantern, hanging inside on the right -->
      <circle v-if="night" cx="486" cy="164" r="72" fill="url(#stall-halo)" />
      <path d="M486 112v28" stroke="#2a1810" stroke-width="3" />
      <rect x="473" y="144" width="26" height="36" rx="5" :fill="night ? 'url(#stall-glass)' : 'url(#stall-glass-off)'" stroke="#2a1810" stroke-width="2.6" />
      <rect x="468" y="138" width="36" height="9" rx="2.5" fill="url(#stall-metal)" stroke="#2a1810" stroke-width="2" />
      <rect x="468" y="177" width="36" height="9" rx="2.5" fill="url(#stall-metal)" stroke="#2a1810" stroke-width="2" />

      <!-- awning: the slope going back, the rail, the valance hanging at the front -->
      <rect :x="BACK.x - 8" :y="BACK.y - 8" :width="BACK.w * STRIPE_COUNT + 16" height="10" rx="3" fill="url(#stall-post)" stroke="#2a1810" stroke-width="2.2" />
      <path v-for="(s, i) in STRIPES" :key="`slope${i}`" :d="s.slope" :fill="s.striped ? '#e0758c' : '#fbf1e4'" stroke="#2a1810" stroke-width="2.2" stroke-linejoin="round" />
      <path :d="`M${BACK.x} ${BACK.y}H${BACK.x + BACK.w * STRIPE_COUNT}L${FRONT.x + FRONT.w * STRIPE_COUNT} ${FRONT.y}H${FRONT.x}Z`" fill="url(#stall-slope)" />
      <g v-for="(s, i) in STRIPES" :key="`valance${i}`">
        <path :d="s.valance" :fill="s.striped ? '#d66780' : '#efe3d0'" />
        <path :d="s.valance" fill="url(#stall-valance)" stroke="#2a1810" stroke-width="2.2" />
      </g>
      <rect x="46" y="66" width="548" height="11" rx="3" fill="#b24a61" stroke="#2a1810" stroke-width="2.4" />
      <rect x="49" y="68" width="542" height="3" rx="1.5" fill="#fff" opacity=".28" />

      <!-- sign: hung on chains, throwing a shadow on the wall behind -->
      <rect x="192" y="143" width="268" height="52" rx="6" fill="#120803" opacity=".32" />
      <path d="M250 112v24M390 112v24" stroke="#2a1810" stroke-width="3" stroke-dasharray="5 2" />
      <rect x="186" y="136" width="268" height="52" rx="6" fill="#8a5a34" stroke="#2a1810" stroke-width="3" />
      <path d="M189 139H451" stroke="#c3925f" stroke-width="2.4" />
      <path d="M189 185H451" stroke="#5b371d" stroke-width="3" />
      <rect x="196" y="146" width="248" height="33" rx="3" fill="#fbf6e9" stroke="#5b371d" stroke-width="1.6" />

      <!-- counter: the top coming towards you, a lip, then the planked front -->
      <path d="M104 298H536L570 326H70Z" fill="url(#stall-counter-top)" stroke="#2a1810" stroke-width="2.4" stroke-linejoin="round" />
      <rect x="84" y="340" width="472" height="150" fill="url(#stall-counter)" stroke="#2a1810" stroke-width="2.4" />
      <path d="M84 390H434M84 440H434" stroke="#4d2d17" stroke-width="3" />
      <path d="M84 393H434M84 443H434" stroke="#a8784a" stroke-width="1.6" opacity=".7" />
      <!-- the raised panel on the right -->
      <rect x="434" y="340" width="122" height="150" fill="#5f3820" stroke="#2a1810" stroke-width="2.4" />
      <rect x="448" y="356" width="94" height="118" rx="2" fill="#6d4427" stroke="#2a1810" stroke-width="2" />
      <path d="M450 472V358H540" fill="none" stroke="#3b2110" stroke-width="3" />
      <path d="M450 472H540V358" fill="none" stroke="#936339" stroke-width="2.4" />
      <rect x="70" y="326" width="500" height="15" rx="3" fill="#a9703f" stroke="#2a1810" stroke-width="2.4" />
      <rect x="73" y="329" width="494" height="3" rx="1.5" fill="#fff" opacity=".2" />
      <rect x="86" y="341" width="468" height="11" fill="#1c0e06" opacity=".3" />
      <rect x="78" y="484" width="484" height="10" rx="2" fill="#3a2212" stroke="#2a1810" stroke-width="2.2" />

      <!-- cash box: front, top and right side -->
      <path d="M466 318 528 318 544 306 544 312 530 324H466Z" fill="#1c0e06" opacity=".32" />
      <rect x="458" y="268" width="70" height="50" rx="3" fill="#2f5f8a" stroke="#2a1810" stroke-width="2.4" />
      <path d="M458 268 472 256H542L528 268Z" fill="#5a8cb7" stroke="#2a1810" stroke-width="2.4" stroke-linejoin="round" />
      <path d="M528 268 542 256V306L528 318Z" fill="#1f4465" stroke="#2a1810" stroke-width="2.4" stroke-linejoin="round" />
      <rect x="468" y="277" width="50" height="18" rx="2" fill="#a8d4e6" stroke="#2a1810" stroke-width="1.8" />
      <path d="M472 293 484 279M484 293 494 281" stroke="#fff" stroke-width="2" opacity=".6" />
      <rect x="486" y="304" width="14" height="5" rx="1.5" fill="url(#stall-metal)" stroke="#2a1810" stroke-width="1.4" />

      <!-- crates: front, top and side, with slats -->
      <g stroke="#2a1810" stroke-width="2.4" stroke-linejoin="round">
        <path d="M566 430 578 420H636V480L626 490V430Z" fill="#5f3c20" />
        <rect x="556" y="430" width="70" height="60" fill="#8a5a34" />
        <path d="M556 430 568 420H636L626 430Z" fill="#b98753" />
        <rect x="566" y="388" width="50" height="42" fill="#a9703f" />
        <path d="M566 388 576 380H626L616 388Z" fill="#cda06b" />
        <path d="M616 388 626 380V420L616 430Z" fill="#6d4427" />
      </g>
      <path d="M556 450H626M556 470H626M566 402H616M566 416H616" stroke="#4d2d17" stroke-width="2" />
    </g>

    <!-- real numbers and real text stay out of the paint, so they stay crisp -->
    <text x="320" y="170" text-anchor="middle" class="sign">The Market Stall</text>

    <g v-for="s in shown" :key="s.id">
      <ellipse :cx="s.x + 5" :cy="COUNTER_Y + 3" rx="28" ry="8" fill="#1c0e06" opacity=".32" />
      <g v-for="n in s.coins" :key="n">
        <path
          :d="`M${s.x - 24} ${COUNTER_Y - 6 - (n - 1) * COIN_H}v${COIN_H - 3}a24 8 0 0 0 48 0v${3 - COIN_H}Z`"
          fill="url(#stall-coin-edge)"
          stroke="#6d450c"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <ellipse
          :cx="s.x"
          :cy="COUNTER_Y - 6 - (n - 1) * COIN_H"
          rx="24"
          ry="8"
          fill="url(#stall-coin-top)"
          stroke="#6d450c"
          stroke-width="2"
        />
      </g>
      <rect :x="s.x - 13" y="349" width="30" height="24" rx="4" fill="#1c0e06" opacity=".32" />
      <rect :x="s.x - 15" y="346" width="30" height="24" rx="4" :fill="s.tint" stroke="#2a1810" stroke-width="2" />
      <text :x="s.x" y="363" text-anchor="middle" class="tag">{{ s.initial }}</text>
    </g>
  </svg>
</template>

<style scoped>
.stall {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  will-change: transform; /* painted once on its own layer, so the moving sky doesn't redo the paint */
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
