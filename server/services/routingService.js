/**
 * OpenRouteService driving-route wrapper.
 * Returns the route geometry as [lat, lng] pairs for the planner's Google Maps polyline.
 */
import { cached } from '../utils/cache.js';
import { getDrivingRoute as getOrsRoute } from './ors.js';
import { badRequest, HttpError } from '../utils/httpError.js';

const CACHE_MS = 10 * 60 * 1000;

/** @param {Array<{lat:number,lng:number}>} points 2–25 stops in order */
export async function getDrivingRoute(points) {
  if (!Array.isArray(points) || points.length < 2) throw badRequest('Need at least 2 points for a route');
  if (points.length > 25) throw badRequest('Max 25 points per route');

  // ORS expects coordinates as [longitude, latitude] pairs.
  const coordinates = points.map((p) => [Number(p.lng), Number(p.lat)]);
  const key = coordinates.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');

  return cached(`ors:${key}`, CACHE_MS, async () => {
    const data = await getOrsRoute(coordinates);
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
