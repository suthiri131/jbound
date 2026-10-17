<script setup>
import { computed, ref } from 'vue';
import RouteMap from '@/components/planner/RouteMap.vue';

const days = [
  {
    id: 'day-1',
    label: 'Day 1 · JB city',
    stops: [
      { id: 'checkpoint', name: 'JB Sentral', lat: 1.4636, lng: 103.7648 },
      { id: 'temple', name: 'Johor Old Chinese Temple', lat: 1.4596, lng: 103.7623 },
      { id: 'bakery', name: 'Hiap Joo Bakery', lat: 1.4628, lng: 103.7614 },
    ],
  },
  {
    id: 'day-2',
    label: 'Day 2 · Theme parks',
    stops: [
      { id: 'legoland', name: 'LEGOLAND Malaysia', lat: 1.4268, lng: 103.6299 },
      { id: 'midvalley', name: 'Mid Valley Southkey', lat: 1.5005, lng: 103.7790 },
    ],
  },
];

const activeDayId = ref(days[0].id);
const version = ref(0);
const activeDay = computed(() => days.find((day) => day.id === activeDayId.value));
const stops = computed(() => activeDay.value.stops);

function switchDay(dayId) {
  activeDayId.value = dayId;
  version.value += 1;
}
</script>

<template>
  <main class="planner-page">
    <header class="planner-heading">
      <p class="eyebrow">THE BUCKET LIST</p>
      <h1 class="display display-lg">Plan the crossing</h1>
      <p class="muted">Pick a day to see its stops and driving route.</p>
    </header>

    <div class="day-tabs" role="tablist" aria-label="Trip days">
      <button
        v-for="day in days"
        :key="day.id"
        type="button"
        role="tab"
        :aria-selected="activeDayId === day.id"
        :class="{ active: activeDayId === day.id }"
        @click="switchDay(day.id)"
      >{{ day.label }}</button>
    </div>

    <section class="planner-layout" :data-day="activeDay.id">
      <div class="stop-list card card-pad">
        <h2 class="display display-sm">{{ activeDay.label }}</h2>
        <ol>
          <li v-for="stop in stops" :key="stop.id">
            <span class="stop-number">{{ stops.indexOf(stop) + 1 }}</span>
            <span>{{ stop.name }}</span>
          </li>
        </ol>
      </div>
      <RouteMap :stops="stops" :version="version" />
    </section>
  </main>
</template>

<style scoped>
.planner-page { width: min(100% - 40px, 1180px); margin: 0 auto; padding: 42px 0 72px; }
.planner-heading { margin-bottom: 24px; }
.planner-heading h1 { margin: 0 0 8px; }
.planner-heading p:last-child { margin: 0; }
.day-tabs { display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; }
.day-tabs button { flex: 0 0 auto; min-height: 44px; padding: 0 16px; border: 2px solid var(--ink); border-radius: 999px; background: var(--card); color: var(--ink); font-weight: 700; cursor: pointer; }
.day-tabs button.active { background: var(--ink); color: var(--paper); }
.planner-layout { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(0, 2fr); align-items: start; gap: 22px; }
.stop-list { min-width: 0; }
.stop-list h2 { margin-bottom: 14px; }
.stop-list ol { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.stop-list li { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stop-number { display: grid; flex: 0 0 28px; width: 28px; height: 28px; place-items: center; border: 2px solid var(--ink); border-radius: 50%; background: var(--mustard); font-weight: 800; }
@media (max-width: 700px) {
  .planner-page { width: min(100% - 28px, 1180px); padding-top: 26px; }
  .planner-layout { grid-template-columns: minmax(0, 1fr); gap: 18px; }
}
</style>
