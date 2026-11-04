<script setup>
import { computed } from 'vue';
import { flatSky } from '@/lib/camp/sky';
import SkyBackdrop from '@/components/scene/SkyBackdrop.vue';

const props = defineProps({
  checkpoint: { type: String, default: 'woodlands' },
  direction: { type: String, default: 'to_jb' },
  score: { type: Number, default: 0 },
  hour: { type: Number, default: 12 },
  holiday: { type: Boolean, default: false },
  condition: { type: String, default: 'clear' },
});

const sky = computed(() => flatSky({ hours: props.hour, condition: props.condition }));
const COLORS = ['#e2573c', '#fffdf7', '#2f7fbf', '#f2b134', '#2e6b46', '#b48ad8', '#3a3f47', '#3f8f86'];

// Traffic: 4 cars on an empty road, bumper to bumper at 100. Busier also means slower.
const count = computed(() => Math.round(4 + (props.score / 100) * 30));
const duration = computed(() => 9 + (props.score / 100) * 46);
const cars = computed(() => Array.from({ length: count.value }, (_, i) => ({
  id: i,
  lane: i % 2,
  color: COLORS[(i * 5 + 2) % COLORS.length],
  delay: -(((i + (i % 2) * 0.5) / count.value) * duration.value),
  truck: i % 7 === 3,
})));
const toJb = computed(() => props.direction === 'to_jb');
const isTuas = computed(() => props.checkpoint === 'tuas');
const FLAGS = ['#e2573c', '#f2b134', '#3f8f86', '#fffdf7', '#2f7fbf'];
const PIERS = [12, 28, 44, 60, 76, 92];
</script>

<template>
  <div class="crossing" :class="{ tuas: isTuas, night: sky.night }" aria-hidden="true">
    <SkyBackdrop :sky="sky" :path="false" />
    <div class="water" :style="{ filter: sky.landFilter }">
      <i class="ripple" style="left: 8%; top: 30%" /><i class="ripple" style="left: 58%; top: 18%" /><i class="ripple" style="left: 80%; top: 66%" /><i class="ripple" style="left: 30%; top: 74%" />
    </div>

    <div class="deck" :style="{ filter: sky.landFilter }">
      <!-- the bridge itself: Tuas stands on tall piers, the Causeway is a solid low wall -->
      <template v-if="isTuas">
        <i v-for="x in PIERS" :key="x" class="pier" :style="{ left: `${x}%` }" />
      </template>
      <i v-else class="wall" />
      <div class="road"><i class="dash" /></div>
    </div>

    <div class="lanes" :class="{ reverse: !toJb }" :style="{ '--dur': `${duration}s`, filter: sky.night ? 'brightness(.75)' : 'none' }">
      <svg
        v-for="c in cars"
        :key="c.id"
        class="car"
        :class="[`lane-${c.lane}`, { truck: c.truck }]"
        :viewBox="c.truck ? '0 0 92 40' : '0 0 64 34'"
        :style="{ animationDelay: `${c.delay}s`, '--at': `${(c.id / cars.length) * 100}%` }"
      >
        <g v-if="c.truck">
          <rect x="2" y="4" width="58" height="26" rx="3" :fill="c.color" stroke="#1f2a24" stroke-width="2" />
          <path d="M62 12h14l12 10v8H62Z" fill="#fffdf7" stroke="#1f2a24" stroke-width="2" />
          <path d="M67 15h7l7 7H67Z" fill="#a8d4e6" />
          <circle cx="18" cy="32" r="6" fill="#1f2a24" /><circle cx="74" cy="32" r="6" fill="#1f2a24" />
        </g>
        <g v-else>
          <path d="M4 24c0-6 3-8 10-8l8-11h20l12 11c6 0 8 3 8 8v3H4Z" :fill="c.color" stroke="#1f2a24" stroke-width="2" />
          <path d="M26 8h7v8H20ZM36 8h5l8 8H36Z" fill="#a8d4e6" />
          <circle cx="17" cy="27" r="6" fill="#1f2a24" /><circle cx="50" cy="27" r="6" fill="#1f2a24" />
          <circle v-if="sky.night" cx="60" cy="21" r="3" fill="#ffe6a3" />
        </g>
      </svg>
    </div>

    <!-- a sign at each end: the left one is always Singapore -->
    <div class="post sg"><span>SINGAPORE</span></div>
    <div class="post jb"><span>JOHOR BAHRU</span></div>

    <svg v-if="holiday" class="bunting" viewBox="0 0 1000 60" preserveAspectRatio="none">
      <path d="M0 6Q250 56 500 18T1000 6" fill="none" stroke="#fffdf7" stroke-width="2" />
      <path
        v-for="i in 20"
        :key="i"
        :d="`M${(i - 1) * 50 + 8} ${16 + Math.sin(i / 3) * 12}l18 0l-9 22Z`"
        :fill="FLAGS[i % FLAGS.length]"
      />
    </svg>
  </div>
