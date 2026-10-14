<script setup>
/**
 * The Basecamp house. Pure SVG art + four RouterLink doors positioned on top
 * (percentages of the 1000×720 artboard). Doors swing open on hover/focus.
 * Props carry the live one-liners shown on each door's plaque.
 */
defineProps({
  watcherSub: { type: String, default: "Check the queue" },
  talesSub: { type: String, default: "Read and share reviews" },
  ledgerSub: { type: String, default: "Split costs in S$ and RM" },
  archivesSub: { type: String, default: "Past trip scrapbooks" },
});
</script>

<template>
  <div class="house">
    <svg viewBox="0 0 1000 720" aria-hidden="true" class="art">
      <rect width="1000" height="720" fill="#E9DDBF" />
      <circle cx="140" cy="118" r="48" fill="#E0A43B" />
      <path
        d="M250 120q10-10 20 0q10-10 20 0M310 90q8-8 16 0q8-8 16 0M820 150q9-9 18 0q9-9 18 0"
        fill="none"
        stroke="#2A2117"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M0 500C140 430 300 470 430 440S720 400 1000 460V720H0Z"
        fill="#CBD5B0"
      />
      <path
        d="M0 560C180 520 320 560 520 540S820 520 1000 560V720H0Z"
        fill="#B5C495"
      />
      <!-- tree -->
      <rect
        x="58"
        y="520"
        width="22"
        height="168"
        fill="#6B4A2B"
        stroke="#2A2117"
        stroke-width="3"
      />
      <circle
        cx="40"
        cy="520"
        r="42"
        fill="#2E5A3C"
        stroke="#2A2117"
        stroke-width="3"
      />
      <circle
        cx="104"
        cy="512"
        r="44"
        fill="#2E5A3C"
        stroke="#2A2117"
        stroke-width="3"
      />
      <circle
        cx="70"
        cy="470"
        r="58"
        fill="#3B6E49"
        stroke="#2A2117"
        stroke-width="3"
      />
      <!-- chimney + smoke -->
      <rect
        x="692"
        y="150"
        width="60"
        height="160"
        fill="#9E3B1B"
        stroke="#2A2117"
        stroke-width="4"
      />
      <path
        d="M692 180h60M692 210h60M692 240h60M712 150v30M732 180v30M712 210v30"
        stroke="#7A2D14"
        stroke-width="2"
      />
      <rect x="684" y="138" width="76" height="16" fill="#2A2117" />
      <!-- ground floor -->
      <rect
        x="130"
        y="430"
        width="740"
        height="256"
        fill="#E4C796"
        stroke="#2A2117"
        stroke-width="5"
      />
      <path
        d="M132 470H868M132 510H868M132 550H868M132 590H868M132 630H868M132 670H868"
        stroke="#C9A46A"
        stroke-width="2"
      />
      <!-- roof -->
      <polygon
        points="66,442 500,68 934,442"
        fill="#B4471F"
        stroke="#2A2117"
        stroke-width="5"
        stroke-linejoin="round"
      />
      <path
        d="M407 150H593M337 210H663M268 270H732M198 330H802M128 390H872"
        stroke="#8E3718"
        stroke-width="3"
        stroke-dasharray="18 10"
      />
      <polygon
        points="170,432 500,145 830,432"
        fill="#D9B37E"
        stroke="#2A2117"
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M436 200H564M390 240H610M344 280H656M297 320H703M251 360H749M205 400H795"
        stroke="#B58B55"
        stroke-width="2"
      />
    </svg>
  </div>
</template>

<style scoped>
.house {
  position: relative;
  width: 100%;
  aspect-ratio: 1000 / 720;
  container-type: inline-size;
}
.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.door {
  position: absolute;
  display: block;
  text-decoration: none;
  color: var(--ink);
}
.door:focus-visible {
  outline: 4px solid var(--mustard);
  outline-offset: 4px;
  border-radius: 6px;
}
.plaque {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border: 2px solid var(--ink);
  border-radius: 5px;
  box-shadow: 2px 2px 0 var(--ink);
  text-align: center;
  white-space: nowrap;
  line-height: 1.1;
  transition: transform 0.2s;
}
.plaque-title {
  font-family: var(--font-display);
  font-size: clamp(8px, 1.6cqw, 18px);
}
.plaque-sub {
  font-weight: 700;
  font-size: clamp(6px, 1.02cqw, 12px);
  color: var(--ink-soft);
  margin-top: 0.2em;
}
.door:hover .plaque,
.door:focus-visible .plaque {
  transform: translateY(-3px) rotate(-1.5deg);
}
.door-frame {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  perspective: 700px;
}
.door-frame svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.door-leaf {
  transform-origin: left center;
  transition: transform 0.45s cubic-bezier(0.3, 0.7, 0.35, 1);
}
.door:hover .door-leaf,
.door:focus-visible .door-leaf {
  transform: rotateY(-48deg);
}
.glow {
  opacity: 0;
  transition: opacity 0.3s;
}
.door:hover .glow,
.door:focus-visible .glow {
  opacity: 1;
}

.sign {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--jungle);
  color: var(--card);
  border: 2px solid var(--ink);
  border-radius: 3px;
  font-weight: 800;
  font-size: clamp(6px, 1.15cqw, 13px);
  text-decoration: none;
  white-space: nowrap;
  clip-path: polygon(0 0, 89% 0, 100% 50%, 89% 100%, 0 100%);
  transition: transform 0.2s;
}
.sign:hover,
.sign:focus-visible {
  color: var(--card);
  transform: translateX(4px);
}

.smoke {
  transform-box: fill-box;
  transform-origin: center;
  animation: rise 4.2s ease-out infinite;
  opacity: 0;
}
.s2 {
  animation-delay: 1.4s;
}
.s3 {
  animation-delay: 2.8s;
}
@keyframes rise {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.5);
  }
  20% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
    transform: translate(34px, -96px) scale(1.9);
  }
}
</style>
