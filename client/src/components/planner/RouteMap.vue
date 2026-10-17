<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadGoogleMaps } from '@/lib/googleMaps';

const props = defineProps({
  stops: { type: Array, default: () => [] },
  version: { type: Number, default: 0 },
});

const mapElement = ref(null);
const mapReady = ref(false);
const mapError = ref('');
const routeError = ref('');
const routeRendered = ref(false);
const legLabelCount = ref(0);
let maps;
let map;
let markers = [];
let polylines = [];
let legLabels = [];
let requestVersion = 0;
let resizeObserver;

function coordinates(stop) {
  const lat = Number(stop.lat ?? stop.latitude);
  const lng = Number(stop.lng ?? stop.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function fitBounds(points) {
  if (!map || !maps || !points.length) return;
  const bounds = new maps.LatLngBounds();
  points.forEach((point) => bounds.extend(point));
  if (points.length === 1) {
    map.setCenter(points[0]);
    map.setZoom(14);
  } else {
    map.fitBounds(bounds, 48);
  }
}

function clearOverlays() {
  markers.forEach((marker) => marker.setMap(null));
  polylines.forEach((polyline) => polyline.setMap(null));
  legLabels.forEach((marker) => marker.setMap(null));
  markers = [];
  polylines = [];
  legLabels = [];
}

function labelForLeg(segment) {
  if (!Number.isFinite(segment.distance) || segment.distance < 0
    || !Number.isFinite(segment.duration) || segment.duration < 0) {
    throw new Error('Route service returned incomplete distance or duration for a leg');
  }
  const km = (segment.distance / 1000).toFixed(segment.distance < 10000 ? 1 : 0);
  const minutes = Math.max(1, Math.round(segment.duration / 60));
  return `${km} km · ${minutes} min`;
}

async function updateMap() {
  if (!map || !maps) return;
  const updateId = ++requestVersion;
  const validStops = props.stops.map((stop) => ({ stop, point: coordinates(stop) }))
    .filter(({ point }) => point);
  const points = validStops.map(({ point }) => point);

  clearOverlays();
  routeError.value = '';
  routeRendered.value = false;
  legLabelCount.value = 0;
  markers = validStops.map(({ stop, point }, index) => new maps.Marker({
    map,
    position: point,
    label: { text: String(index + 1), color: '#fff', fontWeight: '700' },
    title: stop.name ?? stop.title ?? `Stop ${index + 1}`,
    zIndex: 10 + index,
  }));
  fitBounds(points);

  if (points.length < 2) return;
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: points.map(({ lat, lng }) => [lng, lat]) }),
    });
    if (!response.ok) throw new Error(`Route service returned ${response.status}`);
    const route = await response.json();
    if (updateId !== requestVersion) return;
    const feature = route.features?.[0];
    const routeCoordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
      throw new Error('Route service returned no route geometry');
    }
    const segments = feature.properties?.segments;
    if (!Array.isArray(segments) || segments.length !== points.length - 1) {
      throw new Error('Route service returned incomplete per-leg details');
    }
    segments.forEach(labelForLeg);

    polylines = [new maps.Polyline({
      map,
      path: routeCoordinates.map(([lng, lat]) => ({ lat, lng })),
      strokeOpacity: 0,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeColor: '#b4471f', strokeOpacity: 1, scale: 3 },
        offset: '0',
        repeat: '14px',
      }],
      geodesic: true,
    })];

    legLabels = segments.map((segment, index) => {
      const midpoint = {
        lat: (points[index].lat + points[index + 1].lat) / 2,
        lng: (points[index].lng + points[index + 1].lng) / 2,
      };
      return new maps.Marker({
        map,
        position: midpoint,
        title: `Leg ${index + 1}: ${labelForLeg(segment)}`,
        label: { text: labelForLeg(segment), color: '#2a2117', fontSize: '12px', fontWeight: '700' },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 1,
          fillColor: '#fbf6e9',
          fillOpacity: 0.9,
          strokeColor: '#2a2117',
          strokeOpacity: 1,
        },
        zIndex: 20 + index,
      });
    });
    routeRendered.value = true;
    legLabelCount.value = legLabels.length;
    fitBounds(points);
  } catch (error) {
    if (updateId === requestVersion) routeError.value = error.message;
  }
}

watch([() => props.version, () => props.stops], updateMap, { deep: true });

onMounted(async () => {
  try {
    const google = await loadGoogleMaps();
    maps = google.maps;
    map = new maps.Map(mapElement.value, {
      center: { lat: 1.462, lng: 103.764 },
      zoom: 12,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID || undefined,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    mapReady.value = true;
    resizeObserver = new ResizeObserver(() => {
      if (props.stops.length) fitBounds(props.stops.map(coordinates).filter(Boolean));
    });
    resizeObserver.observe(mapElement.value);
    await updateMap();
  } catch (error) {
    mapError.value = error.message;
  }
});

onBeforeUnmount(() => {
  requestVersion += 1;
  resizeObserver?.disconnect();
  clearOverlays();
});
</script>

<template>
  <section class="route-map" aria-label="Trip route map">
    <div
      ref="mapElement"
      class="map-canvas"
      role="region"
      aria-label="Google Map"
      :data-map-ready="mapReady"
      :data-stop-count="stops.length"
      :data-route-rendered="routeRendered"
      :data-leg-label-count="legLabelCount"
      :data-route-style="routeRendered ? 'dashed' : 'none'"
    ></div>
    <p v-if="mapError" class="map-message" role="alert">{{ mapError }}</p>
    <p v-else-if="routeError" class="map-message" role="status">Route unavailable: {{ routeError }}</p>
  </section>
</template>

<style scoped>
.route-map { width: 100%; min-width: 0; }
.map-canvas {
  width: 100%;
  min-width: 0;
  height: clamp(320px, 52vw, 520px);
  overflow: hidden;
  border: 2px solid var(--ink);
  border-radius: 12px;
  background: var(--map);
}
.map-message {
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--ink-soft);
  background: var(--card);
  overflow-wrap: anywhere;
}
</style>
