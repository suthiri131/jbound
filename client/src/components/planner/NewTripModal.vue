<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';
import { COVER_COLORS } from '@/utils/constants';

const emit = defineEmits(['close', 'created']);
const trips = useTripsStore();

const form = reactive({ name: '', mission: '', startDate: '', endDate: '', coverColor: COVER_COLORS[0], invites: '' });
const busy = ref(false);
const error = ref('');
const nameInput = ref(null);
onMounted(() => nameInput.value?.focus());

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const inviteUsernames = form.invites
      .split(/[\s,]+/)
      .map((u) => u.replace(/^@/, '').trim().toLowerCase())
      .filter(Boolean);
    const trip = await trips.create({
      name: form.name,
      mission: form.mission || undefined,
      coverColor: form.coverColor,
      startDate: form.startDate || undefined,
      endDate: form.endDate || form.startDate || undefined,
      inviteUsernames: inviteUsernames.length ? inviteUsernames : undefined,
    });
    emit('created', trip);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="scrim" @click="emit('close')" />
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="new-trip-title" @keydown.esc="emit('close')">
    <h2 id="new-trip-title" class="display display-md">Pack a new trip</h2>
    <form class="stack" style="gap: 14px; margin-top: 16px" @submit.prevent="submit">
      <label class="field">Trip name<input ref="nameInput" v-model="form.name" class="input" required maxlength="100" placeholder="JB Food Run" data-cy="trip-name" /></label>
      <label class="field">Mission (optional)<input v-model="form.mission" class="input" maxlength="160" placeholder="Eat our way through the old town." /></label>
      <div class="row" style="gap: 12px">
        <label class="field" style="flex: 1">Start<input v-model="form.startDate" class="input" type="date" data-cy="trip-start" /></label>
        <label class="field" style="flex: 1">End<input v-model="form.endDate" class="input" type="date" :min="form.startDate" /></label>
      </div>
      <fieldset class="field" style="border: 0; padding: 0; margin: 0">
        <legend style="margin-bottom: 6px">Satchel cover</legend>
        <div class="row" style="gap: 10px">
          <label v-for="c in COVER_COLORS" :key="c" class="swatch" :style="{ background: c }">
            <input v-model="form.coverColor" type="radio" name="cover" :value="c" class="sr-only" />
            <span class="sr-only">{{ c }}</span>
          </label>
        </div>
      </fieldset>
      <label class="field">Invite by username (optional)<input v-model="form.invites" class="input" placeholder="@sam, @priya" /></label>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="row" style="justify-content: flex-end">
        <button type="button" class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="busy" data-cy="trip-create">{{ busy ? 'Packing…' : 'Pack it' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.swatch { width: 44px; height: 44px; border: 2px solid var(--ink); border-radius: 10px; cursor: pointer; }
.swatch:has(input:checked) { outline: 3px solid var(--mustard); outline-offset: 2px; }
.swatch:has(input:focus-visible) { outline: 3px solid var(--ink); outline-offset: 2px; }
</style>
