/**
 * OSRM driving-route wrapper (public demo server — rate-limited, fine for a class demo).
 * Returns the route geometry as [lat, lng] pairs (the client turns them into a Google Maps polyline).
 */
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { fetchJson } from '../utils/fetchJson.js';
import { badRequest, HttpError } from '../utils/httpError.js';

const CACHE_MS = 10 * 60 * 1000;

/** @param {Array<{lat:number,lng:number}>} points 2–25 stops in order */
export async function getDrivingRoute(points) {
  if (!Array.isArray(points) || points.length < 2) throw badRequest('Need at least 2 points for a route');
  if (points.length > 25) throw badRequest('Max 25 points per route');

  // OSRM expects lng,lat order
  const coords = points.map((p) => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');

  return cached(`osrm:${coords}`, CACHE_MS, async () => {
    const url = `${config.osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    const data = await fetchJson(url, { timeoutMs: 10_000 });
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new HttpError(502, `Routing failed: ${data.code || 'no route'}`);
    }
    const route = data.routes[0];
    return {
      distanceKm: Math.round(route.distance / 100) / 10,
      durationMin: Math.round(route.duration / 60),
      latlngs: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: route.legs.map((l) => ({
        distanceKm: Math.round(l.distance / 100) / 10,
        durationMin: Math.round(l.duration / 60),
      })),
      note: 'Free-flow driving estimate; excludes checkpoint queue time.',
    };
  });
}
