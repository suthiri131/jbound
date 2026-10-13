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
