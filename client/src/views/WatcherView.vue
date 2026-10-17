<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/utils/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEVEL_COLOR = { Low: 'var(--jungle)', Medium: 'var(--mustard)', High: 'var(--ember)' };

const sgNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'long', hour: '2-digit', hour12: false }).formatToParts(new Date());
  return { day: DAYS.indexOf(parts.find((p) => p.type === 'weekday').value), hour: Number(parts.find((p) => p.type === 'hour').value) % 24 };
};

const now = sgNow();
const q = reactive({ checkpoint: 'woodlands', direction: 'to_jb', day: now.day, hour: now.hour, holiday: false });
const est = ref(null);
const cams = ref(null);
const camError = ref('');
const estError = ref('');
let camTimer;

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
const level = computed(() => est.value?.selected?.level ?? 'Low');
const score = computed(() => est.value?.selected?.score ?? 0);
const isNow = computed(() => q.day === now.day && q.hour === now.hour);
// Needle angle: score 0 → -90deg, 100 → +90deg
const needle = computed(() => -90 + (score.value / 100) * 180);

async function loadEstimate() {
  estError.value = '';
  try {
    const { data } = await api.get(`/checkpoints/${q.checkpoint}/congestion`, {
      params: { direction: q.direction, day: q.day, hour: q.hour, holiday: q.holiday || undefined },
    });
    est.value = data;
  } catch (err) {
    estError.value = errorMessage(err);
  }
}

async function loadCameras() {
  try {
    const { data } = await api.get(`/checkpoints/${q.checkpoint}/cameras`);
    cams.value = data;
    camError.value = '';
  } catch (err) {
    cams.value = null;
    camError.value = err?.response?.status === 503
      ? 'Live cameras need an LTA DataMall key on the server (LTA_ACCOUNT_KEY). The estimate above still works.'
      : errorMessage(err, 'Cameras unavailable right now');
  }
}

watch(q, loadEstimate, { deep: true, immediate: true });
watch(() => q.checkpoint, loadCameras);
onMounted(() => {
  loadCameras();
  camTimer = setInterval(loadCameras, 60_000); // LTA image links expire after ~5 min
});
onBeforeUnmount(() => clearInterval(camTimer));

function resetNow() {
  const n = sgNow();
  q.day = n.day;
  q.hour = n.hour;
}
</script>

