<script setup>

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

const props = defineProps({
  pages: { type: Array, required: true },
  label: { type: String, default: 'Scrapbook' },
});

const SINGLE_PAGE_BELOW = 640; // stage width in px
const PAGE_RATIO = 4 / 3; // height / width
const FLIP_MS = 850;
const DRAG_THRESHOLD = 10;
const BLANK = { id: 'blank', kind: 'blank' };

const stage = ref(null);
const stageWidth = ref(0);
const viewportHeight = ref(window.innerHeight);
const reducedMotion = ref(false);
const turned = ref(0);
const turning = reactive(new Map()); // leaf index -> timer, while its flip animation runs
const drag = ref(null);
const instant = ref(false);
let pointer = null;
let swallowClick = false;
let resizeObserver;
let motionQuery;

const flipMs = computed(() => (reducedMotion.value ? 0 : FLIP_MS));
const single = computed(() => (stageWidth.value || window.innerWidth) < SINGLE_PAGE_BELOW);
const leaves = computed(() => {
  if (single.value) return props.pages.map((page) => ({ key: `s-${page.id}`, front: page, back: BLANK }));
  const out = [];
  for (let i = 0; i < props.pages.length; i += 2) {
    out.push({ key: `d-${props.pages[i].id}`, front: props.pages[i], back: props.pages[i + 1] || BLANK });
  }
  return out;
});
// in single-page mode the last page has to stay on screen, so it never turns
const maxTurned = computed(() => (single.value ? Math.max(props.pages.length - 1, 0) : leaves.value.length));
const isClosed = computed(() => turned.value === 0);
const canNext = computed(() => turned.value < maxTurned.value);
const canPrev = computed(() => turned.value > 0);

const pageWidth = computed(() => {
  const available = stageWidth.value || window.innerWidth - 32;
  // keep a whole page on screen below the nav and the controls
  const fitsHeight = Math.max(280, (viewportHeight.value - 230) / PAGE_RATIO);
  const width = single.value ? Math.min(available, 460, fitsHeight) : Math.min(available / 2, 520, fitsHeight);
  return Math.floor(width);
});

// a closed book shows a single page, so slide it to keep that page centred
const bookShift = computed(() => {
  if (single.value) return 0;
  if (turned.value === 0) return -pageWidth.value / 2;
  if (turned.value === leaves.value.length) return pageWidth.value / 2;
  return 0;
});
const bookStyle = computed(() => ({
  '--page-w': `${pageWidth.value}px`,
  '--page-h': `${Math.round(pageWidth.value * PAGE_RATIO)}px`,
  '--flip-ms': `${instant.value ? 0 : flipMs.value}ms`,
  width: `${pageWidth.value * (single.value ? 1 : 2)}px`,
  transform: `translateX(${bookShift.value}px)`,
}));

const pageLabel = computed(() => {
  const paperPages = Math.max(props.pages.length - 2, 0);
  const t = turned.value;
  if (t === 0) return 'Front cover';
  if (single.value) return t === props.pages.length - 1 ? 'Back cover' : `Page ${t} of ${paperPages}`;
  if (t === leaves.value.length) return 'Back cover';
  return `Pages ${2 * t - 1}–${2 * t} of ${paperPages}`;
});

function leafStyle(index) {
  const dragging = drag.value?.index === index;
  const isTurned = index < turned.value;
  const angle = dragging ? drag.value.angle : isTurned ? -180 : 0;
  const count = leaves.value.length;
  const z = dragging || turning.has(index) ? count + 2 : isTurned ? index + 1 : count - index;
  return {
    zIndex: z,
    transform: `perspective(2400px) rotateY(${angle}deg)`,
    transition: dragging ? 'none' : undefined,
    '--shade': dragging ? (Math.sin(drag.value.progress * Math.PI) * 0.35).toFixed(3) : 0,
  };
}

/** Leaves far from the open spread are hidden so they don't paint (or bleed through). */
function leafHidden(index) {
  if (drag.value?.index === index || turning.has(index)) return false;
  const t = turned.value;
  if (single.value) return index < t || index > t + 1;
  return index < t - 2 || index > t + 1;
}

function faceShowing(index, side) {
  if (side === 'front') return index === turned.value;
  return !single.value && index === turned.value - 1;
}

function markTurning(index) {
  clearTimeout(turning.get(index));
  turning.set(index, setTimeout(() => turning.delete(index), flipMs.value + 60));
}

function turn(direction) {
  const target = turned.value + direction;
  if (target < 0 || target > maxTurned.value) return;
  markTurning(direction > 0 ? turned.value : turned.value - 1);
  turned.value = target;
}

function closeBook() {
  for (let i = 0; i < turned.value; i++) markTurning(i);
  turned.value = 0;
}

// --- dragging / swiping ---------------------------------------------------

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, direction: 0, index: -1 };
}

