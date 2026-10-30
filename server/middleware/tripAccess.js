import { supabase } from '../db/supabase.js';
import { forbidden, notFound } from '../utils/httpError.js';

/**
 * Must run after requireAuth on routes with :tripId.
 * Blocks non-members and sets req.membership = { role }.
 */
export async function requireTripMember(req, _res, next) {
  const { tripId } = req.params;
  const { data: trip } = await supabase.from('trips').select('id, owner_id, name, start_date, end_date').eq('id', tripId).maybeSingle();
  if (!trip) return next(notFound('Trip not found'));

  const { data: member } = await supabase
    .from('trip_members')
    .select('role, status')
    .eq('trip_id', tripId)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (!member) return next(forbidden('You are not a member of this trip'));

  req.trip = trip;
  req.membership = member;
  next();
}

export function requireTripOwner(req, _res, next) {
  if (req.membership?.role !== 'owner') return next(forbidden('Only the trip owner can do this'));
  next();
}
