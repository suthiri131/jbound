import { config } from '../config.js';
import { fetchJson } from '../utils/fetchJson.js';

export async function getSgdRate(currency) {
  if (currency === 'SGD') {
    return { rate: 1, date: new Date().toISOString().slice(0, 10) };
  }
  if (currency !== 'MYR') {
    throw new TypeError(`Unsupported expense currency: ${currency}`);
  }

  const result = await fetchJson(
    `${config.frankfurterBaseUrl}/v1/latest?base=${currency}&symbols=SGD`,
  );
  const rate = result.rates?.SGD;
  if (!Number.isFinite(rate) || typeof result.date !== 'string') {
    throw new Error('Exchange-rate service returned incomplete MYR-to-SGD metadata');
  }
  return { rate, date: result.date };
}
