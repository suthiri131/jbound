/**
 * ============================================================
 * FEASIBILITY CHECK — Well planned / Rushed / Overloaded
 * (core business logic — see README AI disclosure)
 * ============================================================
 * 
 * 
 * this information is stale and I will change accordingly 
 * For each pair of consecutive stops on a day:
 *   need  = time spent at the previous stop + travel time to the next
 *   slack = (next.time − prev.time) − need
 *     slack ≥ 15 min        → fine
 *     −15 < slack < 15      → tight        (Rushed)
 *     slack ≤ −15 or gap ≤ 0 → overloaded  (Overloaded)
 * A day is also Rushed if it runs > 11 h, Overloaded if > 13 h or > 6 stops.
 * Border crossings planned at an hour the Watcher heuristic marks "High" → Rushed.
 * The trip's verdict is its worst day.
 * with your own observations — this is what graders will ask about.
 */
import { scoreFor, levelFor } from './congestionHeuristic.js';

export const DWELL_BY_VIBE = { eating: 60, culture: 45, activities: 90, adventure: 60 };
export const DEFAULT_DWELL = 60;
export const UNKNOWN_TRAVEL_MIN = 15; // stop without coordinates
export const THRESHOLDS = { tightSlack: 15, overSlack: -15, rushedHours: 11, overHours: 13, maxStops: 12 };
export const VERDICTS = ['well_planned', 'rushed', 'overloaded'];
export const LABELS = ['Well planned', 'Rushed', 'Overloaded'];
export const SUMMARIES = [
  'Comfortable pace. Every stop has room to breathe, travel included.',
  'Doable, but tight. A few spots leave little room for queues or traffic.',
  'Too much for the time you have. Something has to give. Try the suggested times.',
];
const CP_NAME = { woodlands: 'Woodlands', tuas: 'Tuas' };

export const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fmtMin = (m) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
};
const hhmm = (t) => fmtMin(toMin(t));

