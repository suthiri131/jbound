<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { loadGoogleMaps3D, hasGoogleMaps, MAP_ID } from '@/lib/googleMaps';

const props = defineProps({
  stops: { type: Array, default: () => [] },  // [{ id, lat, lng, title }]
  path: { type: Array, default: () => [] },   // [{ lat, lng }]
  legs: { type: Array, default: () => [] },    // [{ durationMin, distanceKm }], indexed like 2D: legs[i - 1] for stops[i]
});
const emit = defineEmits(['select-stop']);

const el = ref(null);
const mapError = ref(hasGoogleMaps ? '' : 'Add VITE_GOOGLE_MAPS_API_KEY to client/.env.local to show the map.');
const selected = ref(null); // { title, leg } | null

let gm3d = null;
let map3d = null;
let markers = [];
let line = null;
let hasFlown = false;

function clear() {
  markers.forEach((m) => m.remove());
  markers = [];
  line?.remove();
  line = null;
}

function draw() {
  if (!map3d || !gm3d) return;
  clear();
  selected.value = null;

  props.stops.forEach((s, i) => {
    const isCp = String(s.id).startsWith('checkpoint-');
    const marker = new gm3d.Marker3DInteractiveElement({
      position: { lat: s.lat, lng: s.lng, altitude: 40 },
      altitudeMode: gm3d.AltitudeMode.RELATIVE_TO_GROUND,
      title: s.title,
    });
    const pin = new gm3d.PinElement({
      background: isCp ? '#1F4E5A' : '#E0A43B',
      borderColor: '#3C2A21',
      glyphColor: '#3C2A21',
      glyph: isCp ? '◆' : String(i + 1),
    });
    marker.append(pin);
    marker.addEventListener('gmp-click', () => {
      selected.value = { title: s.title, leg: props.legs[i - 1] || null };
      emit('select-stop', isCp ? null : s.id);
    });
    map3d.append(marker);
    markers.push(marker);
  });

  if (props.path.length) {
    line = new gm3d.Polyline3DElement({
      coordinates: props.path.map((p) => ({ ...p, altitude: 10 })),
      altitudeMode: gm3d.AltitudeMode.RELATIVE_TO_GROUND,
      strokeColor: '#9E3B1B',
      strokeWidth: 6,
    });
    map3d.append(line);
  }

  const center = props.stops[0] || props.path[0] || { lat: 1.4655, lng: 103.7578 };
  const endCamera = { center: { lat: center.lat, lng: center.lng, altitude: 300 }, tilt: 65, range: 1500, heading: 0 };

  if (!hasFlown) {
    hasFlown = true;
    map3d.center = { ...endCamera.center, altitude: 3000 };
    map3d.tilt = 0;
    map3d.range = 6000;
    map3d.heading = 0;
    map3d.flyCameraTo({ endCamera, durationMillis: 2500 });
  } else {
    map3d.center = endCamera.center;
    map3d.tilt = endCamera.tilt;
    map3d.range = endCamera.range;
    map3d.heading = endCamera.heading;
  }
}

onMounted(async () => {
  if (!hasGoogleMaps) return;
  try {
    gm3d = await loadGoogleMaps3D();
    if (!el.value) return;
    map3d = new gm3d.Map3DElement({ mapId: MAP_ID, mode: 'HYBRID' });
    el.value.appendChild(map3d);
    draw();
  } catch (err) {
    mapError.value = `3D view failed to load: ${err.message}`;
  }
});
onBeforeUnmount(() => {
  clear();
  map3d = null;
  hasFlown = false;
});

watch(() => [props.stops, props.path], draw, { deep: true });
</script>
<template>
  <div class="map3d-wrap">
    <div ref="el" class="map3d" role="region" aria-label="3D view of the route" />
    <div v-if="selected" class="route-info-3d">
      <strong>{{ selected.title }}</strong>
      <p v-if="selected.leg">{{ selected.leg.durationMin }} min driving ({{ selected.leg.distanceKm }} km)</p>
    </div>
    <p v-if="mapError" class="map-msg">{{ mapError }}</p>
  </div>
</template>
<style scoped>
.map3d-wrap { position: relative; flex: 1; min-height: 440px; display: flex; }
.map3d { flex: 1; min-height: 440px; }
.map3d :deep(gmp-map-3d) { width: 100%; height: 100%; display: block; }
.map-msg { position: absolute; inset: 0; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; font-weight: 700; color: var(--ink-soft); background: var(--map); }
.route-info-3d { position: absolute; top: 12px; left: 12px; max-width: 220px; padding: 8px 12px; background: var(--card); border: 2px solid var(--ink); border-radius: 10px; font-size: 13px; }
.route-info-3d p { margin: 4px 0 0; }
</style>