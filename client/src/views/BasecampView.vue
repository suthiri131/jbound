<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useTripsStore } from "@/stores/trips";
import BasecampHouse from "@/components/basecamp/Basecamp.vue";

const auth = useAuthStore();
const trips = useTripsStore();
const router = useRouter();

// Live one-liners on each door plaque. Each loads independently; a failure just keeps the default text.
const watcherSub = ref("Check the queue");
const talesSub = ref("Read and share reviews");
const ledgerSub = ref("Split costs in S$ and RM");
const archivesSub = ref("Past trip scrapbooks");

const rooms = [
  {
    where: "The car out front",
    name: "Planner",
    job: "Plan a trip with your crew",
    to: "/planner",
  },
  {
    where: "Ground floor · left",
    name: "Watcher",
    job: "Check border congestion",
    to: "/watcher",
  },
  {
    where: "Ground floor · middle",
    name: "Tales",
    job: "Read and share reviews",
    to: "/tales",
  },
  {
    where: "Ground floor · right",
    name: "Ledger",
    job: "Split costs in S$ and RM",
    to: "/ledger",
  },
  {
    where: "The attic",
    name: "Archives",
    job: "Flip through past trip scrapbooks",
    to: "/archives",
  },
  {
    where: "Signpost",
    name: "Explorer",
    job: "Find places by vibe",
    to: "/explorer",
  },
];

const live = computed(() => trips.onTheRoad);
</script>

