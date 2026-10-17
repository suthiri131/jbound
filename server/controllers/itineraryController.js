import { supabase } from '../db/supabase.js';
import { badRequest, check, notFound } from '../utils/httpError.js';
import { postSystemMessage, displayName } from '../services/systemMessages.js';
import { getDrivingRoute } from '../services/routingService.js';
import { CHECKPOINTS } from '../services/logic/geo.js';
import { validateStopDay } from '../utils/stopDay.js';
import { assessTrip } from '../services/logic/feasibility.js';

const ITEM_FIELDS =
  'id, trip_id, title, day, time, position, notes, vibe, dwell_minutes, lat, lng, crossing, crossing_dir, done, done_at, created_at, place:places(id, name, lat, lng, vibes, photos)';

function dayLabel(trip, day) {
  if (!day) return 'the itinerary';
  if (!trip.start_date) return day;
  const diff = Math.round((new Date(day) - new Date(trip.start_date)) / 86_400_000);
  return diff >= 0 ? `Day ${diff + 1}` : day;
}

async function nextPosition(tripId, day) {
  let q = supabase.from('itinerary_items').select('position').eq('trip_id', tripId).order('position', { ascending: false }).limit(1);
  q = day ? q.eq('day', day) : q.is('day', null);
  const rows = check(await q);
  return rows.length ? rows[0].position + 1 : 0;
}

/** camelCase body → snake_case columns for the optional stop fields */
function stopPatch(body) {
  const map = { vibe: 'vibe', dwellMinutes: 'dwell_minutes', lat: 'lat', lng: 'lng', crossing: 'crossing', crossingDir: 'crossing_dir' };
  const patch = {};
  for (const [k, col] of Object.entries(map)) if (body[k] !== undefined) patch[col] = body[k];
  return patch;
}

async function listOrdered(tripId) {
  return check(
    await supabase
      .from('itinerary_items')
      .select(ITEM_FIELDS)
      .eq('trip_id', tripId)
      .order('day', { ascending: true, nullsFirst: true })
      .order('position', { ascending: true }),
  );
}

/** GET /api/trips/:tripId/itinerary */
export async function listItems(req, res) {
  res.json(await listOrdered(req.params.tripId));
}

/** POST /api/trips/:tripId/itinerary  { placeId? | title?, day?, time?, notes?, vibe?, dwellMinutes?, lat?, lng?, crossing?, crossingDir? } */
export async function addItem(req, res) {
  const { placeId, title, day, time, notes } = req.valid.body;
  validateStopDay(req.trip, day);
  let finalTitle = title;
  let vibe = req.valid.body.vibe;
  if (placeId) {
    const place = check(await supabase.from('places').select('name, vibes').eq('id', placeId).single(), 'Place not found');
    finalTitle = title || place.name;
    vibe = vibe ?? place.vibes?.[0] ?? null;
  }
  if (!finalTitle) throw badRequest('Provide a placeId or a title');

  const item = check(
    await supabase
      .from('itinerary_items')
      .insert({
        trip_id: req.params.tripId,
        place_id: placeId ?? null,
        title: finalTitle,
        day: day ?? null,
        time: time ?? null,
        notes: notes ?? null,
        ...stopPatch(req.valid.body),
        vibe: vibe ?? null,
        position: await nextPosition(req.params.tripId, day),
        created_by: req.user.id,
      })
      .select(ITEM_FIELDS)
      .single(),
  );

  await postSystemMessage(req.params.tripId, `${await displayName(req.user.id)} added ${finalTitle} to ${dayLabel(req.trip, day)}`);
  res.status(201).json(item);
}

