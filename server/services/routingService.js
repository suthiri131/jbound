/**
 * OpenRouteService driving-route wrapper.
 * Returns the route geometry as [lat, lng] pairs for the planner's Google Maps polyline.
 */
import { cached } from '../utils/cache.js';
import { getDrivingRoute as getOrsRoute } from './ors.js';
import { badRequest, HttpError } from '../utils/httpError.js';

const CACHE_MS = 10 * 60 * 1000;
const WOODLANDS_SG_APPROACH = [103.769, 1.447];
const WOODLANDS_JB_APPROACH = [103.764, 1.462];
const WOODLANDS_CROSSING = [
  WOODLANDS_SG_APPROACH,
  [103.768, 1.455],
  WOODLANDS_JB_APPROACH,
];
const WOODLANDS_CROSSING_DISTANCE_KM = 2.5;
const WOODLANDS_CROSSING_DURATION_MIN = 3;

function toCoordinates(points) {
  return points.map((point) => [Number(point.lng), Number(point.lat)]);
}

function nearCoordinate([lng, lat], [targetLng, targetLat], tolerance = 0.0005) {
  return Math.abs(lng - targetLng) <= tolerance && Math.abs(lat - targetLat) <= tolerance;
}

function routeGeometry(route) {
  const feature = route?.features?.[0];
  if (
    !feature?.properties?.summary ||
    !Array.isArray(feature.geometry?.coordinates)
  ) {
    throw new HttpError(502, 'Routing failed: ORS returned no route');
  }
  return feature;
}

function combineRoutes(prefixRoute, suffixRoute) {
  const prefix = prefixRoute ? routeGeometry(prefixRoute) : null;
  const suffix = routeGeometry(suffixRoute);
  const prefixCoordinates = prefix?.geometry.coordinates.length
    ? prefix.geometry.coordinates
    : [WOODLANDS_SG_APPROACH];
  const suffixCoordinates = suffix.geometry.coordinates;
  const coordinates = [
    ...prefixCoordinates,
    ...WOODLANDS_CROSSING.slice(1),
    ...suffixCoordinates.slice(1),
  ];
  const segments = [
    ...(prefix?.properties.segments || []),
    {
      distance: WOODLANDS_CROSSING_DISTANCE_KM * 1000,
      duration: WOODLANDS_CROSSING_DURATION_MIN * 60,
    },
    ...(suffix.properties.segments || []),
  ];
  const distance = (prefix?.properties.summary.distance || 0) +
    WOODLANDS_CROSSING_DISTANCE_KM * 1000 +
    suffix.properties.summary.distance;
  const duration = (prefix?.properties.summary.duration || 0) +
    WOODLANDS_CROSSING_DURATION_MIN * 60 +
    suffix.properties.summary.duration;

  return {
    features: [{
      properties: { summary: { distance, duration }, segments },
      geometry: { coordinates },
    }],
  };
}

async function requestOrsRoute(points) {
  if (points.length < 2) return null;
  return getOrsRoute(toCoordinates(points));
}

async function getWoodlandsCrossingRoute(points) {
  const coordinates = toCoordinates(points);
  const crossingIndex = coordinates.findIndex(
    ([lng, lat], index) =>
      index > 0 &&
      lng > 103.7 &&
      lng < 103.9 &&
      lat >= 1.455,
  );
  if (crossingIndex < 1 || !nearCoordinate(coordinates[0], WOODLANDS_SG_APPROACH, 0.005)) {
    return null;
  }

  const singaporeStops = points.slice(0, crossingIndex);
  const jbStops = points.slice(crossingIndex);
  const singaporeApproach = {
    lat: WOODLANDS_SG_APPROACH[1],
    lng: WOODLANDS_SG_APPROACH[0],
  };
  const jbApproach = {
    lat: WOODLANDS_JB_APPROACH[1],
    lng: WOODLANDS_JB_APPROACH[0],
  };
  const singaporeRoutePoints = singaporeStops.slice();
  const lastSingaporePoint = singaporeRoutePoints[singaporeRoutePoints.length - 1];
  if (
    !lastSingaporePoint ||
    !nearCoordinate([Number(lastSingaporePoint.lng), Number(lastSingaporePoint.lat)], WOODLANDS_SG_APPROACH)
  ) {
    singaporeRoutePoints.push(singaporeApproach);
  }

  const jbRoutePoints = [
    jbApproach,
    ...jbStops.filter(
      (point) =>
        !nearCoordinate([Number(point.lng), Number(point.lat)], WOODLANDS_JB_APPROACH),
    ),
  ];
  const [prefixRoute, suffixRoute] = await Promise.all([
    requestOrsRoute(singaporeRoutePoints),
    requestOrsRoute(jbRoutePoints),
  ]);
  if (!suffixRoute) {
    throw new HttpError(502, 'Routing failed: ORS returned no route for the Malaysia-side stops');
  }

  return combineRoutes(prefixRoute, suffixRoute);
}

/** @param {Array<{lat:number,lng:number}>} points 2–25 stops in order */
export async function getDrivingRoute(points, { checkpointId } = {}) {
  if (!Array.isArray(points) || points.length < 2) throw badRequest('Need at least 2 points for a route');
  if (points.length > 25) throw badRequest('Max 25 points per route');

  // ORS expects coordinates as [longitude, latitude] pairs.
  const coordinates = toCoordinates(points);
  const key = `${checkpointId || 'normal'}:${coordinates.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';')}`;

  return cached(`ors:${key}`, CACHE_MS, async () => {
    const crossingRoute = checkpointId === 'woodlands'
      ? await getWoodlandsCrossingRoute(points)
      : null;
    const data = crossingRoute || await getOrsRoute(coordinates);
    const route = data.features?.[0];
    const summary = route?.properties?.summary;
    if (!route || !summary || !Array.isArray(route.geometry?.coordinates)) {
      throw new HttpError(502, 'Routing failed: ORS returned no route');
    }

    return {
      distanceKm: Math.round(summary.distance / 100) / 10,
      durationMin: Math.round(summary.duration / 60),
      latlngs: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: (route.properties.segments || []).map((segment) => ({
        distanceKm: Math.round(segment.distance / 100) / 10,
        durationMin: Math.round(segment.duration / 60),
      })),
      note: 'Driving estimate; excludes checkpoint queue time.',
    };
  });
}
