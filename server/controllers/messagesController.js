import { supabase } from '../db/supabase.js';
import { check } from '../utils/httpError.js';

const MESSAGE_FIELDS = 'id, trip_id, kind, text, created_at, author:profiles(id, username, name, avatar_url)';

/**
 * GET /api/trips/:tripId/messages?after=<ISO>&limit=50
 * - No `after`: latest N messages (oldest → newest) for first load.
 * - With `after`: only newer messages → use for the 3–5s polling fallback.
 * Primary path is Supabase Realtime on the client (see README).
 */
export async function listMessages(req, res) {
  const { after, limit } = req.valid.query;
  let q = supabase.from('messages').select(MESSAGE_FIELDS).eq('trip_id', req.params.tripId);

  if (after) {
    const data = check(await q.gt('created_at', after).order('created_at', { ascending: true }).limit(limit));
    return res.json(data);
  }
  const data = check(await q.order('created_at', { ascending: false }).limit(limit));
  res.json(data.reverse());
}

/** POST /api/trips/:tripId/messages  { text } */
export async function sendMessage(req, res) {
  const data = check(
    await supabase
      .from('messages')
      .insert({ trip_id: req.params.tripId, user_id: req.user.id, kind: 'user', text: req.valid.body.text })
      .select(MESSAGE_FIELDS)
      .single(),
  );
  res.status(201).json(data);
}
