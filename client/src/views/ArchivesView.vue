<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage } from '@/lib/api';
import TripCover from '@/components/common/TripCover.vue';
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

const archivedTrips = ref([]);
const openTrip = ref(null);
const memories = ref([]);
const expenses = ref([]);
const memoryWindow = ref(null);
let request = 0;

const canUpload = computed(() => UPLOAD_PHASES.includes(memoryWindow.value?.phase));
const pages = computed(() => buildScrapbookPages({
  trip: openTrip.value,
  memories: memories.value,
  expenses: expenses.value,
  canUpload: canUpload.value,
}));

async function loadList() {
  const id = ++request;
  loading.value = true;
  loadError.value = '';
  try {
    const { data } = await api.get('/trips', { params: { include: 'all' } });
    if (id === request) archivedTrips.value = data.filter((t) => t.phase === 'archived');
  } catch (err) {
    if (id === request) loadError.value = errorMessage(err);
  } finally {
    if (id === request) loading.value = false;
  }
}

async function loadTripScrapbook(tripIdToLoad) {
  const id = ++request;
  loading.value = true;
  loadError.value = '';
  openTrip.value = null;
  try {
    const [tripRes, memoriesRes, expensesRes] = await Promise.all([
      api.get(`/trips/${tripIdToLoad}`),
      api.get(`/trips/${tripIdToLoad}/memories`),
      api.get(`/trips/${tripIdToLoad}/expenses`),
    ]);
    if (id !== request) return; // a newer trip was opened while this one loaded
    memories.value = memoriesRes.data.memories || [];
    memoryWindow.value = memoriesRes.data.window || null;
    expenses.value = expensesRes.data.expenses || [];
    openTrip.value = tripRes.data;
  } catch (err) {
    if (id === request) loadError.value = errorMessage(err, 'Could not load this scrapbook');
  } finally {
    if (id === request) loading.value = false;
  }
}

watch(
  tripId,
  (id) => {
    if (id) loadTripScrapbook(id);
    else loadList();
  },
  { immediate: true },
);

function backToList() {
  router.push('/archives');
}
</script>

<template>
  <main class="container page archives">
    <div class="row crumbs">
      <span class="eyebrow muted">Archives</span>
    </div>

    <p v-if="loadError" class="error-text card-flat card-pad" role="alert">{{ loadError }}</p>
    <p v-if="loading" class="hand muted" role="status">Loading…</p>

    <template v-if="!tripId">
      <h1 class="display display-lg">Past trips, packed away.</h1>
      <p class="lead">Every finished trip ends up here as a drawer, scrapbook included.</p>

      <section v-if="!loading && !archivedTrips.length" class="card card-pad empty">
        <p>No archived trips yet. Finished trips move here automatically a week after they end.</p>
      </section>

      <div v-else class="grid">
        <RouterLink v-for="t in archivedTrips" :key="t.id" :to="`/archives/${t.id}`" class="cover-link">
          <TripCover :trip="t" />
        </RouterLink>
      </div>
    </template>

    <template v-else>
      <button type="button" class="btn btn-ghost btn-sm" @click="backToList">← Back to Archives</button>

      <template v-if="openTrip">
        <ScrapbookBook :key="openTrip.id" :pages="pages" :label="`${openTrip.name} scrapbook`">
          <template #page="{ page }">
            <ScrapbookPage :page="page" />
          </template>
        </ScrapbookBook>

        <p v-if="canUpload" class="upload">
          <RouterLink :to="`/planner/${openTrip.id}`" class="btn btn-sm">Add photos in the Memory Box →</RouterLink>
        </p>
      </template>
    </template>
  </main>
</template>

<style scoped>
/* .page resets .container's side padding, so put the gutter back */
.archives { padding-right: 24px; padding-left: 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; margin-top: 20px; }
.cover-link { display: block; text-decoration: none; }
.empty { margin-top: 20px; }
.upload { margin: 14px 0 0; text-align: center; }
@media (max-width: 600px) {
  .archives { padding-right: 16px; padding-left: 16px; }
}
</style>
