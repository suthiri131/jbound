<script setup>
import { computed, ref } from 'vue';
import { useAuth } from '@clerk/vue';
import { readTrips } from '@/services/localTrips';

defineProps({ activeTripId: { type: String, default: '' } });
const { userId } = useAuth();
const inviteCode = ref('');
const saved = computed(() => {
  try { return { trips: userId.value ? readTrips(userId.value) : [], error: '' }; }
  catch { return { trips: [], error: 'Could not load your trips.' }; }
});
function dateLabel(date) {
  return date ? new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : 'Dates not set';
}
</script>

<template>
  <section class="satchel" aria-label="Your trips">
    <header class="satchel-heading">
      <h2 id="satchel-title">My Trips</h2>
      <p>Pick a trip to open its itinerary</p>
    </header>
    <p v-if="saved.error" class="error-text" role="alert">{{ saved.error }}</p>
    <div class="satchel-items">
      <RouterLink v-for="trip in saved.trips" :key="trip.id" class="trip-tile"
        :class="{ selected: trip.id === activeTripId }" :aria-current="trip.id === activeTripId ? 'page' : undefined"
        :to="{ name: 'trip-planner', params: { tripId: trip.id } }">
        <span class="trip-date">{{ dateLabel(trip.start_date) }} – {{ dateLabel(trip.end_date) }}</span>
        <h3>{{ trip.name }}</h3>
        <span class="tile-action">{{ trip.id === activeTripId ? 'Current trip' : 'Open itinerary →' }}</span>
      </RouterLink>
      <RouterLink class="new-trip" :to="{ name: 'create-trip' }">+ Create trip</RouterLink>
      <div class="join-trip">
        <label class="field" for="join-invite-code">Join a trip with an invite code</label>
        <div class="join-row">
          <input id="join-invite-code" v-model="inviteCode" class="input" placeholder="Enter invite code" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="join-help" />
          <button class="btn btn-dark btn-sm" type="button" disabled aria-describedby="join-help">Join</button>
        </div>
        <p id="join-help">Joining will be available once connected.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.satchel { padding: 20px; border: 2px solid var(--ink); border-radius: 14px; background: var(--paper-deep); }
.satchel-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
h2 { margin: 0; font-family: var(--font-display); font-size: 24px; font-weight: 400; }
.satchel-heading p { margin: 0; font-size: 13px; color: var(--ink-mute); }
.satchel-items { display: flex; gap: 16px; overflow-x: auto; padding: 4px 4px 10px; }
.trip-tile, .new-trip, .join-trip { flex: 0 0 220px; min-height: 165px; padding: 18px; border: 2px solid var(--ink); border-radius: 12px; }
.trip-tile { display: flex; flex-direction: column; color: var(--card); background: var(--jungle); text-decoration: none; box-shadow: 3px 4px 0 var(--ink); }
.trip-tile:nth-child(3n + 2) { background: var(--teal); }
.trip-tile:nth-child(3n) { background: var(--ember); }
.trip-tile:hover { transform: translateY(-2px); color: var(--card); }
.trip-tile.selected { outline: 3px solid var(--mustard); outline-offset: 1px; }
.trip-date { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
h3 { margin: 10px 0 20px; font-family: var(--font-display); font-size: 21px; font-weight: 400; line-height: 1.3; overflow-wrap: anywhere; }
.tile-action { margin-top: auto; font-size: 12px; }
.new-trip { display: flex; align-items: center; justify-content: center; border-style: dashed; font-weight: 700; text-align: center; text-decoration: none; color: var(--ink); }
.join-trip { flex-basis: 300px; background: var(--card); }
.join-row { display: flex; gap: 8px; margin-top: 12px; }
.join-row input { min-width: 0; }
.join-trip p { font-size: 12px; color: var(--ink-mute); margin: 10px 0 0; }
@media (max-width: 600px) { .satchel { padding: 14px; } }
</style>
