<script setup>
/**
 * The trip's bucket list: stops grouped by day, tick boxes, times, drag/arrow reorder.
 * Every change goes straight to the API; the parent reloads (and Realtime syncs the crew).
 */
import { ref, computed, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { api, errorMessage } from '@/lib/api';
import { dateRange, dayLabel, longDate, hhmm } from '@/utils/format';
import { VIBE_LABEL, VIBE_TINT, PHASE_STAMP } from '@/utils/constants';
import AddStopForm from './AddStopForm.vue';

const props = defineProps({
  trip: { type: Object, required: true },
  legs: { type: Object, default: () => ({}) }, // itemId → 'tight' | 'overloaded'
});
const emit = defineEmits(['changed', 'error']);

const editable = computed(() => ['planning', 'on_the_road'].includes(props.trip.phase));
const ended = computed(() => props.trip.phase === 'memory_box' || props.trip.phase === 'archived');
const canTick = computed(() => props.trip.phase !== 'archived');

/** Every date in the trip (max 7) so empty days still show as drop targets. */
const tripDates = computed(() => {
  const { start_date: s, end_date: e } = props.trip;
  if (!s) return [];
  const out = [];
  const d = new Date(s + 'T00:00:00');
  const end = new Date((e || s) + 'T00:00:00');
  while (d <= end && out.length < 7) {
    out.push(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() + 1);
  }
  return out;
});

// Local, mutable copy grouped by day (needed for drag & drop)
const groups = ref([]);
watch(
  () => props.trip.itinerary,
  (items) => {
    const keys = [...new Set([...tripDates.value, ...items.map((i) => i.day).filter(Boolean)])].sort();
    const byDay = keys.map((day) => ({ day, items: items.filter((i) => i.day === day) }));
    const unscheduled = items.filter((i) => !i.day);
    if (unscheduled.length || !keys.length) byDay.push({ day: null, items: unscheduled });
    groups.value = byDay;
  },
  { immediate: true, deep: true },
);

const all = computed(() => props.trip.itinerary);
const doneCount = computed(() => all.value.filter((i) => i.done).length);
const progressLabel = computed(() => `${doneCount.value} of ${all.value.length} ticked`);
const stamp = computed(() => {
  if (ended.value) return { label: 'TRIP DONE', color: PHASE_STAMP.memory_box.color };
  if (all.value.length && doneCount.value === all.value.length) return { label: 'CONQUERED', color: 'var(--teal)' };
  return PHASE_STAMP[props.trip.phase] || PHASE_STAMP.planning;
});

async function run(fn) {
  try {
    await fn();
    emit('changed');
  } catch (err) {
    emit('error', errorMessage(err));
  }
}

const patch = (item, body) => run(() => api.patch(`/trips/${props.trip.id}/itinerary/${item.id}`, body));
const toggle = (item) => patch(item, { done: !item.done });
const setTime = (item, value) => patch(item, { time: value || null });
const remove = (item) => {
  if (window.confirm(`Remove ${item.title}?`)) run(() => api.delete(`/trips/${props.trip.id}/itinerary/${item.id}`));
};

function saveOrder() {
  const items = groups.value.flatMap((g) => g.items.map((it, position) => ({ id: it.id, day: g.day, position })));
  if (items.length) run(() => api.put(`/trips/${props.trip.id}/itinerary/order`, { items }));
}

function move(group, idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= group.items.length) return;
  [group.items[idx], group.items[j]] = [group.items[j], group.items[idx]];
  saveOrder();
}
</script>

