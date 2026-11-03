<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { api, API_URL, errorMessage } from '@/lib/api';
import { timeAgo } from '@/utils/format';
import { useCampSky } from '@/composables/useCampSky';
import CrossingScene from '@/components/watcher/CrossingScene.vue';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const sgNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'long', hour: '2-digit', hour12: false }).formatToParts(new Date());
  return { day: DAYS.indexOf(parts.find((p) => p.type === 'weekday').value), hour: Number(parts.find((p) => p.type === 'hour').value) % 24 };
};

const now = sgNow();
console.log('[Watcher] setup', { page: window.location.href, apiUrl: API_URL, singaporeTime: now });
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
const { condition } = useCampSky();

async function loadEstimate() {
  estError.value = '';
  console.log('[Watcher] loading congestion', { ...q });
  try {
    const { data } = await api.get(`/checkpoints/${q.checkpoint}/congestion`, {
      params: { direction: q.direction, day: q.day, hour: q.hour, holiday: q.holiday || undefined },
    });
    est.value = data;
    console.log('[Watcher] congestion loaded', { selected: data?.selected, hourlyCount: data?.hourly?.length });
  } catch (err) {
    console.error('[Watcher] congestion failed', { message: err.message, status: err.response?.status, code: err.code });
    estError.value = errorMessage(err);
  }
}

async function loadCameras() {
  console.log('[Watcher] loading cameras', { checkpoint: q.checkpoint });
  try {
    const { data } = await api.get(`/checkpoints/${q.checkpoint}/cameras`);
    cams.value = data;
    camError.value = '';
    console.log('[Watcher] cameras loaded', { checkpoint: data?.checkpoint?.id, count: data?.cameras?.length, fetchedAt: data?.fetchedAt });
  } catch (err) {
    console.error('[Watcher] cameras failed', { message: err.message, status: err.response?.status, code: err.code });
    cams.value = null;
    camError.value = err?.response?.status === 503
      ? 'Live cameras need an LTA DataMall key on the server (LTA_ACCOUNT_KEY). The estimate above still works.'
      : errorMessage(err, 'Cameras unavailable right now');
  }
}

watch(q, loadEstimate, { deep: true, immediate: true });
watch(() => q.checkpoint, loadCameras);
onMounted(() => {
  console.log('[Watcher] mounted');
  loadCameras();
  camTimer = setInterval(loadCameras, 60_000); // LTA image links expire after ~5 min
});
onBeforeUnmount(() => {
  console.log('[Watcher] unmounting');
  clearInterval(camTimer);
});

function resetNow() {
  const n = sgNow();
  q.day = n.day;
  q.hour = n.hour;
}

// zoom in for border images
const selectedCamera = ref(null);
const cameraDialog = ref(null);

async function openCameraViewer(camera) {
  selectedCamera.value = camera;

  await nextTick();
  cameraDialog.value?.focus();
}

function closeCameraViewer() {
  selectedCamera.value = null;
}

function handleCameraKeydown(event) {
  if (event.key === 'Escape') {
    closeCameraViewer();
  }
}
</script>

