<script setup>
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';
import { COVER_COLORS } from '@/utils/constants';

const props = defineProps({ trip: { type: Object, default: null } });
const emit = defineEmits(['close', 'created', 'saved']);
const trips = useTripsStore();
const editing = Boolean(props.trip);
const titleId = editing ? 'edit-trip-title' : 'new-trip-title';
const form = reactive({
  name: props.trip?.name || '',
  mission: props.trip?.mission || '',
  startDate: props.trip?.start_date || '',
  endDate: props.trip?.end_date || '',
  coverColor: props.trip?.cover_color || COVER_COLORS[0],
  invites: '',
});
const colors = [...new Set([...COVER_COLORS, form.coverColor])];
const busy = ref(false);
const error = ref('');
const dialog = ref(null);
const nameInput = ref(null);
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  nameInput.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
function close() {
  if (!busy.value) emit('close');
}
function trapFocus(event) {
  const elements = [...dialog.value.querySelectorAll('input, button')].filter((el) => !el.disabled);
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
async function submit() {
  if (busy.value) return;
  error.value = '';
  if (!form.name.trim()) {
    error.value = 'Enter a trip name';
    return;
  }
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    error.value = 'End date must be on or after start date';
    return;
  }
  busy.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      mission: form.mission.trim() || (editing ? null : undefined),
      coverColor: form.coverColor,
      startDate: form.startDate || (editing ? null : undefined),
      endDate: editing ? (form.endDate || null) : (form.endDate || form.startDate || undefined),
    };
    if (editing) {
      const result = await trips.update(props.trip.id, payload);
      emit('saved', result);
    } else {
      const inviteUsernames = form.invites
        .split(/[\s,]+/)
        .map((u) => u.replace(/^@/, '').trim().toLowerCase())
        .filter(Boolean);
      payload.inviteUsernames = inviteUsernames.length ? inviteUsernames : undefined;
      const result = await trips.create(payload);
      emit('created', result);
    }
  } catch (err) {
    error.value = errorMessage(err, editing ? 'Could not save this trip' : 'Could not create this trip');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click="close" />
    <div ref="dialog" class="modal" role="dialog" aria-modal="true" :aria-labelledby="titleId" :aria-busy="busy" @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus">
      <h2 :id="titleId" class="display display-md">{{ editing ? 'Edit trip' : 'New trip' }}</h2>
      <form class="stack" style="gap: 14px; margin-top: 16px" @submit.prevent="submit">
        <label class="field">Trip name<input ref="nameInput" v-model="form.name" class="input" required maxlength="100" :disabled="busy" placeholder="JB Food Run" data-cy="trip-name" /></label>
        <label class="field">Mission (optional)<input v-model="form.mission" class="input" maxlength="160" :disabled="busy" placeholder="Eat our way through the old town." /></label>
        <div class="row" style="gap: 12px">
          <label class="field" style="flex: 1">Start<input v-model="form.startDate" class="input" type="date" data-cy="trip-start" :disabled="busy" :aria-describedby="editing ? 'edit-date-note' : undefined" /></label>
          <label class="field" style="flex: 1">End<input v-model="form.endDate" class="input" type="date" :min="form.startDate || undefined" :disabled="busy" :aria-describedby="editing ? 'edit-date-note' : undefined" /></label>
        </div>
        <p v-if="editing" id="edit-date-note" class="muted">Changing dates keeps existing stops on their assigned dates. You can move them in the bucket list.</p>
        <fieldset class="field" style="border: 0; padding: 0; margin: 0" :disabled="busy">
          <legend style="margin-bottom: 6px">Trip cover</legend>
          <div class="row" style="gap: 10px">
            <label v-for="c in colors" :key="c" class="swatch" :style="{ background: c }">
              <input v-model="form.coverColor" type="radio" :name="editing ? 'edit-cover' : 'create-cover'" :value="c" class="sr-only" />
              <span class="sr-only">{{ c }}</span>
            </label>
          </div>
        </fieldset>
        <label v-if="!editing" class="field">Invite by username (optional)<input v-model="form.invites" class="input" placeholder="@sam, @priya" :disabled="busy" /></label>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <div class="row" style="justify-content: flex-end">
          <button type="button" class="btn btn-ghost" :disabled="busy" @click="close">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="busy" :data-cy="editing ? undefined : 'trip-create'">{{ busy ? (editing ? 'Saving…' : 'Packing…') : (editing ? 'Save changes' : 'Pack it') }}</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.swatch { width: 44px; height: 44px; border: 2px solid var(--ink); border-radius: 10px; cursor: pointer; }
.swatch:has(input:checked) { outline: 3px solid var(--mustard); outline-offset: 2px; }
.swatch:has(input:focus-visible) { outline: 3px solid var(--ink); outline-offset: 2px; }
</style>
