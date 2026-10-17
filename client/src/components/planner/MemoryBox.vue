<script setup>
/**
 * Memory box: shown on the right of the Planner while a trip is in its 7-day
 * window after it ends (also usable while on the road).
 * Every photo here becomes a scrapbook page in the trip's Archives drawer.
 */
import { ref, computed, watch } from 'vue';
import { api, errorMessage } from '@/lib/api';
// import { useAuthStore } from '@/stores/auth';
import { shortDate } from '@/utils/format';
import { useTripRealtime } from '@/composables/useTripRealtime';

const props = defineProps({ trip: { type: Object, required: true } });
const emit = defineEmits(['show-map', 'archived', 'error']);
// const auth = useAuthStore();

const data = ref({ window: {}, memories: [], contributors: [] });
const uploading = ref(0);
const dragging = ref(false);
// const nudged = ref(false);

const stops = computed(() => {
  const ticked = props.trip.itinerary.filter((i) => i.done);
  return ticked.length ? ticked : props.trip.itinerary;
});
const daysLeft = computed(() => data.value.window.daysLeft ?? 7);
const cells = computed(() => Array.from({ length: 7 }, (_, i) => ({ label: `D${i + 1}`, used: i < 7 - daysLeft.value })));
const countdown = computed(() =>
  data.value.window.phase === 'memory_box'
    ? `${daysLeft.value} day${daysLeft.value === 1 ? '' : 's'} left · moves to the Archives on ${shortDate(data.value.window.archivesOn)}`
    : 'Add photos as you go. The 7-day memory box opens the day after the trip ends.',
);
// const missing = computed(() => data.value.contributors.filter((c) => c.count === 0 && c.id !== auth.user?.id));

async function load() {
  try {
    const res = await api.get(`/trips/${props.trip.id}/memories`);
    data.value = res.data;
  } catch (err) {
    emit('error', errorMessage(err));
  }
}
watch(() => props.trip.id, load, { immediate: true });
useTripRealtime(computed(() => props.trip.id), ['memories'], load, { pollMs: 30000 });

async function uploadFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) {
      emit('error', `${file.name} is over 8 MB`);
      continue;
    }
    uploading.value++;
    try {
      const form = new FormData();
      form.append('image', file);
      await api.post(`/trips/${props.trip.id}/memories`, form);
    } catch (err) {
      emit('error', errorMessage(err));
    } finally {
      uploading.value--;
    }
  }
  load();
}

function onDrop(e) {
  dragging.value = false;
  uploadFiles(e.dataTransfer.files);
}

async function update(m, body) {
  try {
    await api.patch(`/trips/${props.trip.id}/memories/${m.id}`, body);
    load();
  } catch (err) {
    emit('error', errorMessage(err));
  }
}

async function remove(m) {
  if (!window.confirm('Remove this photo from the memory box?')) return;
  try {
    await api.delete(`/trips/${props.trip.id}/memories/${m.id}`);
    load();
  } catch (err) {
    emit('error', errorMessage(err));
  }
}

// Chat is deferred; restore this with the messages endpoints.
// async function nudge() {
//   const names = missing.value.map((c) => c.name.split(' ')[0]).join(', ');
//   await api.post(`/trips/${props.trip.id}/messages`, { text: `Nudge for ${names}: drop your trip photos in the memory box before it closes!` });
//   nudged.value = true;
// }

async function archiveNow() {
  if (!window.confirm('Send this trip up to the Archives now? Nobody will be able to add more photos.')) return;
  try {
    await api.post(`/trips/${props.trip.id}/archive`);
    emit('archived');
  } catch (err) {
    emit('error', errorMessage(err));
  }
}
</script>

