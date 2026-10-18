<script setup>
/**
 * "Join a crew with an invite code". Used on the Planner (SatchelBar) and on the home page,
 * so the code cleaning, errors and button states live in one place.
 * Emits `joined` with the trip the API returned ({ ...trip, alreadyMember }).
 */
import { ref } from 'vue';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';

const emit = defineEmits(['joined']);
const trips = useTripsStore();
const code = ref('');
const error = ref('');
const busy = ref(false);
const errId = `join-err-${Math.random().toString(36).slice(2, 8)}`;

/** Forgive copy-paste: stray spaces, capitals, or the whole link ("…/planner?join=a3f9c21e"). */
function cleanCode(raw) {
  const text = raw.trim();
  const fromLink = text.match(/[?&]join=([a-z0-9]+)/i);
  return (fromLink ? fromLink[1] : text).replace(/\s+/g, '').toLowerCase();
}

async function submit() {
  if (busy.value) return;
  const value = cleanCode(code.value);
  if (!value) return;
  error.value = '';
  if (value.length < 4 || value.length > 32) {
    error.value = "That doesn't look like an invite code. Ask your friend to copy it again.";
    return;
  }
  busy.value = true;
  try {
    const trip = await trips.join(value);
    code.value = '';
    emit('joined', trip);
  } catch (err) {
    error.value = errorMessage(err, 'Could not join that trip');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <label class="field">
      Join a crew with an invite code
      <span class="row" style="gap: 8px; flex-wrap: nowrap">
        <input
          v-model="code"
          class="input"
          placeholder="e.g. a3f9c21e"
          maxlength="200"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :disabled="busy"
          :aria-describedby="error ? errId : undefined"
          data-cy="join-code"
        />
        <button type="submit" class="btn btn-dark btn-sm" :disabled="busy || !code.trim()" data-cy="join-submit">
          {{ busy ? 'Joining…' : 'Join' }}
        </button>
      </span>
    </label>
    <p v-if="error" :id="errId" class="error-text" role="alert" style="margin: 6px 0 0">{{ error }}</p>
  </form>
</template>