function onPointerMove(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.direction) {
    if (Math.abs(dx) < DRAG_THRESHOLD) {
      if (Math.abs(dy) > DRAG_THRESHOLD) pointer = null; // vertical scroll, not a page turn
      return;
    }
    const direction = dx < 0 ? 1 : -1;
    if ((direction > 0 && !canNext.value) || (direction < 0 && !canPrev.value)) {
      pointer = null;
      return;
    }
    pointer.direction = direction;
    pointer.index = direction > 0 ? turned.value : turned.value - 1;
    try {
      stage.value?.setPointerCapture?.(event.pointerId);
    } catch {
      // the pointer was already released; the drag still works without capture
    }
  }
  // dragging across about one page width turns it all the way
  const span = pageWidth.value * (single.value ? 0.9 : 1.4);
  const progress = Math.min(Math.max((pointer.direction > 0 ? -dx : dx) / span, 0), 1);
  drag.value = {
    index: pointer.index,
    progress,
    angle: pointer.direction > 0 ? -180 * progress : -180 * (1 - progress),
  };
}

function onPointerUp(event, cancelled = false) {
  if (!pointer || event.pointerId !== pointer.id) return;
  const { direction } = pointer;
  pointer = null;
  if (!drag.value) return;
  const { index, progress } = drag.value;
  drag.value = null;
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 0);
  markTurning(index);
  if (!cancelled && progress > 0.3) turned.value += direction;
}

function onClickCapture(event) {
  if (!swallowClick) return;
  event.stopPropagation();
  event.preventDefault();
}

function onKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'ArrowRight') turn(1);
  else if (event.key === 'ArrowLeft') turn(-1);
}

// --- sizing ---------------------------------------------------------------

function measure() {
  stageWidth.value = stage.value?.clientWidth || 0;
  viewportHeight.value = window.innerHeight;
}
function onMotionChange(event) {
  reducedMotion.value = event.matches;
}

// switching between spreads and single pages: stay on the same page, without animating
watch(single, (isSingle) => {
  const t = turned.value;
  instant.value = true;
  turned.value = isSingle ? (t === 0 ? 0 : Math.min(2 * t - 1, props.pages.length - 1)) : Math.ceil(t / 2);
  requestAnimationFrame(() => requestAnimationFrame(() => { instant.value = false; }));
});

watch(() => props.pages, () => {
  turned.value = 0;
  drag.value = null;
});

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(stage.value);
  }
  window.addEventListener('resize', measure);
  window.addEventListener('keydown', onKeydown);
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  reducedMotion.value = Boolean(motionQuery?.matches);
  motionQuery?.addEventListener?.('change', onMotionChange);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', measure);
  window.removeEventListener('keydown', onKeydown);
  motionQuery?.removeEventListener?.('change', onMotionChange);
  turning.forEach((timer) => clearTimeout(timer));
});

defineExpose({ turn, closeBook, turned, single });
</script>

<template>
  <section class="scrapbook" :aria-label="label" aria-roledescription="book">
    <div
      ref="stage"
      class="stage"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp($event, true)"
      @click.capture="onClickCapture"
    >
      <div class="book" :class="{ single, closed: isClosed }" :style="bookStyle">
        <div v-if="!single" v-show="turned > 0" class="stack stack-left" aria-hidden="true" />
        <div v-show="single || turned < leaves.length" class="stack stack-right" aria-hidden="true" />

        <div
          v-for="(leaf, index) in leaves"
          :key="leaf.key"
          class="leaf"
          :class="{ turning: turning.has(index), offstage: leafHidden(index) }"
          :style="leafStyle(index)"
        >
          <div class="face front" :aria-hidden="!faceShowing(index, 'front')">
            <slot name="page" :page="leaf.front" />
            <span class="spine-shade" />
            <span class="turn-shade" />
          </div>
          <div class="face back" :aria-hidden="!faceShowing(index, 'back')">
            <slot name="page" :page="leaf.back" />
            <span class="spine-shade" />
            <span class="turn-shade" />
          </div>
        </div>

        <button v-if="isClosed" type="button" class="open-cover" aria-label="Open the scrapbook" @click="turn(1)" />
        <button v-if="canPrev" type="button" class="corner corner-prev" aria-label="Turn back a page" @click="turn(-1)" />
        <button v-if="canNext && !isClosed" type="button" class="corner corner-next" aria-label="Turn to the next page" @click="turn(1)" />
      </div>
    </div>

    <div class="controls">
      <button type="button" class="btn btn-sm" aria-label="Previous page" :disabled="!canPrev" @click="turn(-1)">← Previous</button>
      <span class="hand page-label" aria-live="polite">{{ pageLabel }}</span>
      <button type="button" class="btn btn-sm" aria-label="Next page" :disabled="!canNext" @click="turn(1)">Next →</button>
    </div>
    <p class="hand hint">
      {{ isClosed ? 'Tap the cover to open it' : 'Drag or swipe a page, tap a corner, or use the ← → keys' }}
    </p>
    <button v-if="!isClosed" type="button" class="close-book" @click="closeBook">Close the scrapbook</button>
  </section>
