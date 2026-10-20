<script setup>
/**
 * Trip grid for the Planner: one cover per trip,
 * "+ New trip" (opens TripModal) and a join-by-code box.
 */
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';
import TripCover from '@/components/common/TripCover.vue';
import TripModal from './TripModal.vue';

const props = defineProps({
  search: { type: String, default: '' },
  phase: { type: String, default: '' },
  startOpen: { type: Boolean, default: false },
});

const trips = useTripsStore();
const router = useRouter();
const filteredTrips = computed(() => trips.trips.filter((trip) =>
  (!props.phase || trip.phase === props.phase) &&
  trip.name.toLowerCase().includes(props.search.trim().toLowerCase())
));
const listQuery = computed(() => ({
  ...(props.search ? { search: props.search } : {}),
  ...(props.phase ? { phase: props.phase } : {}),
}));
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
    <header class="head">
      <div class="heading">
        <h1 class="display display-md">Your trips</h1>
        <p class="muted">Your next adventure starts here. Pick a trip to keep planning.</p>
      </div>
      <div class="actions">
      <form id="join-crew" class="join" @submit.prevent="join">
        <label class="sr-only" for="invite-code">Join a crew with an invite code</label>
        <div class="join-controls">
          <input id="invite-code" v-model="code" class="input" placeholder="Enter invite code" :aria-describedby="joinError ? 'join-err' : undefined" />
          <button type="submit" class="btn" :disabled="joining || !code.trim()">{{ joining ? 'Joining…' : 'Join' }}</button>
        </div>
        <p v-if="joinError" id="join-err" class="error-text" role="alert">{{ joinError }}</p>
      </form>
        <button type="button" class="btn btn-primary" data-cy="new-trip" @click="showNew = true">+ New trip</button>
      </div>
    </header>

    <div class="toolbar">
      <slot name="filters" />

    </div>

    <p v-if="trips.loading" role="status" class="muted">Loading your trips…</p>
    <div v-else-if="!trips.trips.length" class="empty">
      <h3 class="display display-sm">No trips yet</h3>
      <p>Create a new trip above, or join a friend's crew with an invite code.</p>
    </div>
    <p v-else-if="!filteredTrips.length" role="status">No trips match your search and status filter.</p>
    <div v-else class="shelf">
      <RouterLink
        v-for="t in filteredTrips"
        :key="t.id"
        :to="{ path: `/planner/${t.id}`, query: listQuery }"
        class="slot"
        data-cy="trip-tab"
      >
        <TripCover :trip="t" />
      </RouterLink>

    </div>

    <TripModal v-if="showNew" @close="showNew = false" @created="created" />
  </section>
</template>

<style scoped>
.satchel { display: flex; flex-direction: column; gap: 28px; }
.head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
.heading h1 { display: flex; align-items: center; gap: 14px; margin: 8px 0 10px; }
.heading p { margin: 0; font-size: 15px; }
.actions { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.actions .btn { min-height: 46px; white-space: nowrap; }
.toolbar { display: flex; align-items: flex-start; gap: 16px; }
.join { width: 260px; min-width: 0; }
.join-controls { display: flex; gap: 10px; }
.join-controls .input, .join-controls .btn { height: 46px; min-height: 46px; }
.join-controls .input { min-width: 0; flex: 1; }
.join-controls .btn { flex-shrink: 0; }
.shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 20px; padding: 0 4px 20px 0; }
.empty { text-align: center; padding: 48px 20px; border: 2px dashed var(--ink); border-radius: var(--radius); background: var(--paper-deep); }
.slot { min-width: 0; text-decoration: none; }
.slot :deep(.cover) { height: 100%; }
@media (max-width: 800px) {
  .toolbar { flex-direction: column; }
}
@media (max-width: 600px) {
  .satchel { gap: 24px; }
  .head { gap: 20px; }
  .actions { width: 100%; }
  .join { flex: 1 1 100%; width: 100%; }
  .actions > .btn { flex: 1; }
  .heading p { max-width: 32ch; line-height: 1.6; }
}
</style>
