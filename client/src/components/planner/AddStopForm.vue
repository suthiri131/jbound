<script setup>
/** "Scribble a stop" — add a custom stop (no place from the Explorer). */
import { reactive, ref } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { VIBES } from '@/utils/constants';
import { dayLabel } from '@/utils/format';

const props = defineProps({
  trip: { type: Object, required: true },
  dates: { type: Array, default: () => [] },
});
const emit = defineEmits(['added', 'error']);

const open = ref(false);
const busy = ref(false);
const blank = () => ({ title: '', day: props.dates[0] || '', time: '', vibe: 'eating', notes: '', dwellMinutes: '', crossing: '', crossingDir: 'to_jb' });
const form = reactive(blank());

async function submit() {
  busy.value = true;
  try {
    await api.post(`/trips/${props.trip.id}/itinerary`, {
      title: form.title,
      day: form.day || undefined,
      time: form.time || undefined,
      vibe: form.vibe || undefined,
      notes: form.notes || undefined,
      dwellMinutes: form.dwellMinutes === '' ? undefined : Number(form.dwellMinutes),
      crossing: form.crossing || undefined,
      crossingDir: form.crossing ? form.crossingDir : undefined,
    });
    Object.assign(form, blank());
    open.value = false;
    emit('added');
  } catch (err) {
    emit('error', errorMessage(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div style="margin-top: 10px">
    <button v-if="!open" type="button" class="btn btn-ghost" data-cy="scribble" @click="open = true">+ Scribble a stop</button>
    <form v-else class="scribble stack" @submit.prevent="submit">
      <label class="field">What<input v-model="form.title" class="input" required maxlength="120" placeholder="Cross via Woodlands Causeway" data-cy="stop-title" /></label>
      <div class="row" style="gap: 10px">
        <label class="field" style="flex: 1 1 140px">Day
          <select v-model="form.day" class="select">
            <option value="">Unscheduled</option>
            <option v-for="d in dates" :key="d" :value="d">{{ dayLabel(trip.start_date, d) }} · {{ d }}</option>
          </select>
        </label>
        <label class="field" style="flex: 1 1 100px">Time<input v-model="form.time" type="time" class="input" data-cy="stop-time-new" /></label>
        <label class="field" style="flex: 1 1 100px">Vibe
          <select v-model="form.vibe" class="select">
            <option v-for="v in VIBES" :key="v.id" :value="v.id">{{ v.label }}</option>
          </select>
        </label>
        <label class="field" style="flex: 1 1 110px">Stay (min)<input v-model="form.dwellMinutes" type="number" min="0" max="1440" class="input" placeholder="auto" /></label>
      </div>
      <div class="row" style="gap: 10px">
        <label class="field" style="flex: 1 1 160px">Border crossing?
          <select v-model="form.crossing" class="select">
            <option value="">No</option>
            <option value="woodlands">Woodlands</option>
            <option value="tuas">Tuas</option>
          </select>
        </label>
        <label v-if="form.crossing" class="field" style="flex: 1 1 140px">Direction
          <select v-model="form.crossingDir" class="select">
            <option value="to_jb">SG → JB</option>
            <option value="to_sg">JB → SG</option>
          </select>
        </label>
      </div>
      <label class="field">Note<input v-model="form.notes" class="input" maxlength="500" placeholder="go early, the queue is real" /></label>
      <div class="row" style="justify-content: flex-end">
        <button type="button" class="btn btn-ghost btn-sm" @click="open = false">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm" :disabled="busy" data-cy="stop-add">Add stop</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.scribble { gap: 12px; padding: 16px; border: 2px dashed var(--ink); border-radius: 12px; background: var(--paper); }
</style>
