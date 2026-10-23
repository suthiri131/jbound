import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { config } from '../config.js';
import { getDrivingRoute } from '../services/routingService.js';
import { clearCache } from '../utils/cache.js';

const originalFetch = globalThis.fetch;
const originalApiKey = config.ors.apiKey;
const originalBaseUrl = config.ors.baseUrl;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.ors.apiKey = originalApiKey;
  config.ors.baseUrl = originalBaseUrl;
  clearCache();
});

test('Woodlands-to-JB route bypasses ORS for the Causeway leg', async () => {
  config.ors.apiKey = 'test-ors-key';
  config.ors.baseUrl = 'https://ors.example';
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    const coordinates = body.coordinates;
    const geojson = {
      features: [{
        properties: {
          summary: { distance: 2000, duration: 120 },
          segments: [{ distance: 2000, duration: 120 }],
        },
        geometry: { coordinates },
      }],
    };
    return new Response(JSON.stringify(geojson), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await getDrivingRoute([
    {
      id: 'checkpoint-woodlands',
      title: 'Woodlands Checkpoint (Causeway) approach',
      lat: 1.4469,
      lng: 103.769,
    },
    { id: 'stop-1', title: 'JB Stop 1', lat: 1.5, lng: 103.8 },
  ], { checkpointId: 'woodlands' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://ors.example/v2/directions/driving-car/geojson');
  assert.deepEqual(requests[0].body, {
    coordinates: [[103.764, 1.462], [103.8, 1.5]],
    radiuses: [1000, 1000],
  });
  assert.deepEqual(result, {
    distanceKm: 4.5,
    durationMin: 5,
    latlngs: [
      [1.447, 103.769],
      [1.455, 103.768],
      [1.462, 103.764],
      [1.5, 103.8],
    ],
    legs: [
      { distanceKm: 2.5, durationMin: 3 },
      { distanceKm: 2, durationMin: 2 },
    ],
    note: 'Driving estimate; excludes checkpoint queue time.',
  });
});

test('Woodlands routes ORS-route Singapore stops only up to the Causeway approach', async () => {
  config.ors.apiKey = 'test-ors-key';
  config.ors.baseUrl = 'https://ors.example';
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const coordinates = JSON.parse(options.body).coordinates;
    requests.push(coordinates);
    const geojson = {
      features: [{
        properties: {
          summary: { distance: 1000, duration: 60 },
          segments: [{ distance: 1000, duration: 60 }],
        },
        geometry: { coordinates },
      }],
    };
    return new Response(JSON.stringify(geojson), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await getDrivingRoute([
    { title: 'Woodlands Checkpoint', lat: 1.4469, lng: 103.769 },
    { title: 'Singapore stop', lat: 1.43, lng: 103.78 },
    { title: 'JB Stop 1', lat: 1.5, lng: 103.8 },
  ], { checkpointId: 'woodlands' });

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], [
    [103.769, 1.4469],
    [103.78, 1.43],
    [103.769, 1.447],
  ]);
  assert.deepEqual(requests[1], [
    [103.764, 1.462],
    [103.8, 1.5],
  ]);
});
