/**
 * The Archives attic. Every member has their own 7 drawers; an archived trip is
 * filed into the next empty one, and once they're full the member chooses whether
 * to clear the new trip out or swap it for an old drawer.
 */
import { supabase } from '../db/supabase.js';
import { badRequest, check } from '../utils/httpError.js';
import { sgToday, tripPhase } from '../services/logic/memoryWindow.js';
import { fillDrawers, ATTIC_SLOTS } from '../services/logic/attic.js';
import { TRIP_FIELDS, withPhase } from './tripsController.js';

const tripYear = (trip) => (trip.start_date || trip.archived_at || '').slice(0, 4);

/** Archived trips still in this user's attic, with the drawer each one sits in (or null). */
async function atticEntries(userId) {
  const rows = check(
    await supabase
      .from('trip_members')
      .select(`attic_slot, attic_cleared_at, trip:trips(${TRIP_FIELDS})`)
      .eq('user_id', userId),
  );
  const today = sgToday();
  const entries = await Promise.all(
    rows
      .filter((r) => r.trip && !r.attic_cleared_at)
      .map(async (r) => ({ slot: r.attic_slot, trip: await withPhase(r.trip, today) })),
  );
  return entries.filter((e) => e.trip.phase === 'archived');
}

/** GET /api/archives — the user's drawers, plus any archive waiting for a free drawer */
export async function getAttic(req, res) {
  const entries = await atticEntries(req.user.id);
  const { placements, overflow } = fillDrawers(entries);
  const byId = new Map(entries.map((e) => [e.trip.id, e.trip]));
  const drawers = entries.filter((e) => e.slot != null).map(({ slot, trip }) => ({ slot, trip, isNew: false }));

  for (const { tripId, slot } of placements) {
    // The partial unique index rejects a drawer another tab filled first; that trip is filed on the next visit.
    const { error } = await supabase
      .from('trip_members')
      .update({ attic_slot: slot })
      .eq('trip_id', tripId)
      .eq('user_id', req.user.id)
      .is('attic_slot', null);
    if (!error) drawers.push({ slot, trip: byId.get(tripId), isNew: true });
  }
  drawers.sort((a, b) => a.slot - b.slot);

  res.json({
    capacity: ATTIC_SLOTS,
    drawers,
    pending: overflow,
    totalTrips: drawers.length,
    years: [...new Set(drawers.map((d) => tripYear(d.trip)).filter(Boolean))].sort().reverse(),
  });
}

async function requireArchived(tripId) {
  const trip = check(await supabase.from('trips').select(TRIP_FIELDS).eq('id', tripId).single(), 'Trip not found');
  if (tripPhase(trip).phase !== 'archived') throw badRequest('Only archived trips go in the attic');
}

/** POST /api/archives/:tripId/clear — take a trip out of my attic (the crew keeps theirs) */
export async function clearFromAttic(req, res) {
  await requireArchived(req.params.tripId);
  check(
    await supabase
      .from('trip_members')
      .update({ attic_slot: null, attic_cleared_at: new Date().toISOString() })
      .eq('trip_id', req.params.tripId)
      .eq('user_id', req.user.id),
  );
  res.status(204).end();
}

/** PUT /api/archives/:tripId/drawer  { slot } — file a trip into a drawer, clearing out whatever was in it */
export async function placeInDrawer(req, res) {
  const { tripId } = req.params;
  const { slot } = req.valid.body;
  await requireArchived(tripId);
  check(
    await supabase
      .from('trip_members')
      .update({ attic_slot: null, attic_cleared_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .eq('attic_slot', slot)
      .neq('trip_id', tripId),
  );
  check(
    await supabase
      .from('trip_members')
      .update({ attic_slot: slot, attic_cleared_at: null })
      .eq('trip_id', tripId)
      .eq('user_id', req.user.id),
  );
  res.status(204).end();
}
