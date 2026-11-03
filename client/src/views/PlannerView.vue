<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';
import SatchelBar from '@/components/planner/SatchelBar.vue';

const route = useRoute();
const router = useRouter();
const trips = useTripsStore();
const loadError = ref('');
const joining = ref(false);
const phases = ['planning', 'on_the_road', 'memory_box'];
const search = computed(() => String(route.query.search || ''));
const phase = computed(() => phases.includes(route.query.phase) ? route.query.phase : '');

function setFilter(key, value) {
  const query = { ...route.query };
  delete query.page;
  if (value) query[key] = value;
  else delete query[key];
  router.replace({ path: '/planner', query });
}

watch(() => route.query.join, async (code) => {
  if (!code) return;
  joining.value = true;
  loadError.value = '';
  try {
    const trip = await trips.join(String(code));
    const notice = trip.alreadyMember ? `You're already in "${trip.name}".` : `You joined "${trip.name}"!`;
    await router.replace({ path: `/planner/${trip.id}`, state: { notice } });
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not join this trip');
  } finally {
    joining.value = false;
  }
}, { immediate: true });

</script>

<template>
  <main class="trips-page">
    <RouterLink to="/" class="camp-back">← Basecamp</RouterLink>
    <div v-if="loadError" class="card-flat card-pad" role="alert">
      <p class="error-text">{{ loadError }}</p>
    </div>
    <p v-if="joining" class="muted" role="status">Joining your crew…</p>
    <SatchelBar :search="search" :phase="phase" :start-open="Boolean(route.query.new)">
      <template #filters>
    <section class="filters" aria-label="Filter trips">
      <label class="field">
        <span class="sr-only">Search trips</span>
        <input :value="search" class="input" type="search" placeholder="Search by trip name" @input="setFilter('search', $event.target.value)" />
      </label>
      <label class="field">
        <span class="sr-only">Trip status</span>
        <select :value="phase" class="input" @change="setFilter('phase', $event.target.value)">
          <option value="">All statuses</option>
          <option value="planning">Planning</option>
          <option value="on_the_road">On the road</option>
          <option value="memory_box">Memory box</option>
        </select>
      </label>
    </section>
      </template>
    </SatchelBar>
  </main>
</template>

<style scoped>
.trips-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px clamp(14px, 3vw, 44px) 30px;
  font-family: var(--font-round);
  background: repeating-linear-gradient(90deg, #7a4d2c 0 150px, #6c4326 150px 153px, #744829 153px 300px, #6c4326 300px 303px);
  box-shadow: inset 0 0 90px rgba(40, 20, 5, 0.55);
}
.trips-page > :deep(.satchel) { flex: 1; }
/* the heading is a sheet of paper on the table; each trip is a folder lying on it */
.trips-page :deep(.head), .trips-page :deep(.toolbar) { padding: 16px 20px; background: #f1dfb6; border-radius: 3px; }
.trips-page :deep(.head) { margin-bottom: -28px; padding-bottom: 8px; }
.trips-page :deep(.toolbar) { padding-top: 8px; box-shadow: 0 8px 16px rgba(40, 20, 5, 0.4); }
.trips-page :deep(.head h1) { font-family: var(--font-story); font-weight: 800; font-size: 30px; text-align: left; }
.trips-page :deep(.head), .trips-page :deep(.trip-count), .trips-page :deep(.heading p) { color: #2a1b0e; }
.trips-page :deep(.empty) { background: #f1dfb6; border-color: #4a2c1a; }
.trips-page :deep(.empty), .trips-page :deep(.satchel > [role='status']), .trips-page :deep(.satchel > [role='alert']) { color: #2a1b0e; }
.trips-page :deep(.satchel > [role='status']) { width: fit-content; padding: 6px 14px; border-radius: 8px; background: #f1dfb6; }
.trips-page :deep(.slot) { transition: rotate 0.15s, translate 0.15s; }
.trips-page :deep(.slot:nth-child(odd)) { rotate: -1.1deg; }
.trips-page :deep(.slot:nth-child(even)) { rotate: 0.9deg; }
.trips-page :deep(.slot:hover), .trips-page :deep(.slot:focus-visible) { rotate: 0deg; translate: 0 -4px; }
.trips-page :deep(.cover) { min-height: 150px; border: 0; border-radius: 4px; box-shadow: 0 8px 14px rgba(40, 20, 5, 0.45), inset 0 -10px 0 rgba(0, 0, 0, 0.18); }
.trips-page :deep(.cover .name) { font-family: var(--font-story); font-weight: 800; font-size: 24px; }
.trips-page :deep(.trip-pagination) { padding: 6px 12px; border-radius: 10px; background: #f1dfb6; }
.filters { display: flex; flex: 2 1 440px; min-width: 0; align-items: center; gap: 12px; }
.filters .field:first-child { flex: 1 1 240px; min-width: 0; }
.filters .field:last-child { flex: 0 0 170px; }
.filters .input { height: 46px; min-height: 46px; margin: 0; line-height: normal; }
@media (max-width: 800px) {
  .filters { flex: auto; width: 100%; }
}
@media (max-width: 600px) {
  .filters { flex-wrap: wrap; }
  .filters .field:first-child, .filters .field:last-child { flex: 1 1 100%; max-width: none; margin-left: 0; }
}
</style>
