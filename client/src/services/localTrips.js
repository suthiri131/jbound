// Temporary browser storage until the trip API is implemented.
export function readTrips(userId) {
  const trips = JSON.parse(localStorage.getItem(`jbound:trips:${userId}`) || '[]');
  if (!Array.isArray(trips)) throw new Error('Invalid saved trip data.');
  return trips;
}

export function createLocalTrip(userId, details) {
  if (!userId) throw new Error('Sign in before creating a trip.');
  const trip = { ...details, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  localStorage.setItem(`jbound:trips:${userId}`, JSON.stringify([...readTrips(userId), trip]));
  return trip;
}

export function tripDays(start, end) {
  if (!start || !end || end < start) return [];
  const days = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function formatTripDay(day) {
  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

export function readItinerary(userId, tripId) {
  const items = JSON.parse(localStorage.getItem(`jbound:itinerary:${userId}:${tripId}`) || '[]');
  if (!Array.isArray(items)) throw new Error('Invalid saved itinerary.');
  return items;
}

export function saveItinerary(userId, tripId, items) {
  if (!userId || !tripId) throw new Error('A signed-in user and trip are required.');
  localStorage.setItem(`jbound:itinerary:${userId}:${tripId}`, JSON.stringify(items));
}