<template>
  <main class="container page">
    <section class="intro">
      <span class="tag-stamp">Your JB trip HQ</span>
      <h1 class="display display-xl" style="text-align: center;">
        {{ auth.firstName ? `${auth.firstName}'s` : "Your" }}
        <span class="accent">Basecamp.</span>
      </h1>
    </section>

    <RouterLink v-if="live" :to="`/planner/${live.id}`" class="live-card">
      <TripCover :trip="live" />
      <span class="hand">You're on the road! Tap to tick off stops →</span>
    </RouterLink>

    <section class="house-card" aria-label="Basecamp house: choose a door">
      <BasecampHouse
        :watcher-sub="watcherSub"
        :tales-sub="talesSub"
        :ledger-sub="ledgerSub"
        :archives-sub="archivesSub"
      />
      <IdlingCar @arrive="router.push('/planner')" />
    </section>

    <section aria-label="All rooms" class="rooms">
      <div
        class="row"
        style="justify-content: space-between; align-items: baseline"
      >
        <h2 class="display display-md" style="margin: auto;">Basecamp Navigation</h2>
      </div>
      <ul class="keys">
        <li v-for="r in rooms" :key="r.to">
          <RouterLink :to="r.to" class="key">
            <span class="eyebrow accent">{{ r.where }}</span>
            <span class="display display-sm">{{ r.name }}</span>
            <span class="muted">{{ r.job }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.intro {
  padding: 20px 0 28px;
}
.intro h1 {
  margin-top: 20px;
}
.live-card {
  display: grid;
  grid-template-columns: minmax(220px, 320px) 1fr;
  gap: 20px;
  align-items: center;
  margin-bottom: 24px;
  text-decoration: none;
  color: var(--ink);
}
.house-card {
  border: 2px solid var(--ink);
  border-radius: 18px;
  overflow: hidden;
  background: #e9ddbf;
  box-shadow: 8px 8px 0 var(--ink);
}
.rooms {
  padding-top: 56px;
}
.keys {
  list-style: none;
  margin: 22px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.key {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: 16px 18px;
  border: 2px solid var(--ink);
  border-radius: 6px 14px 14px 6px;
  background: var(--card);
  color: var(--ink);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
}
.key .eyebrow {
  font-size: 11px;
}
@media (max-width: 640px) {
  .live-card {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTripsStore } from '@/stores/trips';
// import { money } from '@/utils/format';
import BasecampHouse from '@/components/basecamp/Basecamp.vue';

const auth = useAuthStore();
const trips = useTripsStore();
const router = useRouter();

// Live one-liners on each door plaque. Each loads independently; a failure just keeps the default text.
const watcherSub = ref('Check the queue');
const talesSub = ref('Read and share reviews');
const ledgerSub = ref('Split costs in S$ and RM');
const archivesSub = ref('Past trip scrapbooks');

const rooms = [
  { where: 'The car out front', name: 'Planner', job: 'Plan a trip with your crew', to: '/planner' },
  { where: 'Ground floor · left', name: 'Watcher', job: 'Check border congestion', to: '/watcher' },
  { where: 'Ground floor · middle', name: 'Tales', job: 'Read and share reviews', to: '/tales' },
  { where: 'Ground floor · right', name: 'Ledger', job: 'Split costs in S$ and RM', to: '/ledger' },
  { where: 'The attic', name: 'Archives', job: 'Flip through past trip scrapbooks', to: '/archives' },
  { where: 'Signpost', name: 'Explorer', job: 'Find places by vibe', to: '/explorer' },
];

const live = computed(() => trips.onTheRoad);

onMounted(async () => {
  await trips.fetch().catch(() => {});
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [cong, posts, arch, bal] = await Promise.allSettled([
    api.get('/checkpoints/woodlands/congestion', { params: { direction: 'to_jb' } }),
    api.get('/posts', { params: { limit: 50 } }),
    api.get('/archives'),
    trips.defaultTrip ? api.get(`/trips/${trips.defaultTrip.id}/balances`) : Promise.reject(),
  ]);
  if (cong.status === 'fulfilled') watcherSub.value = `Woodlands now: ${cong.value.data.selected.level}`;
  if (posts.status === 'fulfilled') {
    const n = posts.value.data.items.filter((p) => p.created_at > weekAgo).length;
    talesSub.value = n ? `${n} new tale${n === 1 ? '' : 's'} this week` : 'Be the first to share';
  }
  if (arch.status === 'fulfilled') {
    const { totalTrips, years } = arch.value.data;
    archivesSub.value = totalTrips ? `${totalTrips} trips · ${years.length} year${years.length === 1 ? '' : 's'}` : 'Empty for now';
  }
  if (bal.status === 'fulfilled') {
    const summary = bal.value.data.mySummary;
    ledgerSub.value = summary[0] || `All square · ${money(bal.value.data.totalSpent)} spent`;
  }
});
</script>

<template>
  <main class="container page">
    <section class="intro">
      <span class="tag-stamp">Your JB trip HQ</span>
      <h1 class="display display-xl">{{ auth.firstName || 'Your' }}'s <span class="accent">Basecamp.</span></h1>
    </section>

    <RouterLink v-if="live" :to="`/planner/${live.id}`" class="live-card">
      <TripCover :trip="live" />
      <span class="hand">You're on the road! Tap to tick off stops →</span>
    </RouterLink>

    <section class="house-card" aria-label="Basecamp house: choose a door">
      <BasecampHouse :watcher-sub="watcherSub" :tales-sub="talesSub" :ledger-sub="ledgerSub" :archives-sub="archivesSub" />
    </section>

    <section aria-label="All rooms" class="rooms">
      <div class="row" style="justify-content: space-between; align-items: baseline">
        <h2 class="display display-md">Room keys</h2>
        <p class="hand muted" style="margin: 0">same rooms, no knocking needed</p>
      </div>
      <ul class="keys">
        <li v-for="r in rooms" :key="r.to">
          <RouterLink :to="r.to" class="key">
            <span class="eyebrow accent">{{ r.where }}</span>
            <span class="display display-sm">{{ r.name }}</span>
            <span class="muted">{{ r.job }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.intro { padding: 20px 0 28px; }
.intro h1 { margin-top: 20px; }
.live-card { display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 20px; align-items: center; margin-bottom: 24px; text-decoration: none; color: var(--ink); }
.house-card { border: 2px solid var(--ink); border-radius: 18px; overflow: hidden; background: #E9DDBF; box-shadow: 8px 8px 0 var(--ink); }
.rooms { padding-top: 56px; }
.keys { list-style: none; margin: 22px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.key { display: flex; flex-direction: column; gap: 4px; height: 100%; padding: 16px 18px; border: 2px solid var(--ink); border-radius: 6px 14px 14px 6px; background: var(--card); color: var(--ink); text-decoration: none; box-shadow: var(--shadow-sm); }
.key .eyebrow { font-size: 11px; }
@media (max-width: 640px) { .live-card { grid-template-columns: 1fr; } }
</style>
