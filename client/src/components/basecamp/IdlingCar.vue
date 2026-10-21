<script setup>
import { ref, onBeforeUnmount } from "vue";

const emit = defineEmits(["arrive"]);
const zooming = ref(false);
let timer;

function drive() {
  if (zooming.value) return;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  zooming.value = true;
  timer = setTimeout(() => emit("arrive"), reduce ? 60 : 1150);
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="road">
    <div class="lane" aria-hidden="true" />
    <button
      type="button"
      class="car"
      :class="zooming ? 'zoom' : 'idle'"
      aria-label="Hop in the car and go to your trips"
      data-cy="car"
      @click="drive"
    >
      <svg viewBox="0 0 330 170" aria-hidden="true">
        <g
          class="speed"
          stroke="#F3EAD3"
          stroke-width="5"
          stroke-linecap="round"
        >
          <path d="M-30 70H-110" />
          <path d="M-20 100H-140" />
          <path d="M-40 126H-100" />
        </g>
        <ellipse
          cx="170"
          cy="154"
          rx="140"
          ry="8"
          fill="#2A2117"
          opacity="0.35"
        />
        <circle class="puff" cx="38" cy="128" r="9" fill="#CDB98E" />
        <circle class="puff p2" cx="38" cy="128" r="9" fill="#CDB98E" />
        <circle class="puff p3" cx="38" cy="128" r="9" fill="#CDB98E" />
        <g class="car-body">
          <rect
            x="112"
            y="6"
            width="44"
            height="20"
            rx="3"
            fill="#B4471F"
            stroke="#2A2117"
            stroke-width="3"
          />
          <rect
            x="160"
            y="10"
            width="36"
            height="16"
            rx="3"
            fill="#E0A43B"
            stroke="#2A2117"
            stroke-width="3"
          />
          <path d="M120 16h28M168 18h20" stroke="#2A2117" stroke-width="2" />
          <path
            d="M106 28H204"
            stroke="#2A2117"
            stroke-width="4"
            stroke-linecap="round"
          />
          <path d="M114 28v6M196 28v6" stroke="#2A2117" stroke-width="3" />
          <path
            d="M38 124V90Q38 78 50 76L92 74L110 38Q113 32 120 32H200Q207 32 211 38L232 70L282 76Q300 78 300 94V124Z"
            fill="#2E5A3C"
            stroke="#2A2117"
            stroke-width="4"
            stroke-linejoin="round"
          />
          <path
            d="M118 42L102 70H156V42Z"
            fill="#CFE0D9"
            stroke="#2A2117"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <path
            d="M164 42V70H224L206 42Z"
            fill="#CFE0D9"
            stroke="#2A2117"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <path d="M160 74V122" stroke="#1F3F2A" stroke-width="3" />
          <rect x="168" y="82" width="14" height="5" rx="2" fill="#E0A43B" />
          <rect x="40" y="98" width="258" height="8" fill="#E0A43B" />
          <circle
            cx="294"
            cy="90"
            r="6"
            fill="#F6E2B3"
            stroke="#2A2117"
            stroke-width="2"
          />
          <rect x="38" y="84" width="7" height="12" fill="#B4471F" />
          <rect x="292" y="112" width="16" height="10" rx="3" fill="#2A2117" />
          <rect x="28" y="112" width="14" height="10" rx="3" fill="#2A2117" />
          <circle cx="30" cy="94" r="17" fill="#2A2117" />
          <circle cx="30" cy="94" r="7" fill="#CDB98E" />
          <rect x="40" y="124" width="16" height="6" rx="2" fill="#5A4A36" />
        </g>
        <g class="wheel">
          <circle cx="96" cy="128" r="24" fill="#2A2117" />
          <path d="M96 108v40M76 128h40" stroke="#6E5D47" stroke-width="3" />
          <circle cx="96" cy="128" r="9" fill="#CDB98E" />
        </g>
        <g class="wheel">
          <circle cx="244" cy="128" r="24" fill="#2A2117" />
          <path d="M244 108v40M224 128h40" stroke="#6E5D47" stroke-width="3" />
          <circle cx="244" cy="128" r="9" fill="#CDB98E" />
        </g>
      </svg>
    </button>
    <p class="hint" :style="{ opacity: zooming ? 0 : 1 }" aria-hidden="true">
      vroom vroom!
    </p>
    <RouterLink to="/planner" class="planner-link">Trips →</RouterLink>
  </div>
</template>

<style scoped>
.road {
  position: relative;
  height: clamp(150px, 19vw, 230px);
  background: #4a4038;
  border-top: 10px solid #a69b86;
  overflow: hidden;
}
.lane {
  position: absolute;
  left: 0;
  right: 0;
  top: 70%;
  border-top: 6px dashed var(--paper);
}
.car {
  position: absolute;
  left: 5%;
  bottom: 8%;
  width: clamp(190px, 30%, 340px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.car svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.car:focus-visible {
  outline: 4px solid var(--mustard);
  outline-offset: 6px;
  border-radius: 12px;
}
.wheel {
  transform-box: fill-box;
  transform-origin: center;
}
.car.idle .car-body {
  animation: idle 0.16s steps(2, end) infinite;
}
@keyframes idle {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-1.6px);
  }
}
.puff {
  transform-box: fill-box;
  transform-origin: center;
  animation: puff 1.3s ease-out infinite;
  opacity: 0;
}
.p2 {
  animation-delay: 0.43s;
}
.p3 {
  animation-delay: 0.86s;
}
@keyframes puff {
  0% {
    opacity: 0.85;
    transform: translate(0, 0) scale(0.4);
  }
  100% {
    opacity: 0;
    transform: translate(-46px, -16px) scale(1.7);
  }
}
.speed {
  opacity: 0;
}
.car.zoom {
  animation: zoom 1.15s cubic-bezier(0.62, -0.3, 0.9, 0.45) forwards;
}
.car.zoom .wheel {
  animation: spin 0.22s linear infinite;
}
.car.zoom .puff {
  animation: burst 0.35s ease-out infinite;
}
.car.zoom .speed {
  animation: speed 0.25s 0.2s linear infinite;
}
@keyframes zoom {
  0% {
    transform: translateX(0);
  }
  18% {
    transform: translateX(-18px) rotate(-2deg);
  }
  30% {
    transform: translateX(-10px) rotate(-3deg);
  }
  100% {
    transform: translateX(160vw);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes burst {
  0% {
    opacity: 0.9;
    transform: translate(0, 0) scale(0.6);
  }
  100% {
    opacity: 0;
    transform: translate(-70px, -6px) scale(2.4);
  }
}
@keyframes speed {
  0% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.hint {
  position: absolute;
  left: calc(5% + clamp(190px, 30%, 340px) + 6px);
  top: 10%;
  margin: 0;
  max-width: 34%;
  font-family: var(--font-hand);
  font-size: clamp(18px, 2.2vw, 26px);
  line-height: 1.15;
  color: var(--sand);
  transform: rotate(-3deg);
  transition: opacity 0.2s;
}
.planner-link {
  position: absolute;
  right: 3%;
  top: 12%;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border: 2px solid var(--paper);
  border-radius: 6px;
  background: var(--jungle);
  color: var(--card);
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
}
.planner-link:hover {
  color: var(--card);
}
@media (prefers-reduced-motion: reduce) {
  .car.idle .car-body,
  .puff,
  .car.zoom .wheel,
  .car.zoom .speed {
    animation: none;
  }
  .car.zoom {
    animation: none;
    opacity: 0.4;
  }
}
</style>
