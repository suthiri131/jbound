<script setup>
/**
 * Horizontal satchel at the top of the Planner: one cover per trip,
 * "+ Pack a new trip" (opens NewTripModal) and a join-by-code box.
 */
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';
import TripCover from '@/components/common/TripCover.vue';
import NewTripModal from './NewTripModal.vue';

const props = defineProps({
  currentId: { type: String, default: '' },
  startOpen: { type: Boolean, default: false },
});

const trips = useTripsStore();
const router = useRouter();
const showNew = ref(props.startOpen);
watch(() => props.startOpen, (v) => { if (v) showNew.value = true; });
const code = ref('');
const joinError = ref('');
const joining = ref(false);

async function join() {
  if (!code.value.trim()) return;
  joinError.value = '';
  joining.value = true;
  try {
    const trip = await trips.join(code.value.trim());
    code.value = '';
    router.push(`/planner/${trip.id}`);
  } catch (err) {
    joinError.value = errorMessage(err);
  } finally {
    joining.value = false;
  }
}

function created(trip) {
  showNew.value = false;
  router.push(`/planner/${trip.id}`);
}
</script>

<template>
  <section class="satchel" aria-label="Your trips">
    <div class="row head">
      <h2 class="display display-sm">Satchel</h2>
      <span class="hand muted">{{ trips.trips.length }} trips packed · pick one to open its bucket list</span>
    </div>

    <div class="shelf">
      <RouterLink
        v-for="t in trips.trips"
        :key="t.id"
        :to="`/planner/${t.id}`"
        class="slot"
        :aria-current="t.id === currentId ? 'page' : undefined"
        data-cy="trip-tab"
      >
        <TripCover :trip="t" :selected="t.id === currentId" />
      </RouterLink>

      <button type="button" class="new" data-cy="new-trip" @click="showNew = true">+ Pack a new trip</button>

      <form class="join card-flat" @submit.prevent="join">
        <label class="field">
          Join a crew with an invite code
          <span class="row" style="gap: 8px; flex-wrap: nowrap">
            <input v-model="code" class="input" placeholder="e.g. a3f9c21e" aria-describedby="join-err" />
            <button type="submit" class="btn btn-dark btn-sm" :disabled="joining">Join</button>
          </span>
        </label>
        <p v-if="joinError" id="join-err" class="error-text" role="alert" style="margin: 6px 0 0">{{ joinError }}</p>
      </form>
    </div>

    <NewTripModal v-if="showNew" @close="showNew = false" @created="created" />
  </section>
</template>

<style scoped>
.satchel { padding: 16px 20px 8px; border: 2px solid var(--ink); border-radius: var(--radius); background: var(--paper-deep); }
.head { justify-content: space-between; align-items: baseline; gap: 4px 12px; }
.head .hand { font-size: 21px; }
.shelf { display: flex; align-items: stretch; gap: 16px; overflow-x: auto; padding: 16px 6px 14px 2px; }
.slot { flex: 0 0 230px; text-decoration: none; }
.slot :deep(.cover) { height: 100%; }
.new { flex: 0 0 180px; min-height: 110px; border: 2px dashed var(--ink); border-radius: var(--radius); background: transparent; font-weight: 700; cursor: pointer; }
.join { flex: 0 0 260px; padding: 14px; }
</style>
