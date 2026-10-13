/**
 * Memory box: photos the crew adds during the trip and in the 7 days after it ends.
 * Everything here becomes the scrapbook inside the trip's drawer in the Archives.
 */
import { supabase } from '../db/supabase.js';
import { badRequest, check, forbidden, notFound } from '../utils/httpError.js';
import { uploadImage } from '../services/storageService.js';
import { postSystemMessage, displayName } from '../services/systemMessages.js';
import { tripPhase, canAddMemories } from '../services/logic/memoryWindow.js';

const MEMORY_FIELDS = 'id, trip_id, image_url, caption, item_id, created_at, author:profiles(id, username, name, avatar_url), stop:itinerary_items(id, title)';

async function assertOpen(tripId) {
  const trip = check(await supabase.from('trips').select('start_date, end_date, archived_at').eq('id', tripId).single(), 'Trip not found');
  const info = tripPhase(trip);
  if (!canAddMemories(info.phase)) {
    throw forbidden(info.phase === 'archived' ? 'This trip is in the Archives now' : 'The memory box opens when the trip starts');
  }
  return info;
}

async function assertItemInTrip(tripId, itemId) {
  if (!itemId) return;
  const { data } = await supabase.from('itinerary_items').select('id').eq('id', itemId).eq('trip_id', tripId).maybeSingle();
  if (!data) throw badRequest('That stop is not part of this trip');
}

/** GET /api/trips/:tripId/memories — memories + window info + who has contributed */
export async function listMemories(req, res) {
  const tripId = req.params.tripId;
  const [rows, trip, members] = await Promise.all([
    supabase.from('memories').select(MEMORY_FIELDS).eq('trip_id', tripId).order('created_at', { ascending: true }),
    supabase.from('trips').select('start_date, end_date, archived_at').eq('id', tripId).single(),
    supabase.from('trip_members').select('user:profiles(id, name)').eq('trip_id', tripId),
  ]);
  const memories = check(rows);
  const counts = {};
  memories.forEach((m) => { counts[m.author?.id] = (counts[m.author?.id] || 0) + 1; });
  res.json({
    window: tripPhase(check(trip)),
    memories,
    contributors: check(members).map(({ user }) => ({ id: user.id, name: user.name, count: counts[user.id] || 0 })),
  });
}

/** POST /api/trips/:tripId/memories — multipart: image (file), caption?, itemId? */
export async function addMemory(req, res) {
  const tripId = req.params.tripId;
  await assertOpen(tripId);
  if (!req.file) throw badRequest('Attach a photo in the "image" field');
  const { caption, itemId } = req.valid.body;
  await assertItemInTrip(tripId, itemId);

  const { url } = await uploadImage(req.file, { folder: `memories/${tripId}`, userId: req.user.id });
  const data = check(
    await supabase
      .from('memories')
      .insert({ trip_id: tripId, user_id: req.user.id, image_url: url, caption: caption || null, item_id: itemId || null })
      .select(MEMORY_FIELDS)
      .single(),
  );
  // TODO(team): batch these so 10 uploads post one chat message instead of ten
  await postSystemMessage(tripId, `${await displayName(req.user.id)} added a photo to the memory box`);
  res.status(201).json(data);
}

/** PATCH /api/trips/:tripId/memories/:memoryId  { caption?, itemId? } — any crew member can caption/tag */
export async function updateMemory(req, res) {
  const { tripId, memoryId } = req.params;
  await assertOpen(tripId);
  const { caption, itemId } = req.valid.body;
  if (itemId !== undefined) await assertItemInTrip(tripId, itemId);
  const patch = {};
  if (caption !== undefined) patch.caption = caption || null;
  if (itemId !== undefined) patch.item_id = itemId;
  const data = check(
    await supabase.from('memories').update(patch).eq('id', memoryId).eq('trip_id', tripId).select(MEMORY_FIELDS).single(),
    'Photo not found',
  );
  res.json(data);
}

/** DELETE /api/trips/:tripId/memories/:memoryId — uploader or trip owner */
export async function deleteMemory(req, res) {
  const { tripId, memoryId } = req.params;
  await assertOpen(tripId);
  const { data: m } = await supabase.from('memories').select('user_id').eq('id', memoryId).eq('trip_id', tripId).maybeSingle();
  if (!m) throw notFound('Photo not found');
  if (m.user_id !== req.user.id && req.membership.role !== 'owner') throw forbidden('Only the uploader or trip owner can remove this photo');
  check(await supabase.from('memories').delete().eq('id', memoryId));
  res.status(204).end();
}
