<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/utils/format';

const router = useRouter();

const loading = ref(false);
const loadError = ref('');
const items = ref([]);

function dateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

const grouped = computed(() => {
  const groups = [];
  let lastLabel = null;
  for (const item of items.value) {
    const label = dateLabel(item.created_at);
    if (label !== lastLabel) {
      groups.push({ label, items: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
});

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const { data: trips } = await api.get('/trips', { params: { include: 'all' } });

    const perTrip = await Promise.all(
      trips.map((t) =>
        api
          .get(`/trips/${t.id}/messages`, { params: { limit: 50 } })
          .then((res) => res.data.map((m) => ({ ...m, trip: t })))
          .catch(() => []),
      ),
    );

    items.value = perTrip
      .flat()
      .filter((m) => m.kind === 'system')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (err) {
    loadError.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

function openTrip(item) {
  const dest = item.trip.phase === 'archived' ? `/archives/${item.trip.id}` : `/planner/${item.trip.id}`;
  router.push(dest);
}

onMounted(load);
</script>

<template>
  <main class="container page notifications">
    <div class="row crumbs">
      <span class="eyebrow muted">Notifications</span>
    </div>

    <h1 class="display display-lg">What's been happening.</h1>
    <p class="lead">Every change across your trips, newest first.</p>

    <p v-if="loadError" class="error-text card-flat card-pad" role="alert">{{ loadError }}</p>
    <p v-if="loading" class="hand muted">Loading…</p>

    <section v-if="!loading && !items.length" class="card card-pad empty">
      <p>Nothing yet. Activity across your trips will show up here.</p>
    </section>

    <div v-for="group in grouped" :key="group.label" class="group">
      <h2 class="group-label">{{ group.label }}</h2>
      <ul class="feed">
        <li v-for="item in group.items" :key="item.id">
          <button type="button" class="row-item" @click="openTrip(item)">
            <span class="text">{{ item.text }}</span>
            <span class="meta">
              <span class="trip-name">{{ item.trip.name }}</span>
              <span class="dot">·</span>
              <span class="time">{{ timeAgo(item.created_at) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </main>
</template>

<style scoped>
.group { margin-top: 24px; }
.group-label { font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-mute); margin: 0 0 8px; }
.feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row-item { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; text-align: left; background: var(--card); border: 2px solid var(--ink); border-radius: 10px; padding: 12px 14px; cursor: pointer; font: inherit; color: inherit; }
.row-item:hover { box-shadow: var(--shadow-sm); }
.text { font-size: 15px; }
.meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-mute); }
.trip-name { font-weight: 700; }
.empty { margin-top: 20px; }
</style>