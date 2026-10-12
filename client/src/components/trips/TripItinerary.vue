<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { formatTripDay, readItinerary, saveItinerary } from '@/services/localTrips';

const props = defineProps({
  userId: { type: String, required: true },
  tripId: { type: String, required: true },
  days: { type: Array, required: true },
});
const items = ref([]);
const error = ref('');
const loadFailed = ref(false);
const editorDay = ref(null);
const editingId = ref(null);
const form = reactive({ title: '', time: '', vibe: '', dwell_minutes: '', notes: '' });
const categories = { eating: 'Eat', activities: 'Do', culture: 'Culture', adventure: 'Adventure' };

watch(() => [props.userId, props.tripId], () => {
  editorDay.value = null;
  error.value = '';
  loadFailed.value = false;
  try { items.value = readItinerary(props.userId, props.tripId); }
  catch { items.value = []; loadFailed.value = true; error.value = 'Could not load saved stops. Reload the page to try again.'; }
}, { immediate: true });

const stopsByDay = computed(() => Object.fromEntries(props.days.map(day => [
  day, items.value.filter(item => item.day === day).sort((a, b) => a.position - b.position),
])));

function dayItems(day) {
  return stopsByDay.value[day] || [];
}

function persist(next) {
  try {
    saveItinerary(props.userId, props.tripId, next);
    items.value = next;
    error.value = '';
    return true;
  } catch { error.value = 'Could not save your stops. Check that browser storage is available.'; return false; }
}

function openEditor(day, item = null) {
  editorDay.value = day;
  editingId.value = item?.id || null;
  Object.assign(form, {
    title: item?.title || '', time: item?.time || '', vibe: item?.vibe || '',
    dwell_minutes: item?.dwell_minutes ?? '', notes: item?.notes || '',
  });
  error.value = '';
}

function saveStop() {
  const title = form.title.trim();
  const duration = form.dwell_minutes === '' ? null : Number(form.dwell_minutes);
  if (!title) { error.value = 'Enter a stop name.'; return; }
  if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 1440)) {
    error.value = 'Duration must be a whole number between 0 and 1440 minutes.'; return;
  }
  if (!props.days.includes(editorDay.value)) { error.value = 'Choose a day within this trip.'; return; }
  const existing = items.value.find(item => item.id === editingId.value);
  const item = {
    ...(existing || { id: crypto.randomUUID(), trip_id: props.tripId, place_id: null,
      position: dayItems(editorDay.value).length, done: false, done_at: null,
      created_at: new Date().toISOString() }),
    day: editorDay.value, title, time: form.time || null, vibe: form.vibe || null,
    dwell_minutes: duration, notes: form.notes.trim() || null,
  };
  const next = existing ? items.value.map(stop => stop.id === item.id ? item : stop) : [...items.value, item];
  if (persist(next)) editorDay.value = null;
}

function toggleDone(item) {
  persist(items.value.map(stop => stop.id === item.id
    ? { ...stop, done: !stop.done, done_at: stop.done ? null : new Date().toISOString() } : stop));
}

function reorderDay(day, ordered) {
  const positions = new Map(ordered.map((stop, position) => [stop.id, position]));
  persist(items.value.map(stop => stop.day === day && positions.has(stop.id)
    ? { ...stop, position: positions.get(stop.id) } : stop));
}