</template>

<style scoped>
.crossing {
  position: absolute;
  inset: 0;
  overflow: hidden;
  container-type: inline-size;
}
.water {
  position: absolute;
  inset: 52% 0 0;
  background: linear-gradient(#5aa3c4, #3f86aa);
}
.ripple {
  position: absolute;
  width: 90px;
  height: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.35);
}
.deck {
  position: absolute;
  inset: 58% 0 0;
}
.road {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 86px;
  background: #b5aea2;
  border-top: 7px solid #8d867a;
  border-bottom: 10px solid #7d766b;
}
.dash {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  background: repeating-linear-gradient(90deg, #fffdf7 0 34px, transparent 34px 58px);
}
.wall {
  position: absolute;
  left: 0;
  right: 0;
  top: 86px;
  height: 46px;
  background: repeating-linear-gradient(90deg, #a2988a 0 60px, #958b7d 60px 62px);
}
.pier {
  position: absolute;
  top: 86px;
  bottom: 0;
  width: 30px;
  margin-left: -15px;
  background: #958b7d;
}

/* ---------- traffic ---------- */
.lanes {
  position: absolute;
  inset: 58% 0 auto;
  height: 86px;
}
.car {
  position: absolute;
  left: 0;
  width: 58px;
  height: auto;
  animation: drive var(--dur) linear infinite;
}
.car.truck {
  width: 84px;
}
.lane-0 {
  top: 2px;
}
.lane-1 {
  top: 40px;
  z-index: 1;
}
@keyframes drive {
  from {
    transform: translateX(-100px);
  }
  to {
    transform: translateX(calc(100cqw + 20px));
  }
}
.reverse .car {
  animation-name: drive-back;
}
@keyframes drive-back {
  from {
    transform: translateX(calc(100cqw + 20px)) scaleX(-1);
  }
  to {
    transform: translateX(-100px) scaleX(-1);
  }
}

/* ---------- signs ---------- */
.post {
  position: absolute;
  bottom: calc(42% + 4px);
  z-index: 2;
}
.post.sg {
  left: 2%;
}
.post.jb {
  right: 2%;
}
.post span {
  padding: 3px 9px;
  border: 2px solid #1f2a24;
  border-radius: 6px;
  background: #fffdf7;
  color: #1f2a24;
  font-family: var(--font-round);
  font-weight: 700;
  font-size: clamp(10px, 1.1cqw, 13px);
  letter-spacing: 0.08em;
}
.bunting {
  position: absolute;
  left: 0;
  right: 0;
  top: 42%;
  width: 100%;
  height: 60px;
}

@media (prefers-reduced-motion: reduce) {
  /* a still photo of the queue */
  .car,
  .reverse .car {
    animation: none;
    left: var(--at);
  }
  .reverse .car {
    transform: scaleX(-1);
  }
}
@media (max-width: 640px) {
  .post {
    display: none; /* the verdict sign needs the room; the SG/JB toggle already says which way */
  }
  .car {
    width: 42px;
  }
  .car.truck {
    width: 60px;
  }
}
</style>
