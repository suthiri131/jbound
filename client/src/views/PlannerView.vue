<script setup>
import BackLabel from "@/components/common/BackLabel.vue";
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTripsStore } from '@/stores/trips';
import { errorMessage } from '@/lib/api';
import { useCampSky } from '@/composables/useCampSky';
import SatchelBar from '@/components/planner/SatchelBar.vue';
import WanderingEyes from '@/components/common/WanderingEyes.vue';
import SearchBar from '@/components/common/SearchBar.vue';

const route = useRoute();
const router = useRouter();
const trips = useTripsStore();
const { isNight } = useCampSky({ weather: false });
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
  <main class="trips-page" :class="{ night: isNight }">
    <div v-if="loadError" class="card-flat card-pad" role="alert">
      <p class="error-text">{{ loadError }}</p>
    </div>
    <WanderingEyes v-if="joining" center text="Joining your crew…" />
    <SatchelBar :search="search" :phase="phase" :start-open="Boolean(route.query.new)">
      <template #lead>
        <RouterLink to="/" class="camp-back back-camp" aria-label="Back to Basecamp" title="Back to Basecamp">
          <BackLabel />
        </RouterLink>
      </template>
      <template #search>
        <SearchBar :model-value="search" placeholder="Search your trips" @update:model-value="setFilter('search', $event)" />
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
  /* by day a light oak table, by night (see .night below) the dark wood */
  background: repeating-linear-gradient(90deg, #f3e3bd 0 150px, #e3cc9a 150px 152px, #efdcb0 152px 300px, #e3cc9a 300px 302px);
  box-shadow: inset 0 0 80px rgba(120, 80, 30, 0.16);}
.trips-page > :deep(.satchel) { flex: 1; }
/* night: the dark wood, and the writing on the table turns light so it still reads */
.trips-page.night {
  background: repeating-linear-gradient(90deg, #7a4d2c 0 150px, #6c4326 150px 153px, #744829 153px 300px, #6c4326 300px 303px);
  box-shadow: inset 0 0 90px rgba(40, 20, 5, 0.55);
}
.trips-page.night :deep(.dates),
.trips-page.night :deep(.edit-hint) { color: #ecd9b0; }
.trips-page.night :deep(.caption) { color: #fbf1dc; }
.trips-page.night :deep(.new-text) { color: #f1dfb6; }
.trips-page.night :deep(.new .s),
.trips-page.night :deep(.new .ink),
.trips-page.night :deep(.new .strap-ink) { stroke: #e3c99a; }
.trips-page.night :deep(.ground) { fill: rgba(20, 8, 0, 0.35); }
.trips-page.night :deep(.new .f-bag),
.trips-page.night :deep(.new .f-side),
.trips-page.night :deep(.new .f-deep),
.trips-page.night :deep(.new .label) { fill: rgba(255, 240, 210, 0.08); }
.trips-page :deep(.trip-pagination) { padding: 6px 12px; border-radius: 10px; background: #f1dfb6; }

/* back to camp: arrow + tent */
.back-camp {
  flex: none;
  height: 46px;
  box-sizing: border-box;
  padding: 0 14px;
  gap: 6px;
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