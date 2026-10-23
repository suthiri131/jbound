import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { afterEach, test } from 'node:test';
import { app } from '../app.js';
import { config } from '../config.js';
import { routeRequestSchema } from '../routes/routes.js';
import { getDrivingRoute } from '../services/ors.js';

const originalFetch = globalThis.fetch;
const originalApiKey = config.ors.apiKey;
const originalBaseUrl = config.ors.baseUrl;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.ors.apiKey = originalApiKey;
  config.ors.baseUrl = originalBaseUrl;
});

async function postRoute(body) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    return await new Promise((resolve, reject) => {
      const request = httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/routes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString()),
        }));
      });
      request.on('error', reject);
      request.end(JSON.stringify(body));
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('route requests require two valid longitude/latitude pairs', () => {
  const valid = routeRequestSchema.safeParse({
    coordinates: [[103.8198, 1.3521], [103.7618, 1.4927]],
  });
  assert.equal(valid.success, true);

  assert.equal(routeRequestSchema.safeParse({ coordinates: [[103, 1]] }).success, false);
  assert.equal(routeRequestSchema.safeParse({ coordinates: [[181, 1], [103, 2]] }).success, false);
  assert.equal(routeRequestSchema.safeParse({ coordinates: [[103, -91], [103, 2]] }).success, false);
});

test('driving route requests call ORS with the server key and return GeoJSON', async () => {
  config.ors.apiKey = 'test-ors-key';
  config.ors.baseUrl = 'https://api.openrouteservice.org';
  const coordinates = [[103.8198, 1.3521], [103.7618, 1.4927]];
  const geojson = { type: 'FeatureCollection', features: [] };
  let request;

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify(geojson), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  assert.deepEqual(await getDrivingRoute(coordinates), geojson);
  assert.equal(request.url, 'https://api.openrouteservice.org/v2/directions/driving-car/geojson');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'test-ors-key');
  assert.equal(request.options.headers.Accept, 'application/geo+json');
  assert.deepEqual(JSON.parse(request.options.body), {
    coordinates,
    radiuses: [1000, 1000],
  });
});

test('POST /api/routes returns ORS GeoJSON and rejects invalid coordinates', async () => {
  config.ors.apiKey = 'test-ors-key';
  const geojson = { type: 'FeatureCollection', features: [] };
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify(geojson), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const success = await postRoute({ coordinates: [[103.8198, 1.3521], [103.7618, 1.4927]] });
  assert.equal(success.status, 200);
  assert.deepEqual(success.body, geojson);

  const invalid = await postRoute({ coordinates: [[181, 1], [103, 2]] });
  assert.equal(invalid.status, 400);
  assert.equal(upstreamCalls, 1);
});

test('driving route requests fail clearly when the ORS key is missing', () => {
  config.ors.apiKey = '';
  assert.throws(() => getDrivingRoute([[103, 1], [104, 2]]), {
    status: 503,
    message: 'Routing service is not configured',
  });
});
