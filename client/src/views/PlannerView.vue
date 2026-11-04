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
const phaseTabs = [
  { value: '', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'on_the_road', label: 'On the road' },
  { value: 'memory_box', label: 'Memory box' },
];
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
    <div v-if="loadError" class="card-flat card-pad" role="alert">
      <p class="error-text">{{ loadError }}</p>
    </div>
    <p v-if="joining" class="muted" role="status">Joining your crew…</p>
    <SatchelBar :search="search" :phase="phase" :start-open="Boolean(route.query.new)">
      <template #lead>
        <RouterLink to="/" class="camp-back back-camp" aria-label="Back to Basecamp" title="Back to Basecamp">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          <span aria-hidden="true">⛺</span>
        </RouterLink>
      </template>
      <template #search>
        <label class="search">
          <span class="sr-only">Search your trips</span>
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input :value="search" class="input" type="search" placeholder="Search your trips" @input="setFilter('search', $event.target.value)" />
        </label>
      </template>
      <template #filters>
        <div class="tabs" role="group" aria-label="Trip status">
          <button
            v-for="tab in phaseTabs"
            :key="tab.value || 'all'"
            type="button"
            class="tab"
            :data-phase="tab.value || 'all'"
            :aria-pressed="phase === tab.value"
            @click="setFilter('phase', tab.value)"
          >{{ tab.label }}</button>
        </div>
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
.trips-page :deep(.trip-pagination) { padding: 6px 12px; border-radius: 10px; background: #f1dfb6; }

/* back to camp: arrow + tent */
.back-camp {
  flex: none;
  height: 46px;
  box-sizing: border-box;
  padding: 0 14px;
  gap: 6px;
  font-size: 20px;
}

/* search: magnifier inside the bar on the left */
.search {
  position: relative;
  flex: 1 1 260px;
  min-width: 0;
}
.search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  translate: 0 -50%;
  color: #5a4a36;
  pointer-events: none;
}
.search .input {
  width: 100%;
  height: 46px;
  min-height: 46px;
  margin: 0;
  padding-left: 46px;
  border-radius: 999px;
  line-height: normal;
}

/* status tabs, like dividers in a bag */
.tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.tab {
  min-height: 36px;
  padding: 0 14px;
  border: 2px solid #2a1b0e;
  border-radius: 999px;
  background: rgba(241, 223, 182, 0.85);
  color: #2a1b0e;
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}
.tab[aria-pressed='true'] {
  background: #e0a43b;
  box-shadow: 0 3px 0 #2a1b0e;
}
.tab:focus-visible { outline: 3px solid #fbf6e9; outline-offset: 2px; }
/* phones: one swipeable row of tabs instead of wrapping */
@media (max-width: 480px) {
  .tabs { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; padding-bottom: 4px; scrollbar-width: none; }
  .tab { flex: none; }
}
</style>