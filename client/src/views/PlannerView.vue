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
  if (value) query[key] = value;
  else delete query[key];
  router.replace({ path: '/planner', query });
}

async function load() {
  loadError.value = '';
  try {
    await trips.fetch(true);
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load your trips');
  }
}

watch(() => route.query.join, async (code) => {
  if (!code) return;
  joining.value = true;
  loadError.value = '';
  try {
    const trip = await trips.join(String(code));
    await router.replace(`/planner/${trip.id}`);
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not join this trip');
  } finally {
    joining.value = false;
  }
}, { immediate: true });

load();
</script>

<template>
  <main class="container page trips-page">
    <div v-if="loadError" class="card-flat card-pad" role="alert">
      <p class="error-text">{{ loadError }}</p>
      <button class="btn btn-dark btn-sm" type="button" @click="load">Retry loading trips</button>
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
.trips-page { display: flex; flex-direction: column; gap: 20px; padding-top: 36px; }
.filters { display: flex; flex: 2 1 440px; min-width: 0; align-items: center; gap: 12px; }
.filters .field:first-child { flex: 1 1 240px; min-width: 0; }
.filters .field:last-child { flex: 0 0 170px; }
.filters .input { height: 46px; min-height: 46px; margin: 0; line-height: normal; }
@media (max-width: 800px) {
  .filters { flex: auto; width: 100%; }
}
@media (max-width: 600px) {
  .filters { flex-wrap: wrap; }
  .trips-page { padding-top: 24px; }
  .filters .field:first-child, .filters .field:last-child { flex: 1 1 100%; max-width: none; margin-left: 0; }
}
</style>
