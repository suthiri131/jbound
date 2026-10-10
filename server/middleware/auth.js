import { supabase } from '../db/supabase.js';
import { unauthorized } from '../utils/httpError.js';

function tokenFrom(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Verifies the Supabase access token sent by the Vue client:
 *   Authorization: Bearer <session.access_token>
 * Sets req.user = { id, email }.
 */
export async function requireAuth(req, _res, next) {
  const token = tokenFrom(req);
  if (!token) return next(unauthorized());
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return next(unauthorized('Session expired or invalid'));
  req.user = { id: data.user.id, email: data.user.email };
  next();
}

/** Same as requireAuth but lets anonymous requests through (req.user stays undefined). */
export async function optionalAuth(req, _res, next) {
  const token = tokenFrom(req);
  if (!token) return next();
  const { data } = await supabase.auth.getUser(token);
  if (data?.user) req.user = { id: data.user.id, email: data.user.email };
  next();
}
