/**
 * sg's clock and sky; 3D basecamp (environment.js) builds on it, so both always agree on what time of day it is.
 */

/** Hours since midnight in Singapore, e.g. 18.5 for 6:30pm. */
export function sgHours(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return get('hour') + get('minute') / 60;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 = full night, 1 = full day. SG sunrise is ~7:00 and sunset ~19:10 all year round. */
export function daylightAt(hours) {
  return smooth(6.4, 7.6, hours) * (1 - smooth(18.7, 19.8, hours));
}

/** 'dawn' | 'day' | 'dusk' | 'night' */
export function phaseAt(hours) {
  const d = daylightAt(hours);
  if (d <= 0.02) return 'night';
  if (d >= 0.98) return 'day';
  return hours < 12 ? 'dawn' : 'dusk';
}

/** The hour to draw: 'day' / 'night' pin it, 'auto' follows the clock. */
export const hoursForMode = (mode, hours = sgHours()) => (mode === 'day' ? 13 : mode === 'night' ? 22 : hours);
export const isNightAt = (hours) => daylightAt(hours) < 0.35;

/** Friendly words for the HUD chip. */
export const CONDITION_LABEL = {
  clear: 'Fair', partly: 'Partly cloudy', cloudy: 'Cloudy', haze: 'Hazy', rain: 'Showers', storm: 'Thundery showers',
};

// ---------- flat colours for the 2D scenes ----------

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, t) {
  const [x, y] = [hex(a), hex(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const OVERCAST = { clear: 0, partly: 0.12, cloudy: 0.4, haze: 0.45, rain: 0.55, storm: 0.75 };

/** Everything a flat illustrated sky needs for one moment. */
export function flatSky({ hours = sgHours(), condition = 'clear' } = {}) {
  const daylight = daylightAt(hours);
  const golden = Math.max(0, 1 - Math.abs(daylight - 0.5) * 2) * 0.7; // peaks mid-sunrise / sunset
  const overcast = OVERCAST[condition] ?? 0;
  const paint = (night, day, warm) => mix(mix(mix(night, day, daylight), warm, golden), mix('#3a4150', '#a4afb5', daylight), overcast);
  const rain = condition === 'rain' || condition === 'storm';
  // 0 at sunrise, 1 at sunset: the sun crosses the sky from left to right
  const arc = Math.min(1, Math.max(0, (hours - 7) / 12));
  return {
    daylight,
    night: isNightAt(hours),
    rain,
    storm: condition === 'storm',
    haze: condition === 'haze',
    top: paint('#101a3a', '#6ec3ea', '#f2a65a'),
    bottom: paint('#2e3f6e', '#d6eff2', '#ffd9a0'),
    // land is darkened as a whole at night, so every illustration only needs its daytime colours
    landFilter: `brightness(${(0.42 + daylight * 0.58 - overcast * 0.12).toFixed(2)}) saturate(${(0.75 + daylight * 0.25).toFixed(2)})`,
    sunX: 8 + arc * 84,
    sunY: 46 - Math.sin(arc * Math.PI) * 36,
    showSun: daylight > 0.05 && !rain && condition !== 'cloudy',
    showMoon: daylight < 0.35 && !rain,
    stars: Math.max(0, 1 - daylight * 2.5) * (rain ? 0.15 : 1),
    clouds: { clear: 2, partly: 3, cloudy: 5, haze: 3, rain: 6, storm: 6 }[condition] ?? 2,
    cloudTint: rain ? '#8f99a5' : daylight < 0.35 ? '#4a5578' : '#ffffff',
  };
}
