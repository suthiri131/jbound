<script setup>
import { computed, ref, watch } from 'vue';
import { useAuth } from '@clerk/vue';
import { readTrips, tripDays } from '@/services/localTrips';
import { useRoute } from 'vue-router';
import TripSatchel from '@/components/trips/TripSatchel.vue';
import TripItinerary from '@/components/trips/TripItinerary.vue';
import TripPageLayout from '@/components/trips/TripPageLayout.vue';

const route = useRoute();
const { userId } = useAuth();
const saved = computed(() => {
  try { return { trip: userId.value ? readTrips(userId.value).find(t => t.id === route.params.tripId) : null, error: '' }; }
  catch { return { trip: null, error: 'Could not read the saved trip.' }; }
});
const days = computed(() => saved.value.trip ? tripDays(saved.value.trip.start_date, saved.value.trip.end_date) : []);
const dateFormatter = new Intl.DateTimeFormat('en-SG', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
function formatDate(date) {
  return date ? dateFormatter.format(new Date(`${date}T00:00:00Z`)) : 'Date not set';
}
const copyMessage = ref('');
watch(() => route.params.tripId, () => { copyMessage.value = ''; });

async function copyInviteCode() {
  const code = saved.value.trip?.invite_code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    copyMessage.value = 'Invite code copied.';
  } catch {
    copyMessage.value = 'Could not copy. Select the code and copy it manually.';
  }
}
</script>

<template>
  <TripPageLayout :title="saved.trip?.name || 'Trip Planner'">
    <template #heading>
      <TripSatchel :active-trip-id="String(route.params.tripId)" />
    </template>
    <p v-if="saved.error" role="alert" class="error-text">{{ saved.error }}</p>
    <p v-else-if="!saved.trip && route.params.tripId !== 'preview'">This trip was not found in this browser. Return to My Trips to create one.</p>
    <p v-else-if="route.params.tripId === 'preview'" class="muted">Planner preview</p>
    <div class="planner-columns">
      <section class="itinerary-panel" aria-labelledby="itinerary-title">
      <header class="planner-heading">
        <div class="trip-summary">
          <h1>{{ saved.trip?.name || 'Trip Planner' }}</h1>
          <div v-if="saved.trip" class="trip-dates">
            <span>{{ formatDate(saved.trip.start_date) }} – {{ formatDate(saved.trip.end_date) }}</span>
            <span v-if="days.length" class="day-count">{{ days.length }} {{ days.length === 1 ? 'day' : 'days' }}</span>
          </div>
          <p v-if="saved.trip?.mission" class="trip-mission">{{ saved.trip.mission }}</p>
        </div>
        <div v-if="saved.trip" class="trip-invite" aria-label="Trip invitation">
          <span class="invite-label">Invite code</span>
          <div v-if="saved.trip.invite_code" class="invite-actions">
            <code class="invite-code">{{ saved.trip.invite_code }}</code>
            <button class="btn btn-sm" type="button" @click="copyInviteCode">Copy</button>
          </div>
          <span v-else class="invite-pending">Available once synced</span>
          <p v-if="copyMessage" class="copy-status" role="status">{{ copyMessage }}</p>
        </div>
      </header>
        <h2 id="itinerary-title" class="sr-only">Itinerary</h2>
        <TripItinerary v-if="saved.trip && userId && days.length" :user-id="userId" :trip-id="saved.trip.id" :days="days" />
        <p v-else>Planned stops, times, and notes will go here.</p>
      </section>

    </div>
  </TripPageLayout>
</template>

<style scoped>
.planner-heading { padding-bottom: 24px; }
h1 { margin: 0 0 10px; font-size: clamp(26px, 4vw, 34px); line-height: 1.2; overflow-wrap: anywhere; }
.trip-dates { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 14px; color: var(--ink-soft); }
.day-count { font-size: 12px; color: var(--ink-mute); }
.trip-mission { margin: 12px 0 0; color: var(--ink-mute); font-size: 14px; overflow-wrap: anywhere; }
.trip-invite { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 16px; font-size: 13px; }
.invite-label { font-weight: 600; }
.invite-actions { display: flex; align-items: center; gap: 10px; }
.invite-code { user-select: all; }
.invite-pending, .copy-status { color: var(--ink-mute); }
.copy-status { margin: 0; }
.planner-columns { margin-top: 28px; }
.itinerary-panel { max-width: 800px; }
</style>
