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
  activeStopId: { type: [String, Number], default: null },
});
const emit = defineEmits(['select-stop']);

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
let markerElements = [];
let lines = [];
let infoWindow = null;
let pinnedInfoWindow = false;

const JB_CENTER = { lat: 1.4655, lng: 103.7578 };

function pinElement(label, color) {
  const pin = document.createElement('span');
  pin.className = 'map-pin';
  pin.style.background = color;
  pin.textContent = label;
  pin.setAttribute('role', 'button');
  pin.tabIndex = 0;
  return pin;
}

function clear() {
  markers.forEach((m) => (m.map = null)); // AdvancedMarkerElement is removed by clearing .map
  lines.forEach((l) => l.setMap(null));
  infoWindow?.close();
  pinnedInfoWindow = false;
  markers = [];
  markerElements = [];
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
    const element = marker.content;
    element.setAttribute('aria-label', `Show route details for ${s.title}`);
    element.classList.toggle('active', String(s.id) === String(props.activeStopId));
    markerElements.push(element);
    const leg = result.value?.route?.legs?.[i - 1];
    const showLeg = (pin = false) => {
      pinnedInfoWindow = pin;
      emit('select-stop', isCp ? null : s.id);
      const content = document.createElement('div');
      content.className = 'route-info';
      const heading = document.createElement('strong');
      heading.textContent = s.title;
      content.append(heading);
      if (leg) {
        const details = document.createElement('p');
        details.textContent = `Leg ${i}: ${leg.durationMin} min driving (${leg.distanceKm} km)`;
        content.append(details);
      }
      infoWindow.setContent(content);
      infoWindow.open({ map, anchor: marker });
    };
    element.addEventListener('mouseenter', () => showLeg());
    element.addEventListener('focus', () => showLeg());
    element.addEventListener('click', () => showLeg(true));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showLeg(true);
      }
    });
    element.addEventListener('mouseleave', () => {
      if (!pinnedInfoWindow) {
        infoWindow.close();
        emit('select-stop', null);
      }
    });
    bounds.extend({ lat: s.lat, lng: s.lng });
  });

  const path = (result.value?.route?.latlngs || []).map(([lat, lng]) => ({ lat, lng }));
  if (path.length) {
    // navigation-style route: a dark rust casing under a solid rust line, with white chevrons for direction
    lines.push(new gm.Polyline({ map, path, strokeColor: '#6B2611', strokeOpacity: 1, strokeWeight: 9, zIndex: 1, clickable: false }));
    lines.push(
      new gm.Polyline({
        map,
        path,
        strokeColor: '#9E3B1B',
        strokeOpacity: 1,
        strokeWeight: 6,
        zIndex: 2,
        clickable: false,
        icons: [
          {
            icon: {
              path: gm.SymbolPath.FORWARD_OPEN_ARROW,
              strokeColor: '#FFFFFF',
              strokeOpacity: 1,
              strokeWeight: 2,
              scale: 1.6,
            },
            offset: '40px',
            repeat: '90px',
          },
        ],
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
    infoWindow = new gm.InfoWindow();
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
watch(() => props.activeStopId, (id) => {
  markerElements.forEach((element, i) => {
    element.classList.toggle('active', String(result.value?.stops?.[i]?.id) === String(id));
  });
});

const caption = computed(() => {
  const r = result.value?.route;
  if (r) return `${r.distanceKm} km · about ${r.durationMin} min driving · ${r.note}`;
  return result.value?.message || 'Add a location to your stops to see them on the map.';
});
const stopBufferMinutes = computed(() => {
  const stopIds = new Set((result.value?.stops || [])
    .filter((stop) => !String(stop.id).startsWith('checkpoint-'))
    .map((stop) => String(stop.id)));
  return props.trip.itinerary
    .filter((item) => stopIds.has(String(item.id)))
    .reduce((total, item) => total + (Number(item.dwell_minutes) || 0), 0);
});
</script>

<template>
  <section class="map-card" aria-label="Route map">
    <div class="bar">
      <div>
        <h2 class="display display-sm">Route map</h2>
        <p class="muted cap">{{ loading ? 'Plotting the route…' : caption }}</p>
        <p v-if="result?.route" class="timing-badge">
          <span>Drive · {{ result.route.durationMin }} min</span>
          <span>Stop buffers · {{ stopBufferMinutes }} min</span>
        </p>
      </div>
      <div class="row" style="gap: 10px">
        <div v-if="days.length > 1" class="segmented" role="group" aria-label="Map day">
          <button v-for="d in days" :key="d" type="button" :aria-pressed="d === day" @click="day = d">{{ dayLabel(trip.start_date, d) }}</button>
        </div>
        <label class="field" style="flex-direction: row; align-items: center; gap: 6px">
          From
          <select v-model="fromCheckpoint" class="select" style="width: auto; min-height: 40px">
            <option value="">first stop</option>
            <option value="woodlands">Woodlands Causeway approach</option>
            <option value="tuas">Tuas Second Link approach</option>
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

    <div v-if="result?.stops?.length" class="legend" aria-label="Step-by-step itinerary">
      <template v-for="(s, i) in result.stops" :key="s.id">
        <div v-if="i > 0 && result.route?.legs?.[i - 1]" class="leg-row" aria-label="Driving leg">
          <span class="leg-arrow" aria-hidden="true">⬇ 🚗</span>
          <span class="leg-badge">{{ result.route.legs[i - 1].distanceKm }} km · {{ result.route.legs[i - 1].durationMin }} min driving</span>
        </div>
        <div class="itinerary-stop" :class="{ selected: String(activeStopId) === String(s.id) }">
          <span class="dot">{{ String(s.id).startsWith('checkpoint-') ? '◆' : i + (fromCheckpoint ? 0 : 1) }}</span>
          <span class="stop-copy">
            <span class="stop-order">{{ i === 0 ? 'Origin' : `Stop ${i}` }}</span>
            <span class="name">{{ s.title }}</span>
          </span>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.map-card { display: flex; flex-direction: column; height: 100%; border: 2px solid var(--ink); border-radius: 16px; background: var(--map); overflow: hidden; box-shadow: 8px 8px 0 var(--ink); }
.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; background: var(--card); border-bottom: 2px solid var(--ink); }
.cap { margin: 2px 0 0; font-size: 13px; }
.timing-badge { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }
.timing-badge span { padding: 3px 9px; border: 1.5px dashed #3C2A21; border-radius: 999px; background: #FDFBF7; font-size: 12px; font-weight: 800; }
.map-wrap { position: relative; flex: 1; min-height: 440px; display: flex; }
.map { flex: 1; min-height: 440px; }
.map-msg { position: absolute; inset: 0; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; font-weight: 700; color: var(--ink-soft); background: var(--map); }
.legend { margin: 0; padding: 16px 18px 20px; background: #FDFBF7; border-top: 2px solid #3C2A21; display: flex; flex-direction: column; gap: 0; }
.itinerary-stop { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 5px 8px; border: 1.5px dashed transparent; border-radius: 10px; }
.itinerary-stop.selected { border-color: #3C2A21; background: #F3EAD3; }
.dot { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--ink); background: var(--mustard); font-size: 12px; font-weight: 800; }
.stop-copy { min-width: 0; }
.stop-order { display: block; color: #5A4A36; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.name { display: block; overflow-wrap: anywhere; font-weight: 700; font-size: 14px; line-height: 1.25; }
.leg-row { display: flex; align-items: center; gap: 10px; min-height: 40px; padding-left: 14px; border-left: 2px dashed #3C2A21; margin-left: 20px; }
.leg-arrow { flex: none; font-size: 14px; }
.leg-badge { max-width: 100%; padding: 3px 9px; border: 1.5px dashed #3C2A21; border-radius: 8px; background: #FDFBF7; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
:global(.map-pin) { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 3px solid #3C2A21; border-radius: 50%; font: 800 14px Archivo, sans-serif; color: #3C2A21; cursor: pointer; }
:global(.map-pin.active) { outline: 4px solid #FDFBF7; box-shadow: 0 0 0 7px #3C2A21; transform: scale(1.1); }
:global(.route-info p) { margin: 5px 0 0; }
@media (max-width: 420px) {
  .bar { padding: 12px; }
  .bar > .row { flex-wrap: wrap; width: 100%; }
  .bar .field { max-width: 100%; flex-wrap: wrap; }
  .bar select { max-width: 100%; }
  .legend { padding: 12px; }
}
</style>
