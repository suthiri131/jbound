<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage } from '@/lib/api';
import AtticScene from '@/components/archives/AtticScene.vue';
import AtticFullModal from '@/components/archives/AtticFullModal.vue';
import ScrapbookBook from '@/components/archives/ScrapbookBook.vue';
import ScrapbookPage from '@/components/archives/ScrapbookPage.vue';
import { buildScrapbookPages } from '@/utils/scrapbookLayout';

// phases in which the server still accepts memory uploads
const UPLOAD_PHASES = ['on_the_road', 'memory_box'];

const route = useRoute();
const router = useRouter();

const tripId = computed(() => route.params.tripId || null);

const loading = ref(false);
const loadError = ref('');

const attic = ref({ capacity: 7, drawers: [], pending: [] });
const picking = ref(false); // choosing an old drawer to swap the pending trip into
const freshSlot = ref(null); // drawer that just received a swapped-in trip, so its tag pins in
const busy = ref(false);
const actionError = ref('');
let listRequest = 0;

// the open drawer's scrapbook, shown over the attic
const bookError = ref('');
const openTrip = ref(null);
const memories = ref([]);
const expenses = ref([]);
const memoryWindow = ref(null);
const view = ref(null);
const frame = ref(null);
const closeBtn = ref(null);
const navBottom = ref(0); // the drawer covers the attic, not the nav
let bookRequest = 0;
let closing = false;

const canUpload = computed(() => UPLOAD_PHASES.includes(memoryWindow.value?.phase));
const pages = computed(() => buildScrapbookPages({
  trip: openTrip.value,
  memories: memories.value,
  expenses: expenses.value,
  canUpload: canUpload.value,
}));

const pendingTrip = computed(() => attic.value.pending[0] || null);
const drawers = computed(() => attic.value.drawers.map((d) => (d.slot === freshSlot.value ? { ...d, isNew: true } : d)));

const openDrawerInfo = computed(() => attic.value.drawers.find((d) => d.trip.id === tripId.value) || null);
const fromChest = computed(() => openDrawerInfo.value?.slot >= 4);
const provenance = computed(() => {
  const d = openDrawerInfo.value;
  if (!d) return 'From the attic';
  const year = (d.trip.start_date || d.trip.archived_at || '').slice(0, 4);
  return `From the ${fromChest.value ? 'old map chest' : 'mahogany dresser'}${year ? `, ${year}` : ''}`;
});

async function loadList() {
  const id = ++listRequest;
  loading.value = true;
  loadError.value = '';
  try {
    const { data } = await api.get('/archives');
    if (id === listRequest) attic.value = data;
  } catch (err) {
    if (id === listRequest) loadError.value = errorMessage(err);
  } finally {
    if (id === listRequest) loading.value = false;
  }
}

async function loadTripScrapbook(tripIdToLoad) {
  const id = ++bookRequest;
  bookError.value = '';
  openTrip.value = null;
  try {
    const [tripRes, memoriesRes, expensesRes] = await Promise.all([
      api.get(`/trips/${tripIdToLoad}`),
      api.get(`/trips/${tripIdToLoad}/memories`),
      api.get(`/trips/${tripIdToLoad}/expenses`),
    ]);
    if (id !== bookRequest) return; // a newer trip was opened while this one loaded
    memories.value = memoriesRes.data.memories || [];
    memoryWindow.value = memoriesRes.data.window || null;
    expenses.value = expensesRes.data.expenses || [];
    openTrip.value = tripRes.data;
  } catch (err) {
    if (id === bookRequest) bookError.value = errorMessage(err, 'Could not load this scrapbook');
  }
}

const drawerEl = (id) => (id ? document.querySelector(`.attic [data-trip="${id}"]`) : null);

/** The drawer frame grows out of its drawer in the attic (or shrinks back into it). */
function morph(reverse = false) {
  const el = frame.value;
  const from = drawerEl(tripId.value);
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!el?.animate || !from || still) return Promise.resolve();
  const a = from.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const shut = { transform: `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height})`, opacity: 0.5 };
  const open = { transform: 'none', opacity: 1 };
  return el.animate(reverse ? [open, shut] : [shut, open], {
    duration: reverse ? 300 : 460,
    easing: 'cubic-bezier(.2, .8, .2, 1)',
    fill: 'both',
  }).finished.catch(() => {});
}

watch(tripId, (id) => {
  document.body.style.overflow = id ? 'hidden' : '';
  navBottom.value = Math.max(0, document.querySelector('.nav-wrap')?.getBoundingClientRect().bottom || 0);
  if (id) loadTripScrapbook(id);
  else openTrip.value = null;
}, { immediate: true });

watch(openTrip, async (trip) => {
  if (!trip) return;
  await nextTick();
  closeBtn.value?.focus({ preventScroll: true });
  morph();
});

async function closeDrawer() {
  if (closing || !tripId.value) return;
  closing = true;
  const id = tripId.value;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!still) view.value?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'both' });
  await morph(true);
  await router.push('/archives');
  closing = false;
  drawerEl(id)?.focus({ preventScroll: true });
}

function onKeydown(event) {
  if (event.key === 'Escape' && tripId.value) closeDrawer();
}

onMounted(() => {
  loadList();
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});

function openDrawer(trip) {
  router.push(`/archives/${trip.id}`);
}