<template>
  <section class="bucket" aria-label="Bucket list">
    <div class="margin-line" aria-hidden="true" />

    <div class="row head">
      <div style="min-width: 0; flex: 1 1 200px">
        <p class="eyebrow" style="color: var(--jungle)">{{ dateRange(trip.start_date, trip.end_date) }}</p>
        <h1 class="display display-lg" style="margin-top: 6px" data-cy="trip-title">{{ trip.name }}</h1>
        <p v-if="trip.mission" class="hand muted" style="margin: 6px 0 0; font-size: 24px">{{ trip.mission }}</p>
      </div>
      <div class="stamp big-stamp" :style="{ color: stamp.color }" :aria-label="`Status: ${stamp.label}`">{{ stamp.label }}</div>
    </div>

    <div class="progress">
      <div class="row" style="justify-content: space-between; gap: 6px">
        <span class="eyebrow">Bucket progress</span>
        <span class="hand accent">{{ progressLabel }}</span>
      </div>
      <div class="knots" role="img" :aria-label="progressLabel">
        <template v-for="(it, i) in all" :key="it.id">
          <span v-if="i > 0" class="rope" :class="{ on: it.done && all[i - 1].done }" />
          <span class="knot" :class="{ on: it.done }" />
        </template>
      </div>
      <p v-if="ended" class="note">Ticked stops become the bucket list inside this trip's scrapbook. Untick anything you skipped.</p>
    </div>

    <!-- FeasibilityCard is passed in by the parent -->
    <slot name="feasibility" />

    <div v-for="g in groups" :key="g.day || 'none'" class="day">
      <div class="row day-head">
        <h2 class="display display-sm">
          {{ g.day ? dayLabel(trip.start_date, g.day) : 'Unscheduled' }}
          <span v-if="g.day" class="date">· {{ longDate(g.day) }}</span>
        </h2>
        <span class="hand muted">{{ g.items.length }} stop{{ g.items.length === 1 ? '' : 's' }}</span>
      </div>

      <VueDraggable
        v-model="g.items"
        tag="ol"
        class="stops"
        group="stops"
        handle=".grip"
        :animation="150"
        :disabled="!editable"
        @end="saveOrder"
      >
        <li v-for="(it, idx) in g.items" :key="it.id" class="stop" data-cy="stop">
          <button
            type="button"
            class="tick"
            :aria-pressed="it.done"
            :aria-label="`${it.done ? 'Untick' : 'Tick off'} ${it.title}`"
            :disabled="!canTick"
            data-cy="tick"
            @click="toggle(it)"
          >
            <svg v-if="it.done" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M5 16c3 2 5 5 7 9 3-9 8-16 15-22" fill="none" stroke="var(--ember)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>

          <div class="body">
            <div class="row" style="gap: 8px">
              <span v-if="editable" class="grip" title="Drag to reorder" aria-hidden="true">⠿</span>
              <span class="num" :style="{ background: VIBE_TINT[it.vibe] || 'var(--card)' }">{{ idx + 1 }}</span>
              <input
                type="time"
                class="time"
                :value="hhmm(it.time)"
                :disabled="!editable"
                :aria-label="`Time for ${it.title}`"
                data-cy="stop-time"
                @change="setTime(it, $event.target.value)"
              />
              <span v-if="it.vibe" class="pill">{{ VIBE_LABEL[it.vibe] }}</span>
              <span v-if="it.crossing" class="pill" style="background: var(--mist)">{{ it.crossing === 'tuas' ? 'Tuas' : 'Woodlands' }} {{ it.crossing_dir === 'to_sg' ? '→ SG' : '→ JB' }}</span>
            </div>
            <p class="title" :class="{ done: it.done }">{{ it.title }}</p>
            <p v-if="it.notes" class="hand muted note-line">{{ it.notes }}</p>
            <span v-if="legs[it.id] === 'tight'" class="badge tight">◷ Tight squeeze getting here</span>
            <span v-if="legs[it.id] === 'overloaded'" class="badge over">⚠ Not enough time to get here</span>
          </div>

          <div v-if="editable" class="arrows">
            <button type="button" class="arrow" :aria-label="`Move ${it.title} up`" :disabled="idx === 0" @click="move(g, idx, -1)">▲</button>
            <button type="button" class="arrow" :aria-label="`Move ${it.title} down`" :disabled="idx === g.items.length - 1" @click="move(g, idx, 1)">▼</button>
            <button type="button" class="arrow" :aria-label="`Remove ${it.title}`" @click="remove(it)">✕</button>
          </div>
        </li>
      </VueDraggable>
      <p v-if="!g.items.length" class="muted empty">Nothing here yet{{ editable ? ' · drag a stop in or add one below' : '' }}.</p>
    </div>

    <template v-if="editable">
      <div class="row" style="margin-top: 20px; gap: 10px">
        <RouterLink :to="`/explorer?pinTo=${trip.id}`" class="btn btn-primary">+ Add from Explorer</RouterLink>
      </div>
      <AddStopForm :trip="trip" :dates="tripDates" @added="emit('changed')" @error="emit('error', $event)" />
      <p class="muted" style="margin: 14px 0 0; font-size: 13px">Drag the ⠿ handle or use the arrows to reorder. The map redraws the route in the new order.</p>
    </template>
  </section>