<template>
  <main class="container page">
    <span class="tag-stamp" style="color: var(--teal)">Watcher</span>
    <h1 class="display display-lg" style="margin-top: 16px">How bad is the jam?</h1>
    <p class="lead">Typical queue patterns for each checkpoint, plus the live LTA cameras. Slide through the day to find a quieter time.</p>

    <section class="controls row" aria-label="Checkpoint and direction">
      <div class="segmented" role="group" aria-label="Checkpoint">
        <button type="button" :aria-pressed="q.checkpoint === 'woodlands'" @click="q.checkpoint = 'woodlands'">Woodlands</button>
        <button type="button" :aria-pressed="q.checkpoint === 'tuas'" @click="q.checkpoint = 'tuas'">Tuas</button>
      </div>
      <div class="segmented" role="group" aria-label="Direction">
        <button type="button" :aria-pressed="q.direction === 'to_jb'" @click="q.direction = 'to_jb'">SG → JB</button>
        <button type="button" :aria-pressed="q.direction === 'to_sg'" @click="q.direction = 'to_sg'">JB → SG</button>
      </div>
      <label class="field" style="flex-direction: row; align-items: center; gap: 8px">Day
        <select v-model.number="q.day" class="select" style="width: auto">
          <option v-for="(d, i) in DAYS" :key="d" :value="i">{{ d }}</option>
        </select>
      </label>
      <label class="row" style="gap: 8px; font-weight: 700; font-size: 14px">
        <input v-model="q.holiday" type="checkbox" style="width: 20px; height: 20px" /> Public / school holiday
      </label>
    </section>

    <div class="split">
      <section class="card card-pad gauge-card" aria-label="Congestion estimate" data-cy="gauge">
        <p class="eyebrow">{{ isNow ? 'Right now' : `${DAYS[q.day]} ${hourLabel(q.hour)}` }} · {{ q.checkpoint === 'tuas' ? 'Tuas Second Link' : 'Woodlands Causeway' }}</p>
        <svg viewBox="0 0 240 140" class="dial" role="img" :aria-label="`Estimated congestion ${level}, score ${score} of 100`">
          <path d="M20 120a100 100 0 0 1 66-94" fill="none" stroke="#2E5A3C" stroke-width="22" />
          <path d="M86 26a100 100 0 0 1 68 0" fill="none" stroke="#E0A43B" stroke-width="22" />
          <path d="M154 26a100 100 0 0 1 66 94" fill="none" stroke="#B4471F" stroke-width="22" />
          <g :style="{ transform: `rotate(${needle}deg)`, transformOrigin: '120px 120px', transition: 'transform .5s' }">
            <path d="M120 120 116 116 120 36 124 116Z" fill="#2A2117" />
          </g>
          <circle cx="120" cy="120" r="10" fill="#2A2117" />
        </svg>
        <p class="display level" :style="{ color: LEVEL_COLOR[level] }">{{ level }}</p>
        <p class="muted" style="margin: 0; text-align: center">score {{ score }} / 100</p>

        <label class="field" style="margin-top: 18px">Time of day · {{ hourLabel(q.hour) }}
          <input v-model.number="q.hour" type="range" min="0" max="23" step="1" aria-label="Hour of day" data-cy="hour-slider" />
        </label>
        <button v-if="!isNow" type="button" class="btn btn-sm btn-ghost" style="margin-top: 8px" @click="resetNow">Back to now</button>

        <p v-if="est?.bestHours?.length" class="best">
          <strong>Quieter times:</strong>
          <button v-for="h in est.bestHours" :key="h" type="button" class="pill best-pill" @click="q.hour = h">{{ hourLabel(h) }}</button>
        </p>
        <p v-if="estError" class="error-text">{{ estError }}</p>
        <p class="muted disclaimer">{{ est?.disclaimer }}</p>
      </section>

      <section class="card card-pad" aria-label="Whole day">
        <h2 class="display display-sm">The whole day</h2>
        <div class="bars" role="list">
          <button
            v-for="h in est?.hourly || []"
            :key="h.hour"
            type="button"
            role="listitem"
            class="bar"
            :class="{ sel: h.hour === q.hour }"
            :style="{ height: `${Math.max(6, h.score)}%`, background: LEVEL_COLOR[h.level] }"
            :aria-label="`${hourLabel(h.hour)}: ${h.level}`"
            :title="`${hourLabel(h.hour)} · ${h.level}`"
            @click="q.hour = h.hour"
          />
        </div>
        <div class="axis muted"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </section>
    </div>

    <section class="cams" aria-label="Live cameras">
      <div class="row" style="justify-content: space-between; align-items: baseline">
        <h2 class="display display-md">Live cameras</h2>
        <span v-if="cams" class="muted" style="font-size: 13px">Updated {{ timeAgo(cams.fetchedAt) }} · {{ cams.source }} · refreshes every minute</span>
      </div>
      <p v-if="camError" class="card-flat card-pad" role="status" style="margin-top: 12px">{{ camError }}</p>
      <div class="cam-grid">
        <figure v-for="c in cams?.cameras || []" :key="c.cameraId" class="card cam">
          <img :src="c.imageUrl" :alt="`Live traffic camera: ${c.label}`" loading="lazy" />
          <figcaption>
            <strong>{{ c.label }}</strong>
            <span class="pill" :style="{ background: LEVEL_COLOR[c.estimate.level], color: c.estimate.level === 'Medium' ? 'var(--ink)' : 'var(--card)' }">usually {{ c.estimate.level }} now</span>
          </figcaption>
        </figure>
      </div>
      <!-- TODO(team): optional — show GET /api/checkpoints/:id/snapshots as a "last few hours" strip -->
    </section>
  </main>
</template>

<style scoped>
.controls { margin-top: 24px; }
.split { display: grid; grid-template-columns: minmax(280px, 1fr) 2fr; gap: 24px; margin-top: 24px; }
.gauge-card { display: flex; flex-direction: column; }
.dial { width: 100%; max-width: 320px; margin: 12px auto 0; display: block; }
.level { margin: 4px 0 0; text-align: center; font-size: 40px; }
input[type='range'] { accent-color: var(--teal); min-height: 44px; }
.best { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 14px 0 0; font-size: 14px; }
.best-pill { min-height: 32px; background: var(--sage); cursor: pointer; }
.disclaimer { margin: 14px 0 0; font-size: 12px; }
.bars { display: flex; align-items: flex-end; gap: 4px; height: 240px; margin-top: 18px; padding-bottom: 4px; border-bottom: 2px solid var(--ink); }
.bar { flex: 1; min-width: 0; border: 1.5px solid var(--ink); border-bottom: 0; border-radius: 4px 4px 0 0; cursor: pointer; padding: 0; opacity: .75; }
.bar.sel { opacity: 1; outline: 3px solid var(--ink); outline-offset: 1px; }
.axis { display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; }
.cams { margin-top: 40px; }
.cam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 16px; }
.cam { margin: 0; overflow: hidden; }
.cam img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-bottom: 2px solid var(--ink); background: var(--mist); }
.cam figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 14px; }
@media (max-width: 860px) { .split { grid-template-columns: 1fr; } }
</style>
