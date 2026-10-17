import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { config } from '../config.js';
import { getSgdRate } from '../services/exchangeRates.js';

const originalFetch = globalThis.fetch;
const originalBaseUrl = config.frankfurterBaseUrl;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.frankfurterBaseUrl = originalBaseUrl;
});

test('returns the SGD base rate and a date without an upstream request', async () => {
  globalThis.fetch = async () => {
    throw new Error('SGD should not need a network request');
  };
  const metadata = await getSgdRate('SGD');
  assert.equal(metadata.rate, 1);
  assert.match(metadata.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('fetches dated MYR-to-SGD conversion metadata', async () => {
  config.frankfurterBaseUrl = 'https://rates.example';
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({ base: 'MYR', date: '2026-10-11', rates: { SGD: 0.32 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  assert.deepEqual(await getSgdRate('MYR'), { rate: 0.32, date: '2026-10-11' });
  assert.equal(requestedUrl, 'https://rates.example/v1/latest?base=MYR&symbols=SGD');
});

test('reports missing conversion metadata as an error', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ base: 'MYR', date: '2026-10-11', rates: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(getSgdRate('MYR'), /incomplete MYR-to-SGD metadata/);
});
