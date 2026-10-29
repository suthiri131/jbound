import { supabase } from '../db/supabase.js';
import { badRequest, check, conflict, forbidden, notFound } from '../utils/httpError.js';
import { postSystemMessage, displayName } from '../services/systemMessages.js';
import { tripPhase, sgToday, addDays, MEMORY_WINDOW_DAYS } from '../services/logic/memoryWindow.js';

const PROFILE = 'id, username, name, avatar_url';
export const TRIP_FIELDS = 'id, name, mission, cover_color, owner_id, start_date, end_date, invite_code, archived_at, created_at';

async function addMember(tripId, userId, role = 'member') {
  const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: userId, role });
  if (error?.code === '23505') throw conflict('Already a member of this trip');
  if (error) throw new Error(error.message);
}

/** Attach phase info and lazily archive trips whose 7-day memory window has passed. */
export async function withPhase(trip, today = sgToday()) {
  const info = tripPhase(trip, today);
  if (info.autoArchive) {
    const archivedAt = new Date().toISOString();
    await supabase.from('trips').update({ archived_at: archivedAt }).eq('id', trip.id).is('archived_at', null);
    await postSystemMessage(trip.id, 'Memory box closed · this trip is now a drawer in the Archives');
    return { ...trip, archived_at: archivedAt, ...info };
  }
  return { ...trip, ...info };
}

