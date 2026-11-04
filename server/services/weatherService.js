import { cached } from '../utils/cache.js';
import { fetchJson } from '../utils/fetchJson.js';

// NEA's 2-hour forecast via data.gov.sg (free, no key). Woodlands is the area the basecamp sits in.
const FORECAST_URL = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';
const TEN_MIN = 10 * 60 * 1000;

/** "Thundery Showers", "Partly Cloudy (Night)", "Hazy"... -> one of the conditions the basecamp can draw. */
export function conditionFor(text = '') {
  const t = text.toLowerCase();
  if (t.includes('thunder')) return 'storm';
  if (/rain|shower|drizzle/.test(t)) return 'rain';
  if (t.includes('haz') || t.includes('mist') || t.includes('fog')) return 'haze';
  if (t.includes('partly')) return 'partly';
  if (/cloudy|overcast/.test(t)) return 'cloudy';
  return 'clear'; // Fair, Fair & Warm, Sunny, Windy
}

export async function getWeather(area = 'Woodlands') {
  return cached(`weather:${area}`, TEN_MIN, async () => {
    const body = await fetchJson(FORECAST_URL);
    const item = (body.data || body).items?.[0];
    const forecasts = item?.forecasts || [];
    const match = forecasts.find((f) => f.area === area) || forecasts[0];
    // v2 sends { forecast: { text } }; older payloads send the text directly
    const text = typeof match?.forecast === 'string' ? match.forecast : match?.forecast?.text || '';
    return { area: match?.area || area, forecast: text, condition: conditionFor(text), updatedAt: item?.update_timestamp || null };
  });
}
