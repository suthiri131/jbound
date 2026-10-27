import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import http from 'node:http';
import { app } from '../app.js';
import { config } from '../config.js';
import { clearCache } from '../utils/cache.js';

const originalFetch = globalThis.fetch;
const originalBaseUrl = config.frankfurterBaseUrl;
const server = app.listen(0, '127.0.0.1');

before(async () => {
  await once(server, 'listening');
});

after(async () => {
  globalThis.fetch = originalFetch;
  config.frankfurterBaseUrl = originalBaseUrl;
  clearCache();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function request(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

test('currency rate and convert API routes use the shared exchange-rate service', async () => {
  config.frankfurterBaseUrl = 'https://rates.example';
  let upstreamRequests = 0;
  globalThis.fetch = async () => {
    upstreamRequests += 1;
    return new Response(JSON.stringify({
      date: '2026-10-16',
      rates: { MYR: 3.4 },
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  const rate = await request('/api/currency/rate?from=SGD&to=MYR');
  assert.equal(rate.status, 200);
  assert.equal(rate.body.rate, 3.4);

  const conversion = await request('/api/currency/convert?amount=50&from=SGD&to=MYR');
  assert.equal(conversion.status, 200);
  assert.equal(conversion.body.convertedAmount, 170);
  assert.equal(upstreamRequests, 1);

  const invalid = await request('/api/currency/rate?from=USD&to=MYR');
  assert.equal(invalid.status, 400);
});
