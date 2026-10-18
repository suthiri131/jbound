<script setup>
/**
 * Google Map of one day's stops + the ORS driving route.
 * Data: GET /api/trips/:id/route?day=YYYY-MM-DD   (route geometry from ORS, drawn on Google Maps)
 * Map: Maps JavaScript API, loaded with VITE_GOOGLE_MAPS_API_KEY (see lib/googleMaps.js).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { loadGoogleMaps, hasGoogleMaps, MAP_ID } from '@/lib/googleMaps';
import { dayLabel } from '@/utils/format';

const props = defineProps({
  trip: { type: Object, required: true },
  version: { type: Number, default: 0 }, // bump to force a refetch after itinerary changes
});

const el = ref(null);
const days = computed(() => [...new Set(props.trip.itinerary.map((i) => i.day).filter(Boolean))].sort());
const day = ref(null);
const fromCheckpoint = ref('');
const result = ref(null);
const error = ref('');
const mapError = ref(hasGoogleMaps ? '' : 'Add VITE_GOOGLE_MAPS_API_KEY to client/.env.local to show the map.');
const loading = ref(false);

let gm = null; // loaded Google Maps libraries
let map = null;
let markers = [];
let lines = [];

const JB_CENTER = { lat: 1.4655, lng: 103.7578 };

function pinElement(label, color) {
  const pin = document.createElement('span');
  pin.className = 'map-pin';
  pin.style.background = color;
  pin.textContent = label;
  return pin;
}

function clear() {
  markers.forEach((m) => (m.map = null)); // AdvancedMarkerElement is removed by clearing .map
  lines.forEach((l) => l.setMap(null));
  markers = [];
  lines = [];
}

function draw() {
  if (!map || !gm) return;
  clear();
  const stops = result.value?.stops || [];
  const bounds = new gm.LatLngBounds();

  stops.forEach((s, i) => {
    const isCp = String(s.id).startsWith('checkpoint-');
    const label = isCp ? '◆' : String(i + (fromCheckpoint.value ? 0 : 1));
    const marker = new gm.AdvancedMarkerElement({
      map,
      position: { lat: s.lat, lng: s.lng },
      title: s.title,
      content: pinElement(label, isCp ? '#1F4E5A' : '#E0A43B'),
    });
    markers.push(marker);
    bounds.extend({ lat: s.lat, lng: s.lng });
  });

  const path = (result.value?.route?.latlngs || []).map(([lat, lng]) => ({ lat, lng }));
  if (path.length) {
    // soft shadow + dashed ember line (Google draws dashes with repeated line symbols)
    lines.push(new gm.Polyline({ map, path, strokeColor: '#2A2117', strokeOpacity: 0.15, strokeWeight: 8 }));
    lines.push(
      new gm.Polyline({
        map,
        path,
        strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#C2502A', scale: 3 }, offset: '0', repeat: '14px' }],
      }),
    );
    path.forEach((p) => bounds.extend(p));
  }

  if (stops.length + path.length > 1) map.fitBounds(bounds, 36);
  else if (stops.length === 1) { map.setCenter({ lat: stops[0].lat, lng: stops[0].lng }); map.setZoom(14); }
  else { map.setCenter(JB_CENTER); map.setZoom(12); }
}

async function load() {
  error.value = '';
  loading.value = true;
  try {
    const params = {};
    if (day.value) params.day = day.value;
    if (fromCheckpoint.value) params.fromCheckpoint = fromCheckpoint.value;
    const { data } = await api.get(`/trips/${props.trip.id}/route`, { params });
    result.value = data;
  } catch (err) {
    error.value = errorMessage(err, 'Could not draw the route');
    result.value = null;
  } finally {
    loading.value = false;
    await nextTick();
    draw();
  }
}

onMounted(async () => {
  if (!hasGoogleMaps) return;
  try {
    gm = await loadGoogleMaps();
    if (!el.value) return; // unmounted while loading
    map = new gm.Map(el.value, {
      center: JB_CENTER,
      zoom: 12,
      mapId: MAP_ID, // required for AdvancedMarkerElement; style it in Google Cloud → Map Management
      gestureHandling: 'cooperative', // page scroll isn't hijacked; ctrl/two-finger to zoom
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });
    draw();
  } catch (err) {
    mapError.value = `Google Maps failed to load: ${err.message}`;
  }
});
onBeforeUnmount(() => {
  clear();
  map = null; // late responses must not draw on a removed map
});

watch(
  () => [props.trip.id, days.value.join()],
  () => {
    if (!days.value.includes(day.value)) day.value = days.value[0] ?? null;
  },
  { immediate: true },
);
watch(() => [props.trip.id, day.value, fromCheckpoint.value, props.version], load, { immediate: true });

const caption = computed(() => {
  const r = result.value?.route;
  if (r) return `${r.distanceKm} km · about ${r.durationMin} min driving · ${r.note}`;
  return result.value?.message || 'Add a location to your stops to see them on the map.';
});
</script>

<template>
  <section class="map-card" aria-label="Route map">
    <div class="bar">
      <div>
        <h2 class="display display-sm">Route map</h2>
        <p class="muted cap">{{ loading ? 'Plotting the route…' : caption }}</p>
      </div>
      <div class="row" style="gap: 10px">
        <div v-if="days.length > 1" class="segmented" role="group" aria-label="Map day">
          <button v-for="d in days" :key="d" type="button" :aria-pressed="d === day" @click="day = d">{{ dayLabel(trip.start_date, d) }}</button>
        </div>
        <label class="field" style="flex-direction: row; align-items: center; gap: 6px">
          From
          <select v-model="fromCheckpoint" class="select" style="width: auto; min-height: 40px">
            <option value="">first stop</option>
            <option value="woodlands">Woodlands (SG)</option>
            <option value="tuas">Tuas (SG)</option>
          </select>
        </label>
        <slot name="actions" />
      </div>
    </div>

    <div class="map-wrap">
      <div ref="el" class="map" role="region" aria-label="Map of the day's stops" />
      <p v-if="mapError" class="map-msg">{{ mapError }}</p>
    </div>
    <p v-if="error" class="error-text" role="alert" style="margin: 0; padding: 8px 18px">{{ error }}</p>

    <ol v-if="result?.stops?.length" class="legend">
      <li v-for="(s, i) in result.stops" :key="s.id">
        <span class="dot">{{ String(s.id).startsWith('checkpoint-') ? '◆' : i + (fromCheckpoint ? 0 : 1) }}</span>
        <span>
          <span class="name">{{ s.title }}</span>
          <span v-if="i > 0 && result.route?.legs?.[i - 1]" class="leg">{{ result.route.legs[i - 1].distanceKm }} km · {{ result.route.legs[i - 1].durationMin }} min drive</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.map-card { display: flex; flex-direction: column; height: 100%; border: 2px solid var(--ink); border-radius: 16px; background: var(--map); overflow: hidden; box-shadow: 8px 8px 0 var(--ink); }
.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; background: var(--card); border-bottom: 2px solid var(--ink); }
.cap { margin: 2px 0 0; font-size: 13px; }
.map-wrap { position: relative; flex: 1; min-height: 440px; display: flex; }
.map { flex: 1; min-height: 440px; }
.map-msg { position: absolute; inset: 0; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; font-weight: 700; color: var(--ink-soft); background: var(--map); }
.legend { list-style: none; margin: 0; padding: 12px 18px 16px; background: var(--card); border-top: 2px solid var(--ink); display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px 18px; }
.legend li { display: flex; align-items: center; gap: 10px; min-height: 36px; }
.dot { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--ink); background: var(--mustard); font-size: 12px; font-weight: 800; }
.name { display: block; font-weight: 700; font-size: 14px; line-height: 1.25; }
.leg { display: block; font-size: 12px; color: var(--ink-mute); }
:global(.map-pin) { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 3px solid #2A2117; border-radius: 50%; font: 800 14px Archivo, sans-serif; color: #2A2117; }
</style>