<template>
  <section class="box" aria-label="Memory box" data-cy="memory-box">
    <div class="top">
      <div style="min-width: 0; flex: 1 1 260px">
        <p class="eyebrow" style="color: var(--leaf)">Memory box · open for 7 days</p>
        <h2 class="display display-md" style="margin-top: 6px">Pack the memories.</h2>
        <p class="intro">Every photo the crew adds here becomes a page in this trip's scrapbook, inside its drawer in the Archives.</p>
      </div>
      <button type="button" class="btn btn-sm on-dark" @click="emit('show-map')">View route map</button>
    </div>

    <div class="countdown">
      <div class="cells" role="img" :aria-label="countdown">
        <span v-for="c in cells" :key="c.label" class="cell" :class="{ used: c.used }">{{ c.label }}</span>
      </div>
      <p class="hand" style="margin: 10px 0 0; color: var(--sand); font-size: 24px">{{ countdown }}</p>
    </div>

    <div class="inner">
      <label
        class="drop"
        :class="{ over: dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v13H4Z" /><circle cx="12" cy="13" r="4" /></svg>
        <strong>{{ uploading ? `Uploading ${uploading}…` : 'Drop photos here, or tap to choose' }}</strong>
        <span class="muted" style="font-size: 13px">JPG/PNG/WebP up to 8 MB. Tag each one to a stop you ticked.</span>
        <input type="file" accept="image/*" multiple class="sr-only" data-cy="memory-input" @change="uploadFiles($event.target.files); $event.target.value = ''" />
      </label>

      <div class="row" style="gap: 8px 10px">
        <span class="eyebrow" style="font-size: 13px">Who's added photos</span>
        <span v-for="c in data.contributors" :key="c.id" class="pill" :style="{ background: c.count ? 'var(--sage)' : 'transparent', borderStyle: c.count ? 'solid' : 'dashed' }">
          {{ c.name.split(' ')[0] }} · {{ c.count }}
        </span>
        <!--
        <button v-if="missing.length && !nudged" type="button" class="btn btn-sm nudge" @click="nudge">Nudge {{ missing.map((c) => c.name.split(' ')[0]).join(' & ') }}</button>
        <span v-if="nudged" class="hand" style="color: var(--jungle)">Nudge sent to camp chat</span>
        -->
      </div>

      <div class="grid">
        <figure v-for="m in data.memories" :key="m.id" class="polaroid">
          <img v-if="m.image_url" :src="m.image_url" :alt="m.caption || `Photo by ${m.author?.name}`" loading="lazy" />
          <div v-else class="placeholder-photo" style="height: 130px">[photo · {{ m.author?.name }}]</div>
          <button type="button" class="x" :aria-label="`Remove photo by ${m.author?.name}`" @click="remove(m)">✕</button>
          <figcaption>
            <label>
              <span class="sr-only">Caption</span>
              <input class="cap" :value="m.caption" placeholder="Add a caption…" maxlength="200" @change="update(m, { caption: $event.target.value })" />
            </label>
            <label>
              <span class="sr-only">Stop</span>
              <select class="select stop-select" :value="m.stop?.id || ''" @change="update(m, { itemId: $event.target.value || null })">
                <option value="">No stop</option>
                <option v-for="s in stops" :key="s.id" :value="s.id">Stop: {{ s.title }}</option>
              </select>
            </label>
            <span class="by">by {{ m.author?.name }}</span>
          </figcaption>
        </figure>
      </div>

      <div class="spacer" />
      <div class="foot">
        <span class="hand" style="color: var(--jungle); font-size: 23px">{{ data.memories.length }} photo{{ data.memories.length === 1 ? '' : 's' }} packed</span>
        <button v-if="data.window.phase === 'memory_box'" type="button" class="btn btn-ember" data-cy="archive-now" @click="archiveNow">Done · send it up to the attic</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.box { display: flex; flex-direction: column; height: 100%; border: 2px solid var(--ink); border-radius: 16px; background: var(--teal); color: var(--paper); overflow: hidden; box-shadow: 8px 8px 0 var(--ink); }
.top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; }
.intro { margin: 6px 0 0; font-size: 15px; color: #DCE8E6; }
.on-dark { background: transparent; color: var(--paper); border-color: var(--paper); }
.countdown { padding: 0 22px 18px; }
.cells { display: flex; gap: 6px; }
.cell { flex: 1; text-align: center; padding: 6px 0; border: 2px solid var(--paper); border-radius: 6px; font-size: 12px; font-weight: 800; }
.cell.used { background: var(--paper); color: var(--teal); opacity: .55; }
.inner { flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 20px 22px 22px; background: var(--card); color: var(--ink); border-top: 2px solid var(--ink); }
.drop { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 150px; padding: 18px; border: 3px dashed var(--teal); border-radius: 14px; background: #DCE8E6; cursor: pointer; text-align: center; }
.drop.over, .drop:hover { background: var(--mist); }
.drop:focus-within { outline: 4px solid var(--mustard); outline-offset: 3px; }
/* .nudge { border-style: dashed; color: var(--ember); border-color: var(--ember); background: transparent; } */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
.polaroid { position: relative; margin: 0; padding: 8px 8px 10px; background: #fff; border: 1.5px solid var(--line); box-shadow: 3px 4px 0 rgba(42, 33, 23, .15); }
.polaroid img { width: 100%; height: 130px; object-fit: cover; }
.x { position: absolute; top: 2px; right: 2px; width: 32px; height: 32px; border: 2px solid var(--ink); border-radius: 50%; background: var(--card); cursor: pointer; }
.cap { width: 100%; min-height: 40px; margin-top: 8px; padding: 0 8px; border: 0; border-bottom: 2px dashed var(--line); background: transparent; font-family: var(--font-hand); font-size: 20px; }
.stop-select { margin-top: 6px; min-height: 34px; font-size: 12px; border-width: 1.5px; border-radius: 999px; }
.by { display: block; margin-top: 6px; font-size: 11px; color: var(--ink-mute); }
.foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 14px; border-top: 2px dashed var(--line); }
</style>
