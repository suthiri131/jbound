/**
 * ============================================================
 * FEASIBILITY CHECK — Well planned / Rushed / Overloaded
 * (core business logic — see README AI disclosure)
 * ============================================================
 * For each pair of consecutive stops on a day:
 *   need  = time spent at the previous stop + travel time to the next
 *   slack = (next.time − prev.time) − need
 *     slack ≥ 15 min        → fine
 *     −15 < slack < 15      → tight        (Rushed)
 *     slack ≤ −15 or gap ≤ 0 → overloaded  (Overloaded)
 * A day is also Rushed if it runs > 11 h, Overloaded if > 13 h or > 6 stops.
 * Border crossings planned at an hour the Watcher heuristic marks "High" → Rushed.
 * The trip's verdict is its worst day.
 *
 * TODO(team): rewrite in your own words and tune the constants below
 * with your own observations — this is what graders will ask about.
 */
import { scoreFor, levelFor } from './congestionHeuristic.js';

export const DWELL_BY_VIBE = { eating: 60, culture: 45, activities: 90, adventure: 60 };
export const DEFAULT_DWELL = 60;
export const UNKNOWN_TRAVEL_MIN = 15; // stop without coordinates
export const THRESHOLDS = { tightSlack: 15, overSlack: -15, rushedHours: 11, overHours: 13, maxStops: 6 };
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

/** Rough door-to-door minutes. Straight line × detour factor ÷ speed + parking/walking buffer. */
export function travelMinutes(a, b) {
  if (a?.lat == null || b?.lat == null) return UNKNOWN_TRAVEL_MIN;
  const km = haversineKm(a, b);
  if (km < 0.8) return Math.round(((km * 1.3) / 4.5) * 60) + 5; // walk
  if (km < 20) return Math.round(((km * 1.4) / 30) * 60) + 10; // town driving
  return Math.round(((km * 1.3) / 70) * 60) + 10; // highway
}

export const dwellOf = (item) => (item.dwellMinutes != null ? item.dwellMinutes : DWELL_BY_VIBE[item.vibe] ?? DEFAULT_DWELL);

/** Suggest a start time: previous stop + need + 10 min breathing room, rounded up to the next 15 min. */
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
    const gap = toMin(b.time) - toMin(a.time);
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
    hours = (toMin(last.time) + dwellOf(last) - toMin(timed[0].time)) / 60;
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