</template>

<style scoped>
.scrapbook { display: flex; flex-direction: column; align-items: center; }
/* clip keeps a page swinging out of a single-page book from widening the page */
.stage { display: flex; width: 100%; justify-content: center; padding: 14px 0 22px; overflow-x: clip; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.book { position: relative; height: var(--page-h); transition: transform var(--flip-ms) cubic-bezier(.3, .7, .2, 1); }

.stack { position: absolute; top: 0; width: var(--page-w); height: var(--page-h); background: #EFE4C8; }
.stack-left { left: 0; border-radius: 6px 0 0 6px; box-shadow: -1px 1px 0 #E2D5B4, -2px 2px 0 #D8CBA9, -3px 3px 0 #E2D5B4, -4px 4px 0 #CDBF9C, -10px 10px 0 rgba(60, 42, 33, .3); }
.stack-right { right: 0; border-radius: 0 6px 6px 0; box-shadow: 1px 1px 0 #E2D5B4, 2px 2px 0 #D8CBA9, 3px 3px 0 #E2D5B4, 4px 4px 0 #CDBF9C, 10px 10px 0 rgba(60, 42, 33, .3); }
.single .stack-right { left: 0; }

.leaf { position: absolute; top: 0; left: var(--page-w); width: var(--page-w); height: var(--page-h); transform-origin: left center; transform-style: preserve-3d; transition: transform var(--flip-ms) cubic-bezier(.3, .7, .2, 1); }
.single .leaf { left: 0; }
.leaf.offstage { visibility: hidden; }
.face { position: absolute; inset: 0; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 0 6px 6px 0; }
.face.back { border-radius: 6px 0 0 6px; transform: rotateY(180deg); }
.single .face.back { border-radius: 0 6px 6px 0; }

/* the fold into the spine, and a shadow that sweeps across a page as it turns */
.spine-shade, .turn-shade { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.front .spine-shade { background: linear-gradient(90deg, rgba(60, 42, 33, .22), rgba(60, 42, 33, .05) 6%, transparent 14%); }
.back .spine-shade { background: linear-gradient(270deg, rgba(60, 42, 33, .22), rgba(60, 42, 33, .05) 6%, transparent 14%); }
.turn-shade { background: linear-gradient(90deg, rgba(44, 24, 16, .5), transparent 70%); opacity: var(--shade, 0); }
.back .turn-shade { background: linear-gradient(270deg, rgba(44, 24, 16, .5), transparent 70%); }
.leaf.turning .turn-shade { animation: sweep var(--flip-ms) ease-in-out; }
@keyframes sweep { 0%, 100% { opacity: 0; } 50% { opacity: .35; } }

.open-cover { position: absolute; z-index: 100; top: 0; left: var(--page-w); width: var(--page-w); height: var(--page-h); border: 0; border-radius: 0 6px 6px 0; background: transparent; cursor: pointer; }
.single .open-cover { left: 0; }
.open-cover:focus-visible { outline: 3px solid #D9A441; outline-offset: 4px; }
.book.closed:hover { transform: translateX(calc(var(--page-w) / -2)) rotate(-1deg) !important; }
.book.single.closed:hover { transform: rotate(-1deg) !important; }

/* page corners: a little dog-ear that grows on hover */
.corner { position: absolute; z-index: 100; bottom: 0; width: 56px; height: 56px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.corner::before { position: absolute; bottom: 0; width: 22px; height: 22px; content: ''; background: linear-gradient(var(--fold-dir), #E2D5B4 50%, transparent 50%); box-shadow: 0 0 0 rgba(0, 0, 0, 0); transition: width .2s ease, height .2s ease; }
.corner-next { right: 0; }
.corner-next::before { right: 0; --fold-dir: 315deg; border-top-left-radius: 4px; filter: drop-shadow(-2px -2px 2px rgba(44, 24, 16, .25)); }
.corner-prev { left: 0; }
.corner-prev::before { left: 0; --fold-dir: 45deg; border-top-right-radius: 4px; filter: drop-shadow(2px -2px 2px rgba(44, 24, 16, .25)); }
.corner:hover::before, .corner:focus-visible::before { width: 40px; height: 40px; }
.corner:focus-visible { outline: 3px solid #D9A441; outline-offset: -3px; }

.controls { display: flex; width: min(100%, 560px); justify-content: space-between; align-items: center; gap: 10px; }
.controls .btn { white-space: nowrap; }
.page-label { color: #3C2A21; font-size: 22px; white-space: nowrap; }
.hint { margin: 10px 0 0; color: #5A4A36; font-size: 19px; text-align: center; }
.close-book { margin-top: 12px; padding: 7px 12px; border: 1.5px dashed #3C2A21; border-radius: 8px; background: #FDFBF7; color: #3C2A21; cursor: pointer; }

</style>
