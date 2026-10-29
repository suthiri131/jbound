<script setup>

import { useId } from 'vue';
import { assetUrl } from '@/lib/api';

defineProps({
  page: { type: Object, required: true },
});

const ringId = `badge-ring-${useId()}`;

function decorStyle(decor) {
  const style = { top: `${decor.top}%`, left: `${decor.left}%`, '--tilt': `${decor.rotation}deg`, '--ink': decor.ink };
  if (decor.type === 'splatter') Object.assign(style, { '--size': `${decor.size}cqw`, opacity: decor.opacity });
  if (decor.type === 'scrap') Object.assign(style, { width: `${decor.width}cqw`, height: `${decor.height}cqw`, background: decor.paper });
  return style;
}
</script>

<template>
  <div class="sheet" :class="`sheet-${page.kind}`">
    <span
      v-for="decor in page.decor"
      :key="decor.id"
      class="decor"
      :class="`decor-${decor.type}`"
      :style="decorStyle(decor)"
      aria-hidden="true"
    >{{ decor.text }}</span>

    <!-- front cover -->
    <div v-if="page.kind === 'cover'" class="leather" :style="{ '--cover': page.color }">
      <div class="stitching">
        <svg class="badge" viewBox="0 0 100 100" aria-hidden="true">
          <defs><path :id="ringId" d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" /></defs>
          <circle cx="50" cy="50" r="47" />
          <circle cx="50" cy="50" r="27" />
          <text class="badge-ring"><textPath :href="`#${ringId}`" textLength="216" lengthAdjust="spacing">JBOUND · TRAVEL JOURNAL · {{ page.year }} ·</textPath></text>
          <text class="badge-mark" x="50" y="50">✦</text>
        </svg>
        <h2 class="display cover-title">{{ page.name }}</h2>
        <p class="cover-dates">{{ page.dates }}</p>
        <span class="cover-label hand">Our scrapbook</span>
      </div>
    </div>

    <!-- back cover -->
    <div v-else-if="page.kind === 'back-cover'" class="leather back" :style="{ '--cover': page.color }">
      <div class="stitching">
        <svg class="badge small" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="47" />
          <text class="badge-mark" x="50" y="50">✦</text>
        </svg>
        <p class="hand back-line">Made together · kept forever</p>
      </div>
    </div>

    <!-- inside front cover -->
    <div v-else-if="page.kind === 'title'" class="paper title">
      <p class="eyebrow-ink">This scrapbook belongs to the crew of</p>
      <h2 class="display title-name">{{ page.name }}</h2>
      <span class="date-stamp">{{ page.dates }}</span>
      <p v-if="page.mission" class="hand title-mission">“{{ page.mission }}”</p>
      <p v-if="page.crew.length" class="hand title-crew">with {{ page.crew.join(', ') }}</p>
      <ul class="hand title-stats">
        <li>{{ page.stats.stops }} stops · {{ page.stats.ticked }} ticked</li>
        <li>{{ page.stats.photos }} photo{{ page.stats.photos === 1 ? '' : 's' }}</li>
        <li>{{ page.stats.total }} shared</li>
      </ul>
    </div>

    <!-- polaroids -->
    <div v-else-if="page.kind === 'photos'" class="paper">
      <figure
        v-for="item in page.items"
        :key="item.id"
        class="polaroid"
        :class="[`hold-${item.fastener.type}`, { blank: item.kind === 'placeholder' }]"
        :style="{ top: `${item.top}%`, left: `${item.left}%`, '--tilt': `${item.rotation}deg` }"
      >
        <template v-if="item.fastener.type === 'tape'">
          <span
            v-for="(angle, i) in item.fastener.angles"
            :key="i"
            class="tape"
            :class="i ? 'tape-r' : 'tape-l'"
            :style="{ '--tape-tilt': `${angle}deg`, background: item.fastener.paper }"
            aria-hidden="true"
          />
        </template>
        <span v-else-if="item.fastener.type === 'pin'" class="pin" :style="{ left: `${item.fastener.left}%`, '--ink': item.fastener.ink }" aria-hidden="true" />
        <img v-if="item.kind === 'photo'" :src="assetUrl(item.image)" :alt="item.caption" draggable="false" />
        <div v-else class="photo-slot">
          <span class="plus" aria-hidden="true">+</span>
          <span>{{ item.prompt }}</span>
        </div>
        <figcaption class="hand" :title="item.author ? `${item.caption} — ${item.author}` : item.caption">
          <span class="caption">{{ item.caption }}</span>
          <span v-if="item.author" class="by">— {{ item.author }}</span>
        </figcaption>
      </figure>
      <p class="hand margin-note" :style="{ left: `${page.note.left}%`, '--tilt': `${page.note.rotation}deg` }">{{ page.note.text }}</p>
    </div>

    <!-- bucket list -->
    <div v-else-if="page.kind === 'bucket'" class="paper stack">
      <p class="eyebrow-ink">{{ page.heading }}</p>
      <div
        v-for="stop in page.stops"
        :key="stop.id"
        class="note-card"
        :style="{ '--tilt': `${stop.rotation}deg`, '--shift': `${stop.shift}cqw` }"
      >
        <span class="check" aria-hidden="true">{{ stop.done ? '☑' : '☐' }}</span>
        <div>
          <h3 class="display stop-title">{{ stop.title }}</h3>
          <p class="hand stop-note">{{ stop.note }}</p>
          <span v-if="stop.day" class="stop-day">{{ stop.day }}</span>
        </div>
      </div>
    </div>

    <!-- ledger -->
    <div v-else-if="page.kind === 'ledger'" class="paper stack">
      <p class="eyebrow-ink">The trip ledger</p>
      <div class="receipt" :style="{ '--tilt': `${page.rotation}deg` }">
        <p class="hand receipt-head">Shared adventures, shared tabs.</p>
        <ul v-if="page.lines.length" class="receipt-lines">
          <li v-for="line in page.lines" :key="line.id"><span>{{ line.label }}</span><span>{{ line.amount }}</span></li>
        </ul>
        <p class="receipt-total"><span>Total</span><strong class="display">{{ page.total }}</strong></p>
        <p class="receipt-count">{{ page.count }} expense{{ page.count === 1 ? '' : 's' }} · recorded together</p>
      </div>
      <span class="ink-stamp">SETTLED IN STORIES</span>
    </div>

    <!-- filler page so the back cover lands on its own -->
    <div v-else-if="page.kind === 'notes'" class="paper lined">
      <p class="eyebrow-ink">Notes from the road</p>
      <p v-for="(line, i) in page.lines" :key="i" class="hand lined-text">{{ line }}</p>
    </div>

    <!-- inside back cover -->
    <div v-else-if="page.kind === 'endpaper'" class="paper endpaper">
      <svg class="route" viewBox="0 0 100 130" aria-hidden="true">
        <path d="M12 118 C 30 90, 70 104, 62 72 S 22 46, 46 22 S 84 18, 88 10" />
        <circle cx="12" cy="118" r="2.6" /><circle cx="88" cy="10" r="2.6" />
      </svg>
      <p class="hand endpaper-text">The best parts of the trip are the stories you take home.</p>
    </div>

    <!-- blank back of a page in single-page mode -->
    <div v-else class="paper" />

    <span v-if="page.number" class="page-number hand">{{ page.number }}</span>
  </div>
