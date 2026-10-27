import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';
import { fetchJson } from '../utils/fetchJson.js';

export function getDrivingRoute(coordinates) {
  if (!config.ors.apiKey) {
    throw new HttpError(503, 'Routing service is not configured');
  }

  return fetchJson(`${config.ors.baseUrl}/v2/directions/driving-car/geojson`, {
    method: 'POST',
    headers: {
      Authorization: config.ors.apiKey,
      Accept: 'application/geo+json',
    },
    body: {
      coordinates,
      radiuses: coordinates.map(() => 1000),
    },
    timeoutMs: 15000,
  });
}