/** PATCH /api/trips/:tripId/itinerary/:itemId — edit fields, or tick off with { done: true } */
export async function updateItem(req, res) {
  const { title, day, time, notes, done } = req.valid.body;
  validateStopDay(req.trip, day);
  const patch = stopPatch(req.valid.body);
  if (title !== undefined) patch.title = title;
  if (day !== undefined) {
    const existing = check(await supabase.from('itinerary_items').select('day').eq('id', req.params.itemId).eq('trip_id', req.params.tripId).single(), 'Itinerary item not found');
    patch.day = day;
    if (day !== existing.day) patch.position = await nextPosition(req.params.tripId, day);
  }
  if (time !== undefined) patch.time = time;
  if (notes !== undefined) patch.notes = notes;
  if (done !== undefined) {
    patch.done = done;
    patch.done_at = done ? new Date().toISOString() : null;
  }

  const data = check(
    await supabase
      .from('itinerary_items')
      .update(patch)
      .eq('id', req.params.itemId)
      .eq('trip_id', req.params.tripId)
      .select(ITEM_FIELDS)
      .single(),
    'Itinerary item not found',
  );
  if (done === true) await postSystemMessage(req.params.tripId, `${await displayName(req.user.id)} ticked off ${data.title}`);
  res.json(data);
}

/** PUT /api/trips/:tripId/itinerary/order  { items: [{ id, day, position }] } */
export async function reorderItems(req, res) {
  const { items } = req.valid.body;
  const tripId = req.params.tripId;

  for (const item of items) validateStopDay(req.trip, item.day);

  const existing = check(await supabase.from('itinerary_items').select('id').eq('trip_id', tripId));
  const valid = new Set(existing.map((r) => r.id));
  const foreign = items.filter((i) => !valid.has(i.id));
  if (foreign.length) throw badRequest('Some items do not belong to this trip', foreign.map((i) => i.id));

  const results = await Promise.all(
    items.map((i) =>
      supabase.from('itinerary_items').update({ day: i.day ?? null, position: i.position }).eq('id', i.id).eq('trip_id', tripId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed) check(failed);
  res.json(await listOrdered(tripId));
}

/** DELETE /api/trips/:tripId/itinerary/:itemId */
export async function deleteItem(req, res) {
  const { data } = await supabase
    .from('itinerary_items')
    .delete()
    .eq('id', req.params.itemId)
    .eq('trip_id', req.params.tripId)
    .select('title');
  if (!data?.length) throw notFound('Itinerary item not found');
  await postSystemMessage(req.params.tripId, `${await displayName(req.user.id)} removed ${data[0].title}`);
  res.status(204).end();
}

/**
 * GET /api/trips/:tripId/feasibility
 * Groups the itinerary by day and runs the Well planned / Rushed / Overloaded check.
 * Every crew member gets the same result because it's computed from the shared itinerary.
 */
export async function getFeasibility(req, res) {
  const items = await listOrdered(req.params.tripId);
  const byDay = new Map();
  for (const it of items) {
    if (!it.day) continue; // unscheduled stops are not checked
    if (!byDay.has(it.day)) byDay.set(it.day, []);
    byDay.get(it.day).push({
      id: it.id,
      title: it.title,
      time: it.time,
      vibe: it.vibe,
      dwellMinutes: it.dwell_minutes,
      lat: it.lat ?? it.place?.lat ?? null,
      lng: it.lng ?? it.place?.lng ?? null,
      crossing: it.crossing,
      crossingDir: it.crossing_dir,
    });
  }
  const days = [...byDay.entries()].map(([date, dayItems]) => ({ label: dayLabel(req.trip, date), date, items: dayItems }));
  res.json(assessTrip({ days }));
}

/** GET /api/trips/:tripId/route?day=YYYY-MM-DD&fromCheckpoint=woodlands */
export async function getDayRoute(req, res) {
  const { day, fromCheckpoint } = req.valid.query;
  let q = supabase
    .from('itinerary_items')
    .select('id, title, position, lat, lng, place:places(lat, lng)')
    .eq('trip_id', req.params.tripId)
    .order('position', { ascending: true });
  q = day ? q.eq('day', day) : q.is('day', null);
  const items = check(await q);

  const stops = items
    .map((i) => ({ id: i.id, title: i.title, lat: i.lat ?? i.place?.lat, lng: i.lng ?? i.place?.lng }))
    .filter((s) => s.lat != null && s.lng != null);
  if (fromCheckpoint) {
    const cp = CHECKPOINTS[fromCheckpoint];
    stops.unshift({ id: `checkpoint-${cp.id}`, title: cp.name, ...cp.sgSide });
  }
  if (stops.length < 2) return res.json({ stops, route: null, message: 'Add at least 2 stops with a location to see a route' });
  res.json({ stops, route: await getDrivingRoute(stops) });
}
