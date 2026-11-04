<script setup>

import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage } from '@/lib/api';
import TripBackpack from './TripBackpack.vue';
import Pagination from '@/components/common/Pagination.vue';
import TripModal from './TripModal.vue';
import JoinTripForm from './JoinTripForm.vue';

const props = defineProps({
  search: { type: String, default: '' },
  phase: { type: String, default: '' },
  startOpen: { type: Boolean, default: false },
});

const router = useRouter();
const route = useRoute();
const pageSize = 12;
const pageTrips = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(true);
const loadError = ref('');
const requestedPage = computed(() => {
  const value = Number(route.query.page);
  return Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? value : 1;
});
const page = ref(requestedPage.value);
function setPage(value) {
  const query = { ...route.query };
  if (value > 1) query.page = String(value);
  else delete query.page;
  return router.replace({ query });
}
let requestVersion = 0;
onBeforeUnmount(() => { requestVersion++; });
async function loadPage() {
  const version = ++requestVersion;
  loading.value = true;
  loadError.value = '';
  try {
    const { data } = await api.get('/trips', { params: {
      page: requestedPage.value, pageSize,
      search: props.search.trim() || undefined, phase: props.phase || undefined,
    } });
    if (version !== requestVersion) return;
    if (Array.isArray(data)) {
      throw new Error('The server is still using the old trip API. Restart the backend to load pagination, then retry.');
    }
    if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || !Number.isInteger(data.page) || !Number.isInteger(data.totalPages)) {
      throw new Error('The server returned an invalid trip page. Please retry.');
    }
    pageTrips.value = data.items;
    total.value = data.total;
    totalPages.value = data.totalPages;
    page.value = data.page;
    if (route.query.page !== undefined && String(data.page) !== route.query.page) await setPage(data.page);
  } catch (err) {
    if (version === requestVersion) loadError.value = errorMessage(err, 'Could not load your trips');
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}
watch(() => [route.query.page, props.search, props.phase], loadPage, { immediate: true });
const listQuery = computed(() => ({
  ...(props.search ? { search: props.search } : {}),
  ...(props.phase ? { phase: props.phase } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {}),
}));
const showNew = ref(props.startOpen);
watch(() => props.startOpen, (v) => { if (v) showNew.value = true; });

// The notice rides along in history state so the trip page can show it as a toast
function joined(trip) {
  const notice = trip.alreadyMember ? `You're already in "${trip.name}".` : `You joined "${trip.name}"!`;
  router.push({ path: `/planner/${trip.id}`, state: { notice } });
}

function created(trip) {
  showNew.value = false;
  const missing = trip.skippedUsernames || [];
  const notice =
    missing.length
      ? `"${trip.name}" is packed, but we couldn't find ${missing.map((u) => '@' + u).join(', ')}. Share the invite code instead.`
      : `"${trip.name}" is packed!`;
  router.push({ path: `/planner/${trip.id}`, state: { notice } });
}
</script>

<template>
  <section class="satchel" aria-label="Your trips">
    <h1 class="sr-only">Your trips</h1>

    <!-- one row under the nav: back to camp, search, join code -->
    <div class="topbar">
      <slot name="lead" />
      <slot name="search" />
      <JoinTripForm id="join-crew" class="join" compact @joined="joined" />
    </div>

    <div class="subbar">
      <slot name="filters" />
      <span v-if="!loading && !loadError && total > 0" class="trip-count" role="status">
        {{ total }} {{ search.trim() || phase ? 'matching ' : '' }}trip{{ total === 1 ? '' : 's' }}
      </span>
    </div>

    <p v-if="loading" role="status" class="note">Loading your trips…</p>
    <div v-else-if="loadError" role="alert" class="note">
      <p class="error-text">{{ loadError }}</p>
      <button type="button" class="btn btn-sm" @click="loadPage">Retry loading trips</button>
    </div>
    <template v-else>
      <p v-if="!total && (search || phase)" role="status" class="note">No trips match your search and status filter.</p>
      <div class="shelf">
        <!-- an empty bag first: start a new trip -->
        <button type="button" class="slot new-slot" data-cy="new-trip" aria-label="New trip" @click="showNew = true">
          <TripBackpack is-new />
        </button>
        <RouterLink
          v-for="t in pageTrips"
          :key="t.id"
          :to="{ path: `/planner/${t.id}`, query: listQuery }"
          class="slot"
          data-cy="trip-tab"
          :aria-label="t.name"
        >
          <TripBackpack :trip="t" />
        </RouterLink>
      </div>
    </template>

    <Pagination v-if="!loading && !loadError && total > 0" class="trip-pagination" :page="page" :total-pages="totalPages" label="Trip pages" @page-change="setPage" />

    <TripModal v-if="showNew" @close="showNew = false" @created="created" />
  </section>
</template>

<style scoped>
.satchel { display: flex; flex-direction: column; gap: 18px; }
.trip-pagination { margin-top: auto; }

.topbar { display: flex; align-items: center; gap: 12px; }
.join { flex: 0 1 340px; min-width: 0; }
.join :deep(.field) { margin: 0; }
.join :deep(.row) { align-items: center; }
.join :deep(.input), .join :deep(.btn) { height: 46px; min-height: 46px; }
.join :deep(.input) { min-width: 0; flex: 1; }
.join :deep(.btn) { flex-shrink: 0; padding-inline: 20px; }

.subbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.trip-count { color: #f1dfb6; font-weight: 700; font-size: 14px; }
.note { width: fit-content; margin: 0; padding: 8px 14px; border-radius: 10px; background: #f1dfb6; color: #2a1b0e; }

.shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
  gap: 30px 22px;
  padding: 10px 4px 24px;
}
.slot {
  display: block;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  border-radius: 16px;
}
.slot:focus-visible { outline: 3px solid #e0a43b; outline-offset: 6px; }
/* pick a bag up: a little hop and wobble */
.slot:hover :deep(.bag),
.slot:focus-visible :deep(.bag) { transform: translateY(-8px) rotate(-3deg); }
.slot:nth-child(even):hover :deep(.bag),
.slot:nth-child(even):focus-visible :deep(.bag) { transform: translateY(-8px) rotate(3deg); }

@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; }
  .join { flex: 1 1 100%; }
}
@media (max-width: 480px) {
  .shelf { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .slot:hover :deep(.bag), .slot:focus-visible :deep(.bag) { transform: none; }
}
</style>