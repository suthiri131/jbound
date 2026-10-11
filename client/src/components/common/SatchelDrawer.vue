<script setup>
import { onMounted } from 'vue';
import { useTripsStore } from '@/stores/trips';
import TripCover from './TripCover.vue';

const emit = defineEmits(['close']);
const tripsStore = useTripsStore();
onMounted(() => tripsStore.fetch());
</script>

<template>
  <div class="scrim" @click="emit('close')" />
  <aside class="drawer" aria-label="Your satchel" @keydown.esc="emit('close')">
    <div class="row">
      <div>
        <h2 class="display display-md">Your satchel</h2>
        <p class="hand muted" style="margin: 0">{{ tripsStore.trips.length }} trips packed</p>
      </div>
      <span class="spacer" />
      <button type="button" class="btn btn-icon" aria-label="Close satchel" @click="emit('close')">✕</button>
    </div>

    <p v-if="tripsStore.loading" class="muted">Rummaging through the satchel…</p>
    <div class="list">
      <RouterLink v-for="t in tripsStore.trips" :key="t.id" :to="`/planner/${t.id}`" class="cover-link" @click="emit('close')">
        <TripCover :trip="t" />
      </RouterLink>
      <RouterLink to="/planner?new=1" class="btn btn-ghost" @click="emit('close')">+ Pack a new trip</RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.drawer { position: fixed; z-index: 51; top: 0; right: 0; bottom: 0; width: min(420px, 100%); overflow: auto; padding: 24px; background: var(--paper-deep); border-left: 2px solid var(--ink); box-shadow: -8px 0 0 var(--ink); }
.list { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
.cover-link { text-decoration: none; }
</style>