</template>

<style scoped>
.sheet { position: absolute; inset: 0; overflow: hidden; container-type: size; color: #3C2A21; background-color: #F3EAD3; background-image: radial-gradient(rgba(60,42,33,.08) .6px, transparent .7px); background-size: 7px 7px; }
.paper { position: absolute; inset: 0; padding: 9cqw 8cqw; }
.paper::after { position: absolute; inset: 2.4cqw; border: 1px solid rgba(60,42,33,.12); content: ''; pointer-events: none; }
.stack { display: flex; flex-direction: column; align-items: center; gap: 4cqh; }
.eyebrow-ink { position: relative; z-index: 1; align-self: flex-start; margin: 0; color: #70452f; font-size: 2.6cqw; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
.page-number { position: absolute; bottom: 3.6cqw; left: 50%; z-index: 2; color: #5A4A36; font-size: 4cqw; transform: translateX(-50%); }

/* leather covers */
.leather { position: absolute; inset: 0; padding: 4cqw; color: #FDFBF7; background: radial-gradient(circle at 30% 20%, rgba(255,255,255,.12), transparent 55%), repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 2px, transparent 2px 5px) left / 5cqw 100% no-repeat, var(--cover); }
.stitching { display: flex; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 4cqh; padding: 6cqw; border: 2px dashed rgba(253,251,247,.6); border-radius: 1.5cqw; text-align: center; box-shadow: inset 0 0 0 1.4cqw rgba(44,24,16,.12); }
.badge { width: 36cqw; height: 36cqw; overflow: visible; transform: rotate(-12deg); }
.badge.small { width: 20cqw; height: 20cqw; }
.badge circle { fill: none; stroke: #FDFBF7; stroke-width: 1.6; }
.badge circle + circle { stroke-width: .8; stroke-dasharray: 2 2; }
.badge-ring { fill: #FDFBF7; font-size: 8.4px; font-weight: 900; letter-spacing: .5px; }
.badge-mark { fill: #FDFBF7; font-size: 26px; text-anchor: middle; dominant-baseline: central; }
.cover-title { max-width: 100%; margin: 0; font-size: 9.5cqw; line-height: 1.05; overflow-wrap: anywhere; text-shadow: 2px 3px 0 rgba(44,24,16,.3); }
.cover-dates { margin: 0; font-size: 3.4cqw; letter-spacing: .1em; text-transform: uppercase; }
.cover-label { padding: .6cqw 3cqw; border-radius: 1cqw; color: #3C2A21; font-size: 5.6cqw; background: #F3EAD3; box-shadow: 2px 2px 0 rgba(44,24,16,.35); transform: rotate(-2deg); }
.back-line { margin: 0; font-size: 6cqw; }

/* inside front cover */
.title { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3.2cqh; text-align: center; }
.title .eyebrow-ink { align-self: center; }
.title-name { margin: 0; font-size: 8.4cqw; line-height: 1.05; overflow-wrap: anywhere; }
.date-stamp { padding: 1.2cqw 2.6cqw; border: 2px solid #9E3B1B; border-radius: 4px; color: #9E3B1B; font-size: 2.8cqw; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; box-shadow: inset 0 0 0 2px #F3EAD3, inset 0 0 0 3px #9E3B1B; transform: rotate(-3deg); }
.title-mission, .title-crew { max-width: 92%; margin: 0; font-size: 5.6cqw; line-height: 1.15; }
.title-crew { color: #5A4A36; font-size: 4.8cqw; }
.title-stats { margin: 0; padding: 0; font-size: 5cqw; line-height: 1.3; list-style: none; }

/* polaroids */
.polaroid { position: absolute; z-index: 1; width: 50%; margin: 0; padding: 2.2cqw 2.2cqw 1.4cqw; border: 1px solid #d4c7ab; background: #fffdf7; box-shadow: 1px 4px 10px rgba(44,24,16,.22); transform: rotate(var(--tilt)); }
.polaroid img, .photo-slot { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #e8dec7; }
.photo-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.4cqw; padding: 2cqw; border: 2px dashed rgba(60,42,33,.35); color: #5A4A36; font-family: var(--font-hand); font-size: 4.2cqw; line-height: 1.1; text-align: center; }
.plus { display: grid; width: 8cqw; height: 8cqw; place-items: center; border: 2px solid currentColor; border-radius: 50%; font-family: inherit; font-size: 5cqw; }
.polaroid.blank { border-style: dashed; }
/* the caption gets up to two handwritten lines (the full text is in the tooltip); the author always shows */
.polaroid figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 0 2cqw; min-height: 2.1em; margin-top: 1cqw; font-size: 4cqw; line-height: 1.05; }
.caption { display: -webkit-box; flex: 0 1 auto; overflow: hidden; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
/* sits beside a short caption, or tucks under the last line of a long one */
.by { flex: none; margin-left: auto; color: #5A4A36; font-size: .8em; line-height: 1; }
.tape { position: absolute; z-index: 2; top: -2.2cqw; width: 14cqw; height: 4.4cqw; opacity: .85; box-shadow: 0 1px 2px rgba(44,24,16,.15); transform: rotate(var(--tape-tilt)); }
.tape-l { left: -4cqw; }
.tape-r { right: -4cqw; }
.pin { position: absolute; z-index: 2; top: -1.8cqw; width: 3.8cqw; height: 3.8cqw; border: 1.5px solid #3C2A21; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(255,255,255,.55), transparent 45%), var(--ink); box-shadow: 1px 3px 2px rgba(44,24,16,.3); transform: translateX(-50%); }
.hold-corners::before, .hold-corners::after { position: absolute; z-index: 2; width: 5cqw; height: 5cqw; content: ''; background: #3C2A21; }
.hold-corners::before { top: -1cqw; left: -1cqw; clip-path: polygon(0 0, 100% 0, 0 100%); }
.hold-corners::after { right: -1cqw; bottom: -1cqw; clip-path: polygon(100% 0, 100% 100%, 0 100%); }
/* centred in the gap between the polaroids; a long note takes a second, highlighted line */
.margin-note { position: absolute; top: 48%; z-index: 1; display: -webkit-box; max-width: 72%; margin: 0; padding: 0 2cqw; overflow: hidden; font-size: 5cqw; line-height: 1.2; overflow-wrap: anywhere; background: repeating-linear-gradient(transparent 0 .72em, rgba(223,208,168,.8) .72em 1.2em); -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; transform: translateY(-50%) rotate(var(--tilt)); }

/* bucket list */
.note-card { position: relative; z-index: 1; display: flex; width: 86%; gap: 3cqw; padding: 3.4cqw 4cqw; background: #FDFBF7; box-shadow: 1px 4px 10px rgba(44,24,16,.17); transform: translateX(var(--shift)) rotate(var(--tilt)); }
.note-card::before { position: absolute; inset: 1.4cqw; border: 1px dashed rgba(60,42,33,.3); content: ''; pointer-events: none; }
.note-card::after { position: absolute; top: -1.6cqw; right: 6cqw; width: 11cqw; height: 3.4cqw; content: ''; background: #dfd0a8; transform: rotate(8deg); }
.check { color: #9E3B1B; font-size: 6cqw; line-height: 1; }
.stop-title { margin: 0; font-size: 5.2cqw; line-height: 1.1; overflow-wrap: anywhere; }
.stop-note { margin: .6cqw 0 0; font-size: 4.6cqw; line-height: 1.1; overflow-wrap: anywhere; }
.stop-day { color: #5A4A36; font-size: 2.8cqw; }

/* ledger receipt */
.receipt { position: relative; z-index: 1; width: 80%; padding: 6cqw 6cqw 7cqw; background: #FDFBF7; box-shadow: 1px 4px 10px rgba(44,24,16,.18); transform: rotate(var(--tilt)); clip-path: polygon(0 0, 100% 0, 100% 97%, 95% 100%, 90% 97%, 85% 100%, 80% 97%, 75% 100%, 70% 97%, 65% 100%, 60% 97%, 55% 100%, 50% 97%, 45% 100%, 40% 97%, 35% 100%, 30% 97%, 25% 100%, 20% 97%, 15% 100%, 10% 97%, 5% 100%, 0 97%); }
.receipt-head { margin: 0 0 3cqw; font-size: 5.2cqw; text-align: center; }
.receipt-lines { margin: 0; padding: 0 0 2cqw; border-bottom: 1.5px dashed rgba(60,42,33,.4); list-style: none; font-size: 3.2cqw; }
.receipt-lines li { display: flex; justify-content: space-between; gap: 3cqw; padding: .6cqw 0; }
.receipt-lines li span:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.receipt-total { display: flex; justify-content: space-between; align-items: baseline; margin: 2.4cqw 0 0; font-size: 3.4cqw; font-weight: 800; text-transform: uppercase; }
.receipt-total strong { font-size: 7.6cqw; font-weight: 400; }
.receipt-count { margin: 1.4cqw 0 0; color: #5A4A36; font-size: 2.8cqw; text-align: center; }
.ink-stamp { z-index: 1; padding: 1.2cqw 2cqw; border: 2px dashed #9E3B1B; color: #9E3B1B; font-size: 2.6cqw; font-weight: 900; letter-spacing: .1em; transform: rotate(-5deg); }

/* notes + endpaper */
.lined { background-image: repeating-linear-gradient(transparent 0 calc(9cqw - 1px), rgba(47,74,90,.18) calc(9cqw - 1px) 9cqw); background-position: 0 12cqw; }
.lined-text { position: relative; margin: 0; font-size: 5.6cqw; line-height: 9cqw; }
.lined-text:first-of-type { margin-top: 5cqw; }
.endpaper { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; background: repeating-linear-gradient(45deg, rgba(112,69,47,.06) 0 6px, transparent 6px 12px); }
.route { position: absolute; inset: 10% 12% 22%; width: 76%; height: 68%; }
.route path { fill: none; stroke: #9E3B1B; stroke-width: .8; stroke-dasharray: 2.4 2; }
.route circle { fill: #3C2A21; }
.endpaper-text { position: relative; z-index: 1; max-width: 80%; margin: 0 0 6cqh; font-size: 5.4cqw; text-align: center; }

/* seeded decorations */
.decor { position: absolute; z-index: 0; pointer-events: none; transform: rotate(var(--tilt)); }
.decor-splatter { width: var(--size); height: var(--size); border-radius: 46% 54% 41% 59% / 52% 44% 56% 48%; background: var(--ink); box-shadow: calc(var(--size) * .8) calc(var(--size) * -.2) 0 calc(var(--size) * -.36) var(--ink), calc(var(--size) * -.4) calc(var(--size) * .75) 0 calc(var(--size) * -.4) var(--ink), calc(var(--size) * .45) calc(var(--size) * .9) 0 calc(var(--size) * -.44) var(--ink); }
.decor-scrap { opacity: .85; clip-path: polygon(0 8%, 12% 0, 30% 6%, 52% 0, 74% 7%, 100% 2%, 96% 46%, 100% 92%, 70% 100%, 44% 93%, 20% 100%, 2% 90%); }
.decor-stamp { padding: .8cqw 1.8cqw; border: 2px solid var(--ink); border-radius: 3px; color: var(--ink); font-size: 2.4cqw; font-weight: 900; letter-spacing: .14em; white-space: nowrap; opacity: .5; }
</style>
