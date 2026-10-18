import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { config } from '../config.js';
import { clearCache } from '../utils/cache.js';
import { convertCurrency, getExchangeRate } from '../services/currencyService.js';

const originalFetch = globalThis.fetch;
const originalBaseUrl = config.frankfurterBaseUrl;
const originalWarn = console.warn;
const originalNow = Date.now;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.frankfurterBaseUrl = originalBaseUrl;
  console.warn = originalWarn;
  Date.now = originalNow;
  clearCache();
});

test('fetches and caches the latest Frankfurter exchange rate', async () => {
  config.frankfurterBaseUrl = 'https://rates.example';
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests += 1;
    assert.equal(url, 'https://rates.example/v1/latest?base=SGD&symbols=MYR');
    return new Response(JSON.stringify({
      date: '2026-10-16',
      rates: { MYR: 3.48 },
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  assert.deepEqual(await getExchangeRate('latest', 'SGD', 'MYR'), {
    rate: 3.48,
    date: '2026-10-16',
    from: 'SGD',
    to: 'MYR',
    fallback: false,
  });
  await getExchangeRate('latest', 'SGD', 'MYR');
  assert.equal(requests, 1);
});

test('expires latest and historical rates after their configured TTLs', async () => {
  let now = 1_800_000_000_000;
  Date.now = () => now;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({
      date: '2026-10-16',
      rates: { MYR: 3.48 },
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  await getExchangeRate('latest', 'SGD', 'MYR');
  now += 60 * 60 * 1000 - 1;
  await getExchangeRate('latest', 'SGD', 'MYR');
  assert.equal(requests, 1);
  now += 2;
  await getExchangeRate('latest', 'SGD', 'MYR');
  assert.equal(requests, 2);

  await getExchangeRate('2026-10-15', 'SGD', 'MYR');
  now += 24 * 60 * 60 * 1000 - 1;
  await getExchangeRate('2026-10-15', 'SGD', 'MYR');
  assert.equal(requests, 3);
  now += 2;
  await getExchangeRate('2026-10-15', 'SGD', 'MYR');
  assert.equal(requests, 4);
});

test('requests historical rates and converts using the selected date', async () => {
  config.frankfurterBaseUrl = 'https://rates.example/';
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({
      date: '2026-10-15',
      rates: { SGD: 0.29 },
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  const result = await convertCurrency(10, 'MYR', 'SGD', '2026-10-15');
  assert.equal(requestedUrl, 'https://rates.example/v1/2026-10-15?base=MYR&symbols=SGD');
  assert.deepEqual(result, {
    amount: 10,
    convertedAmount: 2.9,
    rate: 0.29,
    date: '2026-10-15',
    from: 'MYR',
    to: 'SGD',
    fallback: false,
  });
});

test('uses the documented fallback rate when Frankfurter is unavailable', async () => {
  globalThis.fetch = async () => {
    throw new Error('network unavailable');
  };
  console.warn = () => {};

  const result = await getExchangeRate('latest', 'SGD', 'MYR');
  assert.equal(result.rate, 3.5);
  assert.equal(result.fallback, true);
  const reverse = await getExchangeRate('latest', 'MYR', 'SGD');
  assert.equal(reverse.rate, 1 / 3.5);
  assert.equal(reverse.fallback, true);
});

test('returns a one-to-one rate without an upstream request', async () => {
  globalThis.fetch = async () => {
    throw new Error('same-currency conversion should not call the API');
  };
  const result = await getExchangeRate('2026-10-15', 'SGD', 'SGD');
  assert.equal(result.rate, 1);
  assert.equal(result.date, '2026-10-15');
});

test('rejects unsupported currencies, invalid dates, and invalid amounts', async () => {
  await assert.rejects(getExchangeRate('latest', 'USD', 'SGD'), /Unsupported currency/);
  await assert.rejects(getExchangeRate('2026-02-30', 'SGD', 'MYR'), /valid YYYY-MM-DD/);
  await assert.rejects(convertCurrency(-1, 'SGD', 'MYR'), /non-negative finite number/);
});