</template>

<style scoped>
.bucket { position: relative; border: 2px solid var(--ink); border-radius: 6px 16px 16px 6px; background: var(--card); box-shadow: 8px 8px 0 var(--ink); padding: 28px 24px 24px 40px; }
.margin-line { position: absolute; top: 0; bottom: 0; left: 20px; width: 2px; background: #E2A08A; }
.head { justify-content: space-between; align-items: flex-start; gap: 14px; }
.big-stamp { width: 110px; height: 110px; font-size: 13px; flex: none; }
.progress { margin-top: 20px; padding: 14px 16px; border: 2px dashed var(--line-strong); border-radius: 12px; }
.progress .hand { font-size: 24px; }
.knots { display: flex; align-items: center; margin-top: 10px; }
.knot { flex: none; width: 18px; height: 18px; border: 2px solid var(--ink); border-radius: 50%; background: var(--card); }
.knot.on { background: var(--ember); }
.rope { flex: 1; height: 3px; background: var(--line); }
.rope.on { background: var(--ember); }
.note { margin: 10px 0 0; font-size: 13px; color: var(--ink-soft); }
.day { margin-top: 24px; }
.day-head { justify-content: space-between; align-items: baseline; gap: 6px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); }
.date { font-family: var(--font-body); font-size: 14px; font-weight: 600; color: var(--ink-mute); }
.stops { list-style: none; margin: 0; padding: 0; min-height: 12px; }
.stop { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1.5px dashed var(--line); background: var(--card); }
.tick { flex: none; width: 44px; height: 44px; border: 2.5px solid var(--ink); border-radius: 8px; background: var(--paper); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.tick[aria-pressed='true'] { background: var(--sand); }
.body { flex: 1; min-width: 0; }
.grip { cursor: grab; font-size: 18px; color: var(--ink-mute); user-select: none; }
.num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--ink); font-size: 12px; font-weight: 800; }
.time { width: 124px; min-height: 32px; padding: 0 6px; border: 1.5px solid var(--line-strong); border-radius: 6px; background: var(--paper); font-family: var(--font-body); font-weight: 800; font-size: 14px; }
.title { margin: 4px 0 0; font-weight: 700; font-size: 17px; }
.title.done { text-decoration: line-through; text-decoration-color: var(--ember); text-decoration-thickness: 2px; color: var(--ink-mute); }
.note-line { margin: 1px 0 0; font-size: 20px; }
.badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; padding: 2px 10px; border: 1.5px solid var(--ink); border-radius: 999px; font-size: 11px; font-weight: 800; }
.badge.tight { background: var(--sand); }
.badge.over { background: var(--clay); border-color: var(--brick); color: #7A2D14; }
.arrows { flex: none; display: flex; flex-direction: column; gap: 4px; }
.arrow { width: 44px; height: 34px; border: 1.5px solid var(--line-strong); border-radius: 8px; background: transparent; cursor: pointer; }
.arrow:disabled { opacity: .35; cursor: default; }
.empty { margin: 10px 0 0; font-size: 14px; }
</style>