/** Planner-only database pagination. The unpaged endpoint remains available to shared selectors. */
async function listTripPage(req, res) {
  const { page: requestedPage, pageSize, search, phase } = req.valid.query;
  const today = sgToday();
  const cutoff = addDays(today, -MEMORY_WINDOW_DAYS);
  function query(head = false) {
    let q = supabase.from('trips')
      .select(`${TRIP_FIELDS}, membership:trip_members!inner(user_id, role), members:trip_members(count), items:itinerary_items(done)`, { count: 'exact', head })
      .eq('membership.user_id', req.user.id)
      .is('archived_at', null);
    // Match the computed phase before counting and limiting rows.
    if (phase === 'planning') q = q.or(`start_date.is.null,start_date.gt.${today}`);
    else if (phase === 'on_the_road') q = q.lte('start_date', today)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.eq.${today})`);
    else if (phase === 'memory_box') q = q.lte('start_date', today)
      .or(`and(end_date.lt.${today},end_date.gte.${cutoff}),and(end_date.is.null,start_date.lt.${today},start_date.gte.${cutoff})`);
    else q = q.or(`start_date.is.null,start_date.gt.${today},end_date.gte.${cutoff},and(end_date.is.null,start_date.gte.${cutoff})`);
    if (search) {
      // Escape LIKE wildcards so searches retain literal substring behaviour.
      const literal = search.replace(/[\\%_]/g, '\\$&');
      q = q.ilike('name', `%${literal}%`);
    }
    return q.order('created_at', { ascending: false }).order('id', { ascending: true });
  }
  const countResult = await query(true);
  check(countResult);
  const total = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const result = total ? await query().range((page - 1) * pageSize, page * pageSize - 1) : { data: [] };
  check(result);
  const items = result.data.map(({ membership, members, items, ...trip }) => ({
    ...trip, ...tripPhase(trip, today),
    myRole: membership[0]?.role,
    memberCount: members?.[0]?.count ?? 0,
    stopCount: items?.length ?? 0,
    doneCount: items?.filter((item) => item.done).length ?? 0,
  }));
  res.json({ items, page, pageSize, total, totalPages });
}

/** GET /api/trips?include=active|all — "active" = the satchel (everything not archived) */
export async function listMyTrips(req, res) {
  if (req.valid.query.page !== undefined) return listTripPage(req, res);
  const rows = check(
    await supabase
      .from('trip_members')
      .select(`role, trip:trips(${TRIP_FIELDS}, members:trip_members(count), items:itinerary_items(done))`)
      .eq('user_id', req.user.id),
  );
  const today = sgToday();
  const trips = await Promise.all(
    rows
      .filter((r) => r.trip)
      .map(async ({ role, trip: { members, items, ...trip } }) => ({
        ...(await withPhase(trip, today)),
        myRole: role,
        memberCount: members?.[0]?.count ?? 0,
        stopCount: items?.length ?? 0,
        doneCount: items?.filter((i) => i.done).length ?? 0,
      })),
  );
  const list = req.valid.query.include === 'all' ? trips : trips.filter((t) => t.phase !== 'archived');
  list.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  res.json(list);
}

/** POST /api/trips  { name, mission?, coverColor?, startDate?, endDate?, inviteUsernames?[] } */
export async function createTrip(req, res) {
  const { name, mission, coverColor, startDate, endDate, inviteUsernames } = req.valid.body;
  const trip = check(
    await supabase
      .from('trips')
      .insert({ name, mission, cover_color: coverColor, owner_id: req.user.id, start_date: startDate, end_date: endDate })
      .select(TRIP_FIELDS)
      .single(),
  );
  await addMember(trip.id, req.user.id, 'owner');

  const skipped = [];
  if (inviteUsernames?.length) {
    const profiles = check(await supabase.from('profiles').select('id, username').in('username', inviteUsernames));
    for (const p of profiles) if (p.id !== req.user.id) await addMember(trip.id, p.id);
    const found = new Set(profiles.map((p) => p.username));
    skipped.push(...inviteUsernames.filter((u) => !found.has(u)));
  }

  await postSystemMessage(trip.id, `${await displayName(req.user.id)} packed the trip "${trip.name}"`);
  res.status(201).json({ ...(await withPhase(trip)), skippedUsernames: skipped });
}

/** GET /api/trips/:tripId — trip + phase + members + itinerary */
export async function getTrip(req, res) {
  const tripId = req.params.tripId;
  const [trip, members, itinerary] = await Promise.all([
    supabase.from('trips').select(TRIP_FIELDS).eq('id', tripId).single(),
    supabase.from('trip_members').select(`role, joined_at, user:profiles(${PROFILE})`).eq('trip_id', tripId),
    supabase
      .from('itinerary_items')
      .select('id, title, day, time, position, notes, dwell_minutes, lat, lng, crossing, crossing_dir, done, place:places(id, name, lat, lng, vibes, photos)')
      .eq('trip_id', tripId)
      .order('day', { ascending: true, nullsFirst: true })
      .order('position', { ascending: true }),
  ]);
  res.json({
    ...(await withPhase(check(trip, 'Trip not found'))),
    myRole: req.membership.role,
    members: check(members).map(({ user, ...m }) => ({ ...user, ...m })),
    itinerary: check(itinerary),
  });
}

/** PATCH /api/trips/:tripId — any trip member, including the owner */
export async function updateTrip(req, res) {
  const { name, mission, coverColor, startDate, endDate } = req.valid.body;
  const nextStart = startDate === undefined ? req.trip.start_date : startDate;
  const nextEnd = endDate === undefined ? req.trip.end_date : endDate;
  if (nextStart && nextEnd && nextEnd < nextStart) {
    throw badRequest('End date must be on or after start date');
  }
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (mission !== undefined) patch.mission = mission;
  if (coverColor !== undefined) patch.cover_color = coverColor;
  if (startDate !== undefined) patch.start_date = startDate;
  if (endDate !== undefined) patch.end_date = endDate;
  const data = check(await supabase.from('trips').update(patch).eq('id', req.params.tripId).select(TRIP_FIELDS).single());
  res.json(await withPhase(data));
}

/** DELETE /api/trips/:tripId — owner only (cascades to everything) */
export async function deleteTrip(req, res) {
  check(await supabase.from('trips').delete().eq('id', req.params.tripId));
  res.status(204).end();
}

/** POST /api/trips/:tripId/archive — any member can send a finished trip up to the attic early */
export async function archiveTrip(req, res) {
  const trip = check(await supabase.from('trips').select(TRIP_FIELDS).eq('id', req.params.tripId).single());
  const { phase } = tripPhase(trip);
  if (phase === 'archived') return res.json(trip);
  if (phase !== 'memory_box') throw badRequest('Only finished trips can go to the Archives');
  const data = check(
    await supabase.from('trips').update({ archived_at: new Date().toISOString() }).eq('id', trip.id).select(TRIP_FIELDS).single(),
  );
  await postSystemMessage(trip.id, `${await displayName(req.user.id)} sent the trip up to the Archives`);
  res.json({ ...data, phase: 'archived' });
}

/** POST /api/trips/:tripId/members  { username } */
export async function inviteMember(req, res) {
  const profile = check(
    await supabase.from('profiles').select(PROFILE).eq('username', req.valid.body.username).single(),
    'No user with that username',
  );
  await addMember(req.params.tripId, profile.id);
  await postSystemMessage(req.params.tripId, `${await displayName(req.user.id)} added ${profile.name} to the crew`);
  res.status(201).json(profile);
}

/** POST /api/trips/join  { inviteCode } */
export async function joinByCode(req, res) {
  const trip = check(
    await supabase.from('trips').select(TRIP_FIELDS).eq('invite_code', req.valid.body.inviteCode.trim()).single(),
    'Invite code not valid',
  );
  const { data: existing } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', trip.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (!existing) {
    await addMember(trip.id, req.user.id);
    await postSystemMessage(trip.id, `${await displayName(req.user.id)} joined the crew`);
  }
  res.json({ ...trip, alreadyMember: Boolean(existing) });
}

/** DELETE /api/trips/:tripId/members/:userId */
export async function removeMember(req, res) {
  const { tripId, userId } = req.params;
  const isSelf = userId === req.user.id;
  if (!isSelf && req.membership.role !== 'owner') throw forbidden('Only the owner can remove other members');
  if (userId === req.trip.owner_id) throw badRequest('The owner cannot leave; delete the trip instead');

  const { data } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId).select('user_id');
  if (!data?.length) throw notFound('That user is not in this trip');

  const name = await displayName(userId);
  await postSystemMessage(tripId, isSelf ? `${name} left the crew` : `${name} was removed from the crew`);
  res.status(204).end();
}

/** POST /api/trips/:tripId/invite-code — owner regenerates the share code */
export async function regenerateInviteCode(req, res) {
  const code = Math.random().toString(36).slice(2, 10);
  const data = check(
    await supabase.from('trips').update({ invite_code: code }).eq('id', req.params.tripId).select('invite_code').single(),
  );
  res.json(data);
}