function moveWithKeyboard(item, offset) {
  const ordered = [...dayItems(item.day)];
  const index = ordered.findIndex(stop => stop.id === item.id);
  const target = index + offset;
  if (target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  reorderDay(item.day, ordered);
}

function removeStop(item) {
  const remaining = dayItems(item.day).filter(stop => stop.id !== item.id);
  const positions = new Map(remaining.map((stop, position) => [stop.id, position]));
  if (persist(items.value.filter(stop => stop.id !== item.id).map(stop =>
    positions.has(stop.id) ? { ...stop, position: positions.get(stop.id) } : stop))) {
    if (editingId.value === item.id) editorDay.value = null;
  }
}

function displayTime(time) {
  if (!time) return 'Time not set';
  const [hours, minutes] = time.split(':');
  return `${Number(hours) % 12 || 12}:${minutes} ${Number(hours) < 12 ? 'AM' : 'PM'}`;
}
</script>

<template>
  <div>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    <p class="muted">Drag the handle to reorder stops within each day.</p>
    <section v-for="(day, dayIndex) in days" :key="day" class="day-section" :aria-label="`Day ${dayIndex + 1}`">
      <header class="day-header">
        <h3>Day {{ dayIndex + 1 }} · {{ formatTripDay(day) }}</h3>
      </header>
      <VueDraggable tag="ol" class="stops" :model-value="dayItems(day)" handle=".drag-handle"
        draggable=".stop" :animation="150" :disabled="loadFailed" ghost-class="stop-ghost"
        @update:model-value="reorderDay(day, $event)">
        <li v-for="(item, index) in dayItems(day)" :key="item.id" class="stop">
          <input type="checkbox" :checked="item.done" :disabled="loadFailed" :aria-label="`Mark ${item.title} ${item.done ? 'incomplete' : 'complete'}`" @change="toggleDone(item)" />
          <div class="stop-details">
            <div class="stop-meta">
              <span>{{ index + 1 }}</span><strong>{{ displayTime(item.time) }}</strong>
              <span v-if="item.vibe" class="pill">{{ categories[item.vibe] }}</span>
              <span v-if="item.dwell_minutes !== null">{{ item.dwell_minutes }} min</span>
            </div>
            <h4 :class="{ completed: item.done }">{{ item.title }}</h4>
            <p v-if="item.notes" class="hand notes">{{ item.notes }}</p>
            <div class="row">
              <button class="btn btn-sm" type="button" @click="openEditor(day, item)">Edit</button>
              <button class="btn btn-sm btn-ghost" type="button" @click="removeStop(item)">Remove</button>
            </div>
          </div>
          <button class="drag-handle" type="button" :aria-label="`Reorder ${item.title}`"
            title="Drag to reorder, or use the up and down arrow keys" :disabled="loadFailed"
            @keydown.up.prevent="moveWithKeyboard(item, -1)" @keydown.down.prevent="moveWithKeyboard(item, 1)">
            <span aria-hidden="true">⠿</span>
          </button>
        </li>
      </VueDraggable>
      <p v-if="!dayItems(day).length">No stops yet. Add your first stop below.</p>
      <div class="row">
        <button class="btn btn-primary" type="button" :disabled="loadFailed" @click="openEditor(day)">+ Add stop</button>
      </div>
      <form v-if="editorDay === day" class="stop-form" @submit.prevent="saveStop">
        <h4>{{ editingId ? 'Edit stop' : 'New stop' }} · Day {{ dayIndex + 1 }}</h4>
        <label class="field" :for="`title-${day}`">Stop name
          <input :id="`title-${day}`" v-model="form.title" class="input" required placeholder="Meet at Woodlands" />
        </label>
        <details class="extra-details">
          <summary>Time, category, and notes (optional)</summary>
        <div class="form-columns">
          <label class="field" :for="`time-${day}`">Time (optional)
            <input :id="`time-${day}`" v-model="form.time" type="time" class="input" />
          </label>
          <label class="field" :for="`duration-${day}`">Duration in minutes (optional)
            <input :id="`duration-${day}`" v-model="form.dwell_minutes" type="number" min="0" max="1440" step="1" class="input" />
          </label>
        </div>
        <label class="field" :for="`vibe-${day}`">Category (optional)
          <select :id="`vibe-${day}`" v-model="form.vibe" class="select">
            <option value="">No category</option>
            <option v-for="(label, value) in categories" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
        <label class="field" :for="`notes-${day}`">Notes (optional)
          <textarea :id="`notes-${day}`" v-model="form.notes" class="textarea" placeholder="Things to remember" />
        </label>
        </details>
        <div class="row">
          <button class="btn btn-primary" type="submit">Save stop</button>
          <button class="btn" type="button" @click="editorDay = null">Cancel</button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.day-section { padding: 20px; margin-bottom: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
.extra-details { display: grid; }
.extra-details summary { cursor: pointer; font-size: 13px; color: var(--ink-soft); }
.extra-details[open] > :not(summary) { margin-top: 14px; }
.day-header h3 { margin: 0; }
.stops { padding: 0; list-style: none; }
.stop { display: flex; align-items: start; gap: 12px; padding-block: 18px; border-bottom: 1px dashed var(--line-strong); }
.stop input[type='checkbox'] { width: 26px; height: 26px; flex-shrink: 0; accent-color: var(--jungle); }
.stop-details { flex: 1; min-width: 0; }
.stop-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; }
h4 { margin: 10px 0; overflow-wrap: anywhere; }
.completed { text-decoration: line-through; color: var(--ink-mute); }
.notes { white-space: pre-wrap; overflow-wrap: anywhere; }
.drag-handle { padding: 4px 8px; border: 0; background: transparent; color: var(--ink-mute); font-size: 28px; cursor: grab; touch-action: none; }
.drag-handle:active { cursor: grabbing; }
.stop-ghost { opacity: .35; }
.stop-form { display: grid; gap: 16px; margin-top: 20px; padding: 18px; background: var(--paper); border: 1px solid var(--line-strong); border-radius: 8px; }
.form-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 500px) { .form-columns { grid-template-columns: 1fr; } }
</style>
