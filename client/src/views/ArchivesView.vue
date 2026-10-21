<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage, assetUrl } from '@/lib/api';
import TripCover from '@/components/common/TripCover.vue';
import { shortDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();

const tripId = computed(() => route.params.tripId || null);

const loading = ref(false);
const loadError = ref('');

const archivedTrips = ref([]);
const openTrip = ref(null);
const memories = ref([]);

async function loadList() {
  loading.value = true;
  loadError.value = '';
  try {
    const { data } = await api.get('/trips', { params: { include: 'all' } });
    archivedTrips.value = data.filter((t) => t.phase === 'archived');
  } catch (err) {
    loadError.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function loadTripScrapbook(id) {
  loading.value = true;
  loadError.value = '';
  try {
    const [tripRes, memoriesRes] = await Promise.all([
      api.get(`/trips/${id}`),
      api.get(`/trips/${id}/memories`),
    ]);
    openTrip.value = tripRes.data;
    memories.value = memoriesRes.data.memories;
  } catch (err) {
    loadError.value = errorMessage(err);
  } finally {
    loading.value = false;
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
    <p v-if="loading" class="hand muted">Loading…</p>

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
        <h1 class="display display-lg">{{ openTrip.name }}</h1>
        <p class="lead">{{ shortDate(openTrip.start_date) }} – {{ shortDate(openTrip.end_date) }}</p>

        <p v-if="!loading && !memories.length" class="hand muted">No photos were packed for this trip.</p>

        <div v-else class="grid">
          <figure v-for="m in memories" :key="m.id" class="polaroid">
            <img v-if="m.image_url" :src="assetUrl(m.image_url)" :alt="m.caption || `Photo by ${m.author?.name}`" loading="lazy" />
            <div v-else class="placeholder-photo" style="height: 130px">[photo · {{ m.author?.name }}]</div>
            <figcaption>
              <p v-if="m.caption" class="cap">{{ m.caption }}</p>
              <span class="by">by {{ m.author?.name }}</span>
            </figcaption>
          </figure>
        </div>
      </template>
    </template>
  </main>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; margin-top: 20px; }
.cover-link { display: block; text-decoration: none; }
.empty { margin-top: 20px; }
.polaroid { background: var(--card); border: 2px solid var(--ink); border-radius: 10px; padding: 10px 10px 14px; box-shadow: var(--shadow-sm); }
.polaroid img { width: 100%; height: 160px; object-fit: cover; border-radius: 6px; }
.polaroid figcaption { margin-top: 8px; }
.polaroid .cap { margin: 0 0 4px; font-size: 14px; }
.polaroid .by { font-size: 12px; color: var(--ink-mute); }
</style>