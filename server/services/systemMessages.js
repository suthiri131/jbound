import { supabase } from '../db/supabase.js';

/**
 * Posts an inline system message into a trip's chat,
 * e.g. "Alex added Restoran Hua Mui to Day 2".
 * Failures are logged, never thrown — chat noise must not break the main action.
 */
export async function postSystemMessage(tripId, text) {
  const { error } = await supabase.from('messages').insert({ trip_id: tripId, kind: 'system', text });
  if (error) console.warn('[systemMessage] failed:', error.message);
}

export async function displayName(userId) {
  const { data } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
  return data?.name || 'Someone';
}