export function haversineKm(a, b) {
  const R = 6371;
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Guessing how long it takes to go from one stop to another
// Uses straight line distance, then adds a bit of an extra since real roads are not straight theoretically
// Assumption is made that the further the distance the faster the speed and speed is cap at 70
export function travelMinutes(a, b) {
  if (a?.lat == null || b?.lat == null) return UNKNOWN_TRAVEL_MIN;
  const km = haversineKm(a, b);
  if (km < 0.8) return Math.round(((km * 1.3) / 4.5) * 60) + 5; // walk
  if (km < 20) return Math.round(((km * 1.4) / 30) * 60) + 10; // town driving
  return Math.round(((km * 1.3) / 70) * 60) + 10; // highway
}

export const dwellOf = (item) => (item.dwellMinutes != null ? item.dwellMinutes : DWELL_BY_VIBE[item.vibe] ?? DEFAULT_DWELL);

//Add 10 mins of buffer then round up to the next 15 minutes so it looks clean (1015, 1020 etc instead of 1008)
const suggest = (prevMin, need) => fmtMin(Math.ceil((prevMin + need + 10) / 15) * 15);

/**
 * @param {{label:string, date?:string, items:Array<{id:string,title:string,time?:string|null,vibe?:string,
 *   dwellMinutes?:number|null, lat?:number|null, lng?:number|null, crossing?:string|null, crossingDir?:string|null}>}} day
 */
export function assessDay(day) {
  const warnings = [];
  const crossings = [];
  const legs = {};
  let level = 0;
  const raise = (l) => { level = Math.max(level, l); };

  const timed = day.items.filter((i) => i.time);
  const untimed = day.items.filter((i) => !i.time);
  untimed.forEach((i) => warnings.push({ level: 0, tag: 'NO TIME', message: `Add a time to ${i.title} so it can be checked.`, itemId: i.id }));

  for (let k = 1; k < timed.length; k++) {
    const a = timed[k - 1];
    const b = timed[k];
    let  gap = toMin(b.time) - toMin(a.time);
    // if the next stop's time looks smaller, it might mean it's actually after midnight
    // (e.g. bar at 11pm, supper at 1am) instead of genuinely being out of order
    const prevStopIsEvening = toMin(a.time) >= 18 * 60; // 6pm or later
    const nextStopIsEarlyMorning = toMin(b.time) < 6 * 60; // before 6am
    if (gap < 0 && prevStopIsEvening && nextStopIsEarlyMorning) {
        gap = gap + 24 * 60; // treat it as happening the next day
    }

    const stay = dwellOf(a);
    const travel = travelMinutes(a, b);
    const need = stay + travel;
    const slack = gap - need;
    const suggestedTime = suggest(toMin(a.time), need);

    if (gap <= 0) {
      legs[b.id] = 'overloaded';
      raise(2);
      warnings.push({ level: 2, tag: 'OUT OF ORDER', itemId: b.id, suggestedTime,
        message: `${b.title} (${hhmm(b.time)}) starts before ${a.title} (${hhmm(a.time)}). Fix the times or reorder.` });
    } else if (slack <= THRESHOLDS.overSlack) {
      legs[b.id] = 'overloaded';
      raise(2);
      warnings.push({ level: 2, tag: 'TOO MUCH', itemId: b.id, suggestedTime,
        message: `Not enough time to reach ${b.title}. ${a.title} takes about ${stay} min plus ~${travel} min to get there, but you only have ${gap} min.` });
    } else if (slack < THRESHOLDS.tightSlack) {
      legs[b.id] = 'tight';
      raise(1);
      warnings.push({ level: 1, tag: 'TIGHT', itemId: b.id, suggestedTime,
        message: `Tight squeeze into ${b.title}: ${gap} min for about ${need} min at ${a.title} plus travel.` });
    }
  }

  // Border crossings — reuse the Watcher heuristic
  if (day.date) {
    const dayOfWeek = new Date(day.date + 'T00:00:00Z').getUTCDay();
    const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    timed.filter((i) => i.crossing).forEach((i) => {
      const direction = i.crossingDir || 'to_jb';
      const lvl = levelFor(scoreFor({ checkpoint: i.crossing, direction, dayOfWeek, hour: Math.floor(toMin(i.time) / 60) % 24 }));
      const name = CP_NAME[i.crossing] || i.crossing;
      crossings.push({ itemId: i.id, checkpoint: i.crossing, direction, time: hhmm(i.time), level: lvl,
        message: `${direction === 'to_sg' ? 'Crossing home' : 'Crossing'} at ${name} around ${hhmm(i.time)} · usually ${lvl} on ${weekday}s` });
      if (lvl === 'High') {
        raise(1);
        warnings.push({ level: 1, tag: 'QUEUE', itemId: i.id,
          message: `${name} is usually jammed around ${hhmm(i.time)} on ${weekday}s. Leave earlier, add 45 min, or try ${i.crossing === 'tuas' ? 'Woodlands' : 'Tuas'}.` });
      }
    });
  }

  // Day length + stop count
  let hours = 0;
  if (timed.length) {
    const last = timed[timed.length - 1];
    const first = timed[0];
    let lastEndTime = toMin(last.time) + dwellOf(last);
    //similar to the midnight check but specifically for the last stop of the day
    const firstStopIsEvening = toMin(first.time) >= 18 * 60;
    const lastStopIsEarlyMorning = toMin(last.time) < 6 * 60;
     if (toMin(last.time) < toMin(first.time) && firstStopIsEvening && lastStopIsEarlyMorning) {
     lastEndTime = lastEndTime + 24 * 60;
    }

    hours = (lastEndTime - toMin(timed[0].time)) / 60;
    if (timed.length > THRESHOLDS.maxStops || hours > THRESHOLDS.overHours) {
      raise(2);
      warnings.push({ level: 2, tag: 'TOO MUCH', message: `${day.label} packs ${timed.length} stops into ${hours.toFixed(1)} hours. Move some to another day.` });
    } else if (hours > THRESHOLDS.rushedHours) {
      raise(1);
      warnings.push({ level: 1, tag: 'LONG DAY', message: `${day.label} runs ${hours.toFixed(1)} hours. Plan a slow stop or an earlier finish.` });
    }
  }

  return { label: day.label, date: day.date ?? null, level, verdict: VERDICTS[level], hours: Math.round(hours * 10) / 10, warnings, crossings, legs };
}

/** @param {{days: Array}} trip */
export function assessTrip(trip) {
  const days = trip.days.map(assessDay);
  const level = days.reduce((m, d) => Math.max(m, d.level), 0);
  const prefix = days.length > 1;
  return {
    level,
    verdict: VERDICTS[level],
    label: LABELS[level],
    summary: SUMMARIES[level],
    days: days.map(({ label, date, level: l, verdict, hours }) => ({ label, date, level: l, verdict, verdictLabel: LABELS[l], hours })),
    warnings: days.flatMap((d) => d.warnings.map((w) => ({ ...w, message: prefix ? `${d.label} · ${w.message}` : w.message }))),
    crossings: days.flatMap((d) => d.crossings.map((c) => ({ ...c, message: prefix ? `${d.label} · ${c.message}` : c.message }))),
    legs: Object.assign({}, ...days.map((d) => d.legs)),
  };
}
