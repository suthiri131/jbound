<script setup>
/**
 * Horizontal satchel at the top of the Planner: one cover per trip,
 * "+ Pack a new trip" (opens TripModal) and a join-by-code box.
 */
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTripsStore } from '@/stores/trips';
import TripCover from '@/components/common/TripCover.vue';
import TripModal from './TripModal.vue';
import JoinTripForm from './JoinTripForm.vue';

const props = defineProps({
  currentId: { type: String, default: '' },
  startOpen: { type: Boolean, default: false },
});

// `notice` lets the Planner show a toast ("You joined …") after we navigate to the trip
const emit = defineEmits(['notice']);
const trips = useTripsStore();
const router = useRouter();
const showNew = ref(props.startOpen);
watch(() => props.startOpen, (v) => { if (v) showNew.value = true; });

function joined(trip) {
  emit('notice', trip.alreadyMember ? `You're already in "${trip.name}".` : `You joined "${trip.name}"!`);
  router.push(`/planner/${trip.id}`);
}

function created(trip) {
  showNew.value = false;
  emit('notice', `"${trip.name}" is packed!`);
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

      <JoinTripForm class="join card-flat" @joined="joined" />
    </div>

    <TripModal v-if="showNew" @close="showNew = false" @created="created" />
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
