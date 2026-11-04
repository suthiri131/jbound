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

const REMINDER_DAYS_LEFT = 2;
const daysText = (n) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * One member's notifications about a trip's memory window, newest first: told when the trip ends,
 * then reminded near the close if they still haven't added a photo.
 * @param {{id:string, name:string, start_date?:string|null, end_date?:string|null, archived_at?:string|null}} trip
 * @param {boolean} hasPhotos whether this member has added any
 * @param {string} [today] YYYY-MM-DD
 */
export function memoryReminders(trip, hasPhotos, today = sgToday()) {
  const info = tripPhase(trip, today);
  if (info.phase !== 'memory_box') return [];
  const base = { tripId: trip.id, needsPhotos: !hasPhotos };
  const list = [{
    ...base,
    id: `${trip.id}-opened`,
    date: info.opensOn,
    daysLeft: MEMORY_WINDOW_DAYS,
    text: `"${trip.name}" has ended. You have ${daysText(MEMORY_WINDOW_DAYS)} left to add your photos to the archive.`,
  }];
  if (!hasPhotos && info.daysLeft <= REMINDER_DAYS_LEFT) {
    list.unshift({
      ...base,
      id: `${trip.id}-reminder`,
      date: addDays(info.closesOn, 1 - REMINDER_DAYS_LEFT),
      daysLeft: info.daysLeft,
      text: `You haven't added any photos to "${trip.name}" yet. You have ${daysText(info.daysLeft)} left.`,
    });
  }
  return list;
}

/** Uploads are allowed while the trip is happening and during the memory window. */
export function canAddMemories(phase) {
  return phase === 'on_the_road' || phase === 'memory_box';
}
