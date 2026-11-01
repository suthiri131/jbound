/**
 * What the sky over the basecamp should look like: Singapore's clock (not the visitor's) plus NEA's forecast.
 * Pure functions, so they are easy to test and the scene just reads the result.
 */
import * as THREE from 'three';

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

/** Sun direction for the given hour: rises in the east (+x), sets in the west (-x). */
export function sunDirection(hours, target = new THREE.Vector3()) {
  const a = ((hours - 7) / 12) * Math.PI; // 0 at sunrise, PI at sunset
  return target.set(Math.cos(a) * 1, Math.max(0.15, Math.sin(a)) * 1.3, -0.6).normalize();
}

// Palettes the scene blends between. Night first, day second; dawn/dusk add a warm tint on top.
const NIGHT = {
  skyTop: '#0e1733', skyBottom: '#2a3a63', fog: '#22304f', ground: '#2f4a3a', hills: '#2f3d58',
  hemiSky: '#5868a8', hemiGround: '#1d2a22', sun: '#9fb4ff', sunI: 0.35, hemiI: 0.55,
};
const DAY = {
  skyTop: '#6ec3ea', skyBottom: '#d6eff2', fog: '#d2ebe0', ground: '#8cc461', hills: '#bcd69a',
  hemiSky: '#eef8ff', hemiGround: '#7a9a50', sun: '#fff1d6', sunI: 2.0, hemiI: 1.35,
};
const GOLDEN = { skyTop: '#f2a65a', skyBottom: '#ffd9a0', fog: '#f0c79a', sun: '#ffb070' };

// How each condition dulls the day palette (0 = untouched).
const OVERCAST = { clear: 0, partly: 0.15, cloudy: 0.4, haze: 0.45, rain: 0.55, storm: 0.75 };
const GREY = new THREE.Color('#9aa6ad');

const c = (hex) => new THREE.Color(hex);

/**
 * Everything the scene needs for one moment: colours, light strengths, and which effects to run.
 * `mode` is the visitor's override: 'auto' follows Singapore time, 'day'/'night' pin it.
 */
export function environmentFor({ hours = sgHours(), condition = 'clear', mode = 'auto' } = {}) {
  const h = mode === 'day' ? 13 : mode === 'night' ? 22 : hours;
  const daylight = daylightAt(h);
  const golden = Math.max(0, 1 - Math.abs(daylight - 0.5) * 2) * (mode === 'auto' ? 1 : 0); // peaks mid-sunrise/sunset
  const overcast = OVERCAST[condition] ?? 0;

  const mix = (key) => {
    const col = c(NIGHT[key]).lerp(c(DAY[key]), daylight);
    if (GOLDEN[key]) col.lerp(c(GOLDEN[key]), golden * 0.6);
    if (['skyTop', 'skyBottom', 'fog'].includes(key)) col.lerp(GREY.clone().multiplyScalar(0.4 + daylight * 0.6), overcast);
    return col;
  };

  return {
    hours: h,
    daylight,
    phase: phaseAt(h),
    condition,
    skyTop: mix('skyTop'),
    skyBottom: mix('skyBottom'),
    fog: mix('fog'),
    ground: mix('ground'),
    hills: mix('hills'),
    hemiSky: mix('hemiSky'),
    hemiGround: mix('hemiGround'),
    sunColor: mix('sun'),
    sunIntensity: (NIGHT.sunI + (DAY.sunI - NIGHT.sunI) * daylight) * (1 - overcast * 0.6),
    hemiIntensity: NIGHT.hemiI + (DAY.hemiI - NIGHT.hemiI) * daylight,
    fogDensity: 0.006 + overcast * 0.012 + (condition === 'haze' ? 0.02 : 0),
    sunDir: sunDirection(daylight > 0.02 ? h : 1),
    night: daylight < 0.35,
    rain: condition === 'rain' || condition === 'storm',
    storm: condition === 'storm',
    clouds: { clear: 2, partly: 5, cloudy: 9, haze: 4, rain: 10, storm: 12 }[condition] ?? 3,
  };
}

/** Friendly words for the HUD chip. */
export const CONDITION_LABEL = {
  clear: 'Fair', partly: 'Partly cloudy', cloudy: 'Cloudy', haze: 'Hazy', rain: 'Showers', storm: 'Thundery showers',
};
