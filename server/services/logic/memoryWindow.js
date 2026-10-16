/**
 * ============================================================
 * TRIP PHASE + 7-DAY MEMORY WINDOW  (core business logic — see README AI disclosure)
 * ============================================================
 *   planning      today is before start_date (or no dates yet)
 *   on_the_road   start_date ≤ today ≤ end_date
 *   memory_box    the 7 days after end_date: crew uploads photos
 *   archived      archived_at is set, or the 7 days are over
 *                 (the server sets archived_at lazily the next time
 *                 anyone loads their trips — no cron job needed)
 *
 * All dates are 'YYYY-MM-DD' strings in Singapore time.
 * TODO(team): rewrite in your own words + adjust MEMORY_WINDOW_DAYS if needed.
 */

export const MEMORY_WINDOW_DAYS = 7;

/** Today's date in Singapore as YYYY-MM-DD (independent of the server's timezone). */
export function sgToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(now);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86_400_000);
}

/**
 * @param {{start_date?:string|null, end_date?:string|null, archived_at?:string|null}} trip
 * @param {string} [today] YYYY-MM-DD
 */
export function tripPhase(trip, today = sgToday()) {
  if (trip.archived_at) return { phase: 'archived', autoArchive: false };

  const start = trip.start_date;
  const end = trip.end_date || trip.start_date;
  if (!start) return { phase: 'planning', daysUntil: null };
  if (today < start) return { phase: 'planning', daysUntil: daysBetween(today, start) };
  if (today <= end) return { phase: 'on_the_road' };

  const opensOn = addDays(end, 1);
  const closesOn = addDays(end, MEMORY_WINDOW_DAYS);
  const archivesOn = addDays(end, MEMORY_WINDOW_DAYS + 1);
  if (today <= closesOn) {
    return { phase: 'memory_box', opensOn, closesOn, archivesOn, daysLeft: daysBetween(today, closesOn) + 1 };
  }
  return { phase: 'archived', autoArchive: true, archivesOn };
}

/** Uploads are allowed while the trip is happening and during the memory window. */
export function canAddMemories(phase) {
  return phase === 'on_the_road' || phase === 'memory_box';
}