<template>
  <main class="watcher">
    <section class="view" aria-label="Congestion estimate" data-cy="gauge">
      <CrossingScene
        :checkpoint="q.checkpoint"
        :direction="q.direction"
        :score="score"
        :hour="q.hour"
        :holiday="q.holiday"
        :condition="isNow ? condition : 'clear'"
      />
      <RouterLink to="/" class="camp-back back">← Climb down</RouterLink>

      <div class="dials" role="group" aria-label="What to look at">
        <div class="seg" role="group" aria-label="Checkpoint">
          <button type="button" :aria-pressed="q.checkpoint === 'woodlands'" @click="q.checkpoint = 'woodlands'">Woodlands</button>
          <button type="button" :aria-pressed="q.checkpoint === 'tuas'" @click="q.checkpoint = 'tuas'">Tuas</button>
        </div>
        <div class="seg" role="group" aria-label="Direction">
          <button type="button" :aria-pressed="q.direction === 'to_jb'" @click="q.direction = 'to_jb'">SG → JB</button>
          <button type="button" :aria-pressed="q.direction === 'to_sg'" @click="q.direction = 'to_sg'">JB → SG</button>
        </div>
        <label class="pick">
          <span class="sr-only">Day</span>
          <select v-model.number="q.day">
            <option v-for="(d, i) in DAYS" :key="d" :value="i">{{ d }}</option>
          </select>
        </label>
        <label class="pick check">
          <input v-model="q.holiday" type="checkbox" /> Holiday
        </label>
      </div>

      <div class="verdict" :class="`lvl-${level.toLowerCase()}`" role="status">
        <span class="when">{{ isNow ? 'Right now' : `${DAYS[q.day]} ${hourLabel(q.hour)}` }} · {{ q.checkpoint === 'tuas' ? 'Tuas Second Link' : 'Woodlands Causeway' }}</span>
        <strong>{{ level }}</strong>
        <span class="score">score {{ score }} / 100</span>
      </div>
    </section>

    <section class="rail" aria-label="Whole day">
      <div class="timeline">
        <div class="tl-head">
          <h1 class="tl-title">How bad is the jam?</h1>
          <span class="tl-time">{{ hourLabel(q.hour) }}</span>
          <button v-if="!isNow" type="button" class="mini" @click="resetNow">Back to now</button>
          <div class="legend">
            <span><i class="low" /> Low</span>
            <span><i class="medium" /> Medium</span>
            <span><i class="high" /> High</span>
          </div>
        </div>

        <div class="bars" role="list">
          <button
            v-for="h in est?.hourly || []"
            :key="h.hour"
            type="button"
            role="listitem"
            class="bar"
            :class="[h.level.toLowerCase(), { sel: h.hour === q.hour }]"
            :style="{ height: `${Math.max(6, h.score)}%` }"
            :aria-label="`${hourLabel(h.hour)}: ${h.level}`"
            :title="`${hourLabel(h.hour)} · ${h.level}`"
            @click="q.hour = h.hour"
          />
        </div>
        <input v-model.number="q.hour" class="slider" type="range" min="0" max="23" step="1" aria-label="Hour of day" data-cy="hour-slider" />
        <div class="axis"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>

        <p v-if="est?.bestHours?.length" class="best">
          <strong>Quieter times:</strong>
          <button v-for="h in est.bestHours" :key="h" type="button" class="mini" @click="q.hour = h">{{ hourLabel(h) }}</button>
        </p>
        <p v-if="estError" class="error-text">{{ estError }}</p>
        <p class="disclaimer">{{ est?.disclaimer }}</p>
      </div>

      <div class="cams" aria-label="Live cameras">
        <div class="cam-head">
          <h2 class="tl-title">Live cameras</h2>
          <span v-if="cams" class="cam-meta">Updated {{ timeAgo(cams.fetchedAt) }} · {{ cams.source }}</span>
        </div>
        <p v-if="camError" class="cam-note" role="status">{{ camError }}</p>
        <div class="cam-strip">
          <figure v-for="c in cams?.cameras || []" :key="c.cameraId" class="cam">
            <button type="button" class="cam-open" :aria-label="`Enlarge camera: ${c.label}`" @click="openCameraViewer(c)">
              <img :src="c.imageUrl" :alt="`Live traffic camera: ${c.label}`" loading="lazy" />
            </button>
            <figcaption>
              <strong>{{ c.label }}</strong>
              <span class="usually" :class="c.estimate.level.toLowerCase()">usually {{ c.estimate.level }} now</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- Fullscreen camera viewer -->
    <div
      v-if="selectedCamera"
      ref="cameraDialog"
      class="camera-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="`Camera viewer: ${selectedCamera.label}`"
      tabindex="-1"
      @click.self="closeCameraViewer"
      @keydown="handleCameraKeydown"
    >
      <button type="button" class="camera-close" aria-label="Close camera viewer" @click="closeCameraViewer">✕</button>
      <div class="camera-viewer-content">
        <h3>{{ selectedCamera.label }}</h3>
        <img :src="selectedCamera.imageUrl" :alt="`Enlarged traffic camera: ${selectedCamera.label}`" />
        <p>Live LTA traffic camera · refreshes every minute</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.watcher {
  --low: #2e6b46;
  --medium: #e0a43b;
  --high: #c2412d;
  display: flex;
  flex-direction: column;
  font-family: var(--font-round);
  color: #1f2a24;
  background: #5c3520;
}

