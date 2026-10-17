import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { fetchJson } from '../utils/fetchJson.js';

const SUPPORTED_CURRENCIES = new Set(['SGD', 'MYR']);
const LATEST_TTL_MS = 60 * 60 * 1000;
const HISTORICAL_TTL_MS = 24 * 60 * 60 * 1000;
const FALLBACK_SGD_TO_MYR = 3.5;

function normalizeDate(date) {
  const value = date || 'latest';
  if (value === 'latest') return value;
  const parsedDate = typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : null;
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(parsedDate?.getTime())
    || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new TypeError('Exchange-rate date must be "latest" or a valid YYYY-MM-DD date');
  }
  return value;
}

function validateCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    throw new TypeError(`Unsupported currency: ${currency}`);
  }
}

function fallbackRate(from, to) {
  return from === 'SGD' && to === 'MYR'
    ? FALLBACK_SGD_TO_MYR
    : 1 / FALLBACK_SGD_TO_MYR;
}

export function convertAmountToCents(amountCents, rate) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0
    || !Number.isFinite(rate) || rate <= 0) {
    throw new TypeError('A non-negative amount in cents and a positive conversion rate are required');
  }
  const convertedCents = Math.round(amountCents * rate);
  if (!Number.isSafeInteger(convertedCents)) {
    throw new RangeError('Converted amount exceeds the safe integer range');
  }
  return convertedCents;
}

export async function getExchangeRate(date, from, to) {
  const requestedDate = normalizeDate(date);
  validateCurrency(from);
  validateCurrency(to);
  if (from === to) {
    return {
      rate: 1,
      date: requestedDate === 'latest' ? new Date().toISOString().slice(0, 10) : requestedDate,
      from,
      to,
      fallback: false,
    };
  }

  const cacheKey = `currency-rate:${requestedDate}:${from}:${to}`;
  const ttl = requestedDate === 'latest' ? LATEST_TTL_MS : HISTORICAL_TTL_MS;
  return cached(cacheKey, ttl, async () => {
    const endpoint = requestedDate === 'latest'
      ? 'latest'
      : requestedDate;
    const url = new URL(
      `${config.frankfurterBaseUrl.replace(/\/$/, '')}/v1/${endpoint}`,
    );
    url.searchParams.set('base', from);
    url.searchParams.set('symbols', to);

    try {
      const result = await fetchJson(url.toString());
      const rate = result.rates?.[to];
      if (!Number.isFinite(rate) || rate <= 0 || typeof result.date !== 'string') {
        throw new Error(`Exchange-rate service returned incomplete ${from}-to-${to} metadata`);
      }
      return { rate, date: result.date, from, to, fallback: false };
    } catch (error) {
      console.warn(`[currency] Using fallback ${from}/${to} rate: ${error.message}`);
      return {
        rate: fallbackRate(from, to),
        date: requestedDate === 'latest' ? new Date().toISOString().slice(0, 10) : requestedDate,
        from,
        to,
        fallback: true,
      };
    }
  });
}

export async function convertCurrency(amount, from, to, date = 'latest') {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new TypeError('Amount must be a non-negative finite number');
  }
  const exchange = await getExchangeRate(date, from, to);
  const amountCents = Math.round((numericAmount + Number.EPSILON) * 100);
  const convertedAmount = convertAmountToCents(amountCents, exchange.rate) / 100;
  return { amount: numericAmount, convertedAmount, ...exchange };
}

export async function getSgdRate(currency) {
  const { rate, date } = await getExchangeRate('latest', currency, 'SGD');
  return { rate, date };
}