async function atticAction(run) {
  busy.value = true;
  actionError.value = '';
  try {
    await run();
    picking.value = false;
    await loadList();
  } catch (err) {
    actionError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function clearPending() {
  atticAction(() => api.post(`/archives/${pendingTrip.value.id}/clear`));
}

function swapInto(drawer) {
  if (busy.value) return;
  const ok = window.confirm(`Swap “${drawer.trip.name}” out for “${pendingTrip.value.name}”? “${drawer.trip.name}” will be cleared out of your attic.`);
  if (!ok) return;
  atticAction(async () => {
    await api.put(`/archives/${pendingTrip.value.id}/drawer`, { slot: drawer.slot });
    freshSlot.value = drawer.slot;
  });
}
</script>

<template>
  <main class="attic-page">
    <h1 class="sr-only">Archives</h1>

    <div
      v-if="tripId"
      ref="view"
      class="drawer-view"
      :style="{ top: `${navBottom}px` }"
      role="dialog"
      aria-modal="true"
      :aria-label="openTrip ? `${openTrip.name} scrapbook` : 'Scrapbook'"
    >
      <header class="drawer-head">
        <p class="hand from">{{ provenance }}</p>
        <button ref="closeBtn" type="button" class="close-drawer" @click="closeDrawer">
          <span aria-hidden="true">✕</span> Close the drawer
        </button>
      </header>

      <p v-if="bookError" class="error-text card-flat card-pad" role="alert">{{ bookError }}</p>
      <p v-else-if="!openTrip" class="hand unpacking" role="status">Pulling out the drawer…</p>

      <template v-if="openTrip">
        <div ref="frame" class="drawer-frame" :class="{ chest: fromChest }">
          <ScrapbookBook :key="openTrip.id" :pages="pages" :label="`${openTrip.name} scrapbook`">
            <template #page="{ page }">
              <ScrapbookPage :page="page" />
            </template>
          </ScrapbookBook>
        </div>

        <p v-if="canUpload" class="upload">
          <RouterLink :to="`/planner/${openTrip.id}`" class="btn btn-sm">Add photos in the Memory Box →</RouterLink>
        </p>
      </template>
    </div>

    <div v-if="loadError || picking" class="overlay">
      <p v-if="loadError" class="error-text card-flat card-pad" role="alert">{{ loadError }}</p>
      <div v-if="picking" class="swap-banner card-flat" role="status">
        <span>Pick a drawer to swap out for <strong>“{{ pendingTrip?.name }}”</strong>.</span>
        <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="picking = false">Back</button>
      </div>
      <p v-if="picking && actionError" class="error-text card-flat card-pad" role="alert">{{ actionError }}</p>
    </div>

    <AtticScene
      :drawers="drawers"
      :picking="picking"
      :aria-busy="loading"
      :inert="tripId ? '' : null"
      @open="openDrawer"
      @pick="swapInto"
    >
      <p v-if="!loading && !loadError && !attic.drawers.length && !pendingTrip" class="hand empty">
        Nothing up here yet. Finished trips move into a drawer a week after they end.
      </p>
    </AtticScene>

    <AtticFullModal
      v-if="pendingTrip && !picking && !tripId"
      :trip="pendingTrip"
      :capacity="attic.capacity"
      :waiting="attic.pending.length - 1"
      :busy="busy"
      :error="actionError"
      @clear="clearPending"
      @swap="picking = true; actionError = ''"
    />
  </main>
</template>

<style scoped>
/* The attic fills everything under the nav, edge to edge */
.attic-page { position: relative; flex: 1 0 auto; display: flex; flex-direction: column; }
.overlay {
  position: sticky; top: 12px; z-index: 5; display: grid; gap: 8px;
  width: min(560px, calc(100% - 32px)); height: 0; margin: 0 auto; overflow: visible;
}
.overlay > * { margin: 12px 0 0; }
.swap-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--sand); }
.empty { margin: 0; color: #f3e6c8; font-size: clamp(17px, 2vw, 21px); text-align: center; }

/* ---------- an open drawer, pulled out over the attic ---------- */
.drawer-view {
  position: fixed; inset: 0; z-index: 60; overflow-y: auto;
  display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 14px 24px 32px;
  background: rgba(22, 14, 9, .74); backdrop-filter: blur(2px);
  animation: dim .3s ease both;
}
.drawer-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: min(100%, 1180px); }
.from { margin: 0; color: #f3e6c8; font-size: clamp(20px, 2.4vw, 28px); }
.close-drawer {
  flex: none; display: inline-flex; align-items: center; gap: 10px; padding: 10px 22px;
  border: 2px solid #f3e6c8; border-radius: 999px; background: transparent; color: #fbf6e9;
  font: inherit; font-weight: 700; cursor: pointer; transition: background .15s, color .15s;
}
.close-drawer:hover { background: #f3e6c8; color: var(--ink); }
.close-drawer:focus-visible { outline: 3px solid var(--mustard); outline-offset: 3px; }
.unpacking { margin: 18vh 0 0; color: #f3e6c8; font-size: 24px; }

/* the drawer's wood around the book, matching the piece it came out of */
.drawer-frame {
  width: min(100%, 1180px); padding: clamp(10px, 1.6vw, 18px);
  background: #6c2b1d; border: 3px solid #2a1810; border-radius: 8px;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .05), 0 18px 40px rgba(0, 0, 0, .45);
  will-change: transform;
}
.drawer-frame.chest { background: #7a4a2a; }
.drawer-frame :deep(.scrapbook) { padding-bottom: 6px; border-radius: 4px; background: #3a2216; box-shadow: inset 0 6px 14px rgba(0, 0, 0, .45); }
.drawer-frame :deep(.page-label) { color: #f3e6c8; }
.drawer-frame :deep(.hint) { color: #d9c7a3; }
.drawer-frame :deep(.close-book) { border-color: #d9c7a3; background: transparent; color: #f3e6c8; }
.upload { margin: 0; text-align: center; }

@keyframes dim { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .drawer-view { animation: none; } }
@media (max-width: 600px) {
  .drawer-view { padding: 12px 16px 24px; }
  .close-drawer { padding: 8px 14px; }
}
</style>