/* ---------- the view from the tower ---------- */
.view {
  position: relative;
  flex: 1 0 auto;
  min-height: max(340px, 48dvh);
}
.back {
  position: absolute;
  z-index: 3;
  top: 16px;
  left: 16px;
}
.dials {
  position: absolute;
  z-index: 3;
  top: 16px;
  right: 16px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: calc(100% - 190px);
}
.seg {
  display: inline-flex;
  border: 2.5px solid #1f2a24;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.22);
}
.seg button {
  min-height: 38px;
  padding: 0 12px;
  border: 0;
  background: #fffdf7;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.seg button[aria-pressed='true'] {
  background: #1f2a24;
  color: #fffdf7;
}
.pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 43px;
  padding: 0 10px;
  border: 2.5px solid #1f2a24;
  border-radius: 12px;
  background: #fffdf7;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.22);
  font-size: 14px;
  font-weight: 600;
}
.pick select {
  border: 0;
  background: none;
  font: inherit;
}
.check input {
  width: 18px;
  height: 18px;
  accent-color: #1f2a24;
}
.verdict {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 72px;
  translate: -50% 0;
  display: grid;
  justify-items: center;
  padding: 10px 26px 12px;
  border: 3px solid #1f2a24;
  border-radius: 14px;
  background: var(--tone);
  color: var(--on);
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25);
  text-align: center;
  white-space: nowrap;
  transition: background 0.3s;
}
.lvl-low {
  --tone: var(--low);
  --on: #fffdf7;
}
.lvl-medium {
  --tone: var(--medium);
  --on: #1f2a24;
}
.lvl-high {
  --tone: var(--high);
  --on: #fffdf7;
}
.when {
  font-size: 12.5px;
  font-weight: 600;
}
.verdict strong {
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 40px;
  line-height: 1.05;
}
.score {
  font-size: 12.5px;
}

/* ---------- the railing: timeline + cameras ---------- */
.rail {
  position: relative;
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
  border-top: 10px solid #8a5a34;
  background: repeating-linear-gradient(90deg, #6f4426 0 140px, #5c3520 140px 143px);
}
.timeline,
.cams {
  min-width: 0;
  padding: 14px 16px;
  border: 2.5px solid #1f2a24;
  border-radius: 14px;
  background: #fffdf7;
}
.tl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.tl-title {
  margin: 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 21px;
  line-height: 1.1;
}
.tl-time {
  padding: 1px 10px;
  border-radius: 8px;
  background: #1f2a24;
  color: #fffdf7;
  font-family: var(--font-mono);
  font-size: 14px;
}
.legend {
  display: flex;
  gap: 10px;
  margin-left: auto;
  font-size: 12.5px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend i {
  width: 11px;
  height: 11px;
  border-radius: 3px;
}
i.low,
.bar.low {
  background: var(--low);
}
i.medium,
.bar.medium {
  background: var(--medium);
}
i.high,
.bar.high {
  background: var(--high);
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: clamp(90px, 16dvh, 170px);
  margin-top: 12px;
  border-bottom: 2.5px solid #1f2a24;
}
.bar {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 4px 4px 0 0;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.15s, height 0.3s;
}
.bar:hover {
  opacity: 0.85;
}
.bar.sel {
  opacity: 1;
  outline: 2.5px solid #1f2a24;
  outline-offset: 1px;
}
.slider {
  display: block;
  width: 100%;
  min-height: 30px;
  margin: 2px 0 0;
  accent-color: #1f2a24;
}
.axis {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  opacity: 0.75;
}
.best {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 13.5px;
}
.mini {
  min-height: 28px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #cfe6d3;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.disclaimer {
  margin: 8px 0 0;
  font-size: 11.5px;
  opacity: 0.7;
}
.cam-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
}
.cam-meta {
  font-size: 12px;
  opacity: 0.7;
}
.cam-note {
  margin: 10px 0 0;
  font-size: 14px;
}
.cam-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  margin-top: 10px;
}
.cam {
  margin: 0;
}
.cam-open {
  display: block;
  width: 100%;
  padding: 0;
  border: 2.5px solid #1f2a24;
  border-radius: 10px;
  background: #cfe0d9;
  overflow: hidden;
  cursor: zoom-in;
}
.cam-open img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  transition: scale 0.2s;
}
.cam-open:hover img {
  scale: 1.04;
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  margin-top: 5px;
  font-size: 13px;
}
.usually {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: #fffdf7;
}
.usually.low {
  background: var(--low);
}
.usually.medium {
  background: var(--medium);
  color: #1f2a24;
}
.usually.high {
  background: var(--high);
}

/* Fullscreen camera viewer */
.camera-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
}
.camera-viewer-content {
  width: 100%;
  max-width: 1200px;
  text-align: center;
  color: white;
}
.camera-viewer-content h3 {
  margin: 0 0 16px;
  color: white;
}
.camera-viewer-content img {
  display: block;
  width: 100%;
  max-height: 75vh;
  object-fit: contain;
  margin: auto;
}
.camera-viewer-content p {
  margin-top: 12px;
  font-size: 13px;
  color: #ddd;
}
.camera-close {
  position: absolute;
  top: 18px;
  right: 22px;
  background: none;
  border: none;
  color: white;
  font-size: 30px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .rail {
    grid-template-columns: 1fr;
  }
  .view {
    min-height: 480px;
  }
  .dials {
    top: 66px;
    left: 12px;
    right: 12px;
    max-width: none;
    justify-content: flex-start;
  }
  .verdict {
    top: 170px;
  }
  .verdict strong {
    font-size: 30px;
  }
}
</style>
