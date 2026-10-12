<script setup>
import { computed, reactive, ref } from 'vue';
import { useAuth } from '@clerk/vue';
import { useRouter } from 'vue-router';
import TripPageLayout from '@/components/trips/TripPageLayout.vue';
import { createLocalTrip, tripDays } from '@/services/localTrips';

const { userId } = useAuth();
const router = useRouter();
const form = reactive({ name: '', mission: '', start_date: '', end_date: '', cover_color: '#2E5A3C' });
const error = ref('');
const saving = ref(false);
const days = computed(() => tripDays(form.start_date, form.end_date));

async function createTrip() {
  error.value = '';
  const name = form.name.trim();
  const mission = form.mission.trim();
  if (!name || name.length > 100) { error.value = 'Enter a trip name between 1 and 100 characters.'; return; }
  if (mission.length > 160) { error.value = 'Keep the mission within 160 characters.'; return; }
  if (!form.start_date || !form.end_date || form.end_date < form.start_date) {
    error.value = 'Choose both dates, with the end on or after the start.'; return;
  }
  saving.value = true;
  try {
    const trip = createLocalTrip(userId.value, { ...form, name, mission: mission || null });
    await router.push({ name: 'trip-planner', params: { tripId: trip.id } });
  } catch {
    error.value = 'Could not save your trip. Check that you are signed in and browser storage is available.';
  } finally { saving.value = false; }
}
</script>

<template>
  <TripPageLayout title="Create Trip" description="Give your trip a name and choose your travel dates.">
    <form class="card card-pad trip-form" @submit.prevent="createTrip">
      <label class="field" for="name">Trip name
        <input id="name" v-model="form.name" class="input" required maxlength="100" placeholder="A weekend in JB" />
      </label>
      <label class="field" for="mission">Mission (optional)
        <textarea id="mission" v-model="form.mission" class="textarea" maxlength="160" placeholder="Food, friends, and a little exploring" />
        <span class="muted">{{ form.mission.length }} / 160</span>
      </label>
      <div class="date-fields">
        <label class="field" for="start-date">Start date
          <input id="start-date" v-model="form.start_date" class="input" type="date" required />
        </label>
        <label class="field" for="end-date">End date
          <input id="end-date" v-model="form.end_date" class="input" type="date" :min="form.start_date || undefined" required />
        </label>
      </div>
      <p v-if="days.length">{{ days.length }} {{ days.length === 1 ? 'day' : 'days' }} — each day gets its own list of stops.</p>
      <label class="field" for="cover-color">Trip colour
        <input id="cover-color" v-model="form.cover_color" type="color" />
      </label>
      <p class="muted">For now, trips are saved in this browser only.</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="row">
        <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Creating…' : 'Create trip' }}</button>
        <RouterLink :to="{ name: 'my-trips' }">Cancel</RouterLink>
      </div>
    </form>
  </TripPageLayout>
</template>

<style scoped>
.trip-form { max-width: 680px; display: grid; gap: 20px; }
.date-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
p { margin: 0; }
input[type='color'] { width: 64px; height: 44px; }
@media (max-width: 600px) { .date-fields { grid-template-columns: 1fr; } }
</style>
