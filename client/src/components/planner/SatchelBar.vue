<script setup>

import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage } from '@/lib/api';
import TripBackpack from './TripBackpack.vue';
import Pagination from '@/components/common/Pagination.vue';
import TripModal from './TripModal.vue';
import JoinTripForm from './JoinTripForm.vue';
import BagEditor from './BagEditor.vue'

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
// "Edit bags": every bag wiggles until you pick one, then the bag editor opens for it
const editingBags = ref(false);
const bagToEdit = ref(null);
function toggleEditing() {
  editingBags.value = !editingBags.value;
}
function bagSaved(updated) {
  const t = pageTrips.value.find((x) => x.id === updated.id);
  if (t) Object.assign(t, { cover_color: updated.cover_color, bag_kind: updated.bag_kind, bag_badges: updated.bag_badges });
  bagToEdit.value = null;
  editingBags.value = false;
}
watch(() => [route.query.page, props.search, props.phase], () => (editingBags.value = false));
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
  <section class="satchel" :class="{ editing: editingBags }" aria-label="Your trips" @keydown.esc="editingBags = false">
    <h1 class="sr-only">Your trips</h1>

    <!-- one row under the nav: back to camp, search, join code -->
    <div class="topbar">
      <slot name="lead" />
      <slot name="search" />
      <JoinTripForm id="join-crew" class="join" compact @joined="joined" />
    </div>

    <div class="subbar">
      <slot name="filters" />
      <span v-if="!loading && !loadError && total > 0" class="sr-only" role="status">
        {{ total }} {{ search.trim() || phase ? 'matching ' : '' }}trip{{ total === 1 ? '' : 's' }}
      </span>
      <div v-if="!loading && !loadError && total > 0" class="edit-row">
        <button type="button" class="edit-bags" :aria-pressed="editingBags" data-cy="edit-bags" @click="toggleEditing">
          <svg v-if="!editingBags" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></svg>
          {{ editingBags ? 'Done' : 'Edit bags' }}
        </button>
      </div>
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
        <button v-if="!editingBags" type="button" class="slot new-slot" data-cy="new-trip" aria-label="New trip" @click="showNew = true">
          <TripBackpack is-new />
        </button>
        <template v-for="t in pageTrips" :key="t.id">
          <!-- edit mode: the bags wiggle, and picking one opens its editor instead of the trip -->
          <button v-if="editingBags" type="button" class="slot" data-cy="edit-bag" :aria-label="`Restyle ${t.name}'s bag`" @click="bagToEdit = t">
            <TripBackpack :trip="t" />
          </button>
          <RouterLink
            v-else
            :to="{ path: `/planner/${t.id}`, query: listQuery }"
            class="slot"
            data-cy="trip-tab"
            :aria-label="t.name"
          >
            <TripBackpack :trip="t" />
          </RouterLink>
        </template>
      </div>
    </template>

    <Pagination v-if="!loading && !loadError && total > 0" class="trip-pagination" :page="page" :total-pages="totalPages" label="Trip pages" @page-change="setPage" />

    <TripModal v-if="showNew" @close="showNew = false" @created="created" />
    <BagEditor v-if="bagToEdit" :trip="bagToEdit" @close="bagToEdit = null" @saved="bagSaved" />
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
.edit-bags {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border: 2px solid #2a1b0e;
  border-radius: 999px;
  background: #4f6b34; /* moss green */
  color: #fbf6e9;
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 3px 0 #2a1b0e;
}
.edit-bags[aria-pressed='true'] { background: #9e3b1b; } /* brick red while editing */
.edit-bags:active { translate: 0 2px; box-shadow: 0 1px 0 #2a1b0e; }
.edit-bags:focus-visible { outline: 3px solid #b4471f; outline-offset: 2px; }

/* edit mode: like the iPhone home screen, every bag jiggles, each slightly out of step */
.editing .slot :deep(.bag) {
  transform-origin: 50% 55%;
  animation: jiggle 0.3s linear infinite;
}
.editing .slot:nth-child(5n + 1) :deep(.bag) { animation-duration: 0.28s; animation-delay: -0.05s; }
.editing .slot:nth-child(5n + 2) :deep(.bag) { animation-duration: 0.33s; animation-delay: -0.21s; animation-direction: reverse; }
.editing .slot:nth-child(5n + 3) :deep(.bag) { animation-duration: 0.3s; animation-delay: -0.13s; }
.editing .slot:nth-child(5n + 4) :deep(.bag) { animation-duration: 0.35s; animation-delay: -0.27s; animation-direction: reverse; }
.editing .slot:nth-child(5n) :deep(.bag) { animation-duration: 0.31s; animation-delay: -0.09s; }
.editing .slot:hover :deep(.bag),
.editing .slot:focus-visible :deep(.bag) { animation-play-state: paused; }
@keyframes jiggle {
  0% { transform: rotate(-1.8deg) translate(0, 0); }
  25% { transform: rotate(1.4deg) translate(0.8px, -1.2px); }
  50% { transform: rotate(-1.2deg) translate(-0.8px, 0.6px); }
  75% { transform: rotate(1.8deg) translate(0.6px, 1px); }
  100% { transform: rotate(-1.8deg) translate(0, 0); }
}
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
  /* no wiggle: a dashed ring shows the bags are pickable instead */
  .editing .slot :deep(.bag) { animation: none; }
  .editing .slot { outline: 2px dashed #9a7448; outline-offset: 6px; }
}</style>