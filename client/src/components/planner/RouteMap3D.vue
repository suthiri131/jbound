<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { loadGoogleMaps3D, hasGoogleMaps, MAP_ID } from '@/lib/googleMaps';

const props = defineProps({
  stops: { type: Array, default: () => [] }, // [{ id, lat, lng, title }]
  path: { type: Array, default: () => [] },  // [{ lat, lng }]
});

const el = ref(null);
const mapError = ref(hasGoogleMaps ? '' : 'Add VITE_GOOGLE_MAPS_API_KEY to client/.env.local to show the map.');

let gm3d = null;
let map3d = null;
let markers = [];
let line = null;

function clear() {
  markers.forEach((m) => m.remove());
  markers = [];
  line?.remove();
  line = null;
}

function draw() {
  if (!map3d || !gm3d) return;
  clear();

  props.stops.forEach((s) => {
    const marker = new gm3d.Marker3DElement({
      position: { lat: s.lat, lng: s.lng, altitude: 40 },
      altitudeMode: gm3d.AltitudeMode.RELATIVE_TO_GROUND,
      label: s.title,
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
  map3d.center = { lat: center.lat, lng: center.lng, altitude: 300 };
  map3d.tilt = 65;
  map3d.range = 1500;
  map3d.heading = 0;
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
});

watch(() => [props.stops, props.path], draw, { deep: true });
</script>

<template>
  <div class="map3d-wrap">
    <div ref="el" class="map3d" role="region" aria-label="3D view of the route" />
    <p v-if="mapError" class="map-msg">{{ mapError }}</p>
  </div>
</template>

<style scoped>
.map3d-wrap { position: relative; flex: 1; min-height: 440px; display: flex; }
.map3d { flex: 1; min-height: 440px; }
.map3d :deep(gmp-map-3d) { width: 100%; height: 100%; display: block; }
.map-msg { position: absolute; inset: 0; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; font-weight: 700; color: var(--ink-soft); background: var(--map); }
</style>