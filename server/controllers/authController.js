import { createAnonClient, supabase } from '../db/supabase.js';
import { HttpError, badRequest, check, conflict, forbidden, unauthorized } from '../utils/httpError.js';
import { displayName, postSystemMessage } from '../services/systemMessages.js';
import { pathFromPublicUrl, removeFile, removeUserFiles, sniffImageType, uploadImage } from '../services/storageService.js';

const PROFILE_COLUMNS = 'id, username, name, avatar_url';

/**
 * The profiles row is created by the handle_new_user database trigger when the auth user is created.
 * If it is somehow missing (e.g. a user made in the dashboard before the trigger existed) create it.
 */
async function getProfile(user) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (data) return data;

  const fallback = {
    id: user.id,
    username: `user_${user.id.slice(0, 8)}`,
    name: user.email?.split('@')[0] || 'Traveller',
  };
  const created = await supabase.from('profiles').insert(fallback).select(PROFILE_COLUMNS).single();
  if (created.error) throw new HttpError(500, created.error.message);
  return created.data;
}

/**
 * Adds first_name / last_name to the profile we send to the client.
 * They are saved in the auth user's metadata at sign-up (profiles.name stays "First Last" so the
 * rest of the app is untouched). Accounts made before this change fall back to splitting `name`.
 */
function withNames(profile, authUser) {
  const meta = authUser?.user_metadata || {};
  const [first = '', ...rest] = (profile.name || '').trim().split(/\s+/);
  return { ...profile, first_name: meta.first_name || first, last_name: meta.last_name || rest.join(' ') };
}

/** "Darwin Núñez" -> "darwinnunez": lowercase letters/digits only, accents stripped. */
const slug = (text) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * People no longer type a username. We build one from their name (first_last) and add a number
 * if it is taken, so "@username" invites keep working. Always matches profiles' ^[a-z0-9_]{3,20}$ check.
 */
async function pickUsername(firstName, lastName) {
  let base = [slug(firstName), slug(lastName)].filter(Boolean).join('_').slice(0, 16);
  if (base.length < 3) base = `jbound_${base}`.replace(/_$/, '').slice(0, 16);

  // underscore is a LIKE wildcard, so this can over-match; that is fine, we compare exact names below
  const { data, error } = await supabase.from('profiles').select('username').like('username', `${base}%`).limit(1000);
  if (error) throw new HttpError(500, error.message);
  const taken = new Set((data || []).map((row) => row.username));

  if (!taken.has(base)) return base;
  for (let n = 2; n < 10000; n++) {
    if (!taken.has(`${base}${n}`)) return `${base}${n}`; // base is <= 16 chars, so this stays <= 20
  }
  return `${base.slice(0, 11)}${Date.now().toString(36).slice(-5)}`;
}

/** Shape the Vue auth store expects: { user, profile, session }. */
function authPayload(authUser, session, profile) {
  return {
    user: { id: authUser.id, email: authUser.email },
    profile: withNames(profile, authUser),
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    },
  };
}

// POST /api/auth/signup  { email, password, firstName, lastName }
export async function signup(req, res) {
  const { email, password, firstName, lastName } = req.valid.body;
  const name = `${firstName} ${lastName}`;

  // email_confirm: true marks the email as verified, so nobody has to click a confirmation link.
  // The username is generated; if two people sign up at the same moment the unique constraint on
  // profiles.username makes the trigger fail ("Database error ..."), so we pick again and retry.
  let created;
  for (let attempt = 0; attempt < 3; attempt++) {
    const username = await pickUsername(firstName, lastName);
    created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username, first_name: firstName, last_name: lastName },
    });
    if (!created.error) break;

    const { code, message = '' } = created.error;
    if (code === 'email_exists' || /already (been )?registered/i.test(message)) {
      throw conflict('An account with this email already exists. Try signing in instead.');
    }
    if (!/database error/i.test(message)) break;
  }
  if (created.error) {
    const { message = '' } = created.error;
    if (/database error/i.test(message)) throw new HttpError(500, 'Could not create your account. Please try again.');
    throw new HttpError(created.error.status || 400, message || 'Could not create your account.');
  }

  // Sign in on a throwaway anon client so we can hand the new session to the browser.
  const signedIn = await createAnonClient().auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw new HttpError(500, 'Your account was created but we could not sign you in. Please sign in manually.');
  }
  const { user, session } = signedIn.data;
  res.status(201).json(authPayload(user, session, await getProfile(user)));
}

// POST /api/auth/login  { email, password }
export async function login(req, res) {
  const { email, password } = req.valid.body;

  const signedIn = await createAnonClient().auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    const err = signedIn.error;
    if (err?.status === 429) throw new HttpError(429, 'Too many attempts. Please wait a minute and try again.');
    if (err?.code === 'email_not_confirmed') throw unauthorized('Please confirm your email first.');
    throw unauthorized('Email or password is incorrect.');
  }
  const { user, session } = signedIn.data;
  res.json(authPayload(user, session, await getProfile(user)));
}

// GET /api/auth/me  (Authorization: Bearer <access token>)
export async function me(req, res) {
  const profile = await getProfile(req.user);
  // req.user only holds { id, email }; the sign-up metadata (first/last name) lives on the auth user.
  const { data } = await supabase.auth.admin.getUserById(req.user.id);
  res.json({ user: req.user, profile: withNames(profile, data?.user) });
}

// POST /api/auth/delete-account  { password }
export async function deleteAccount(req, res) {
  const { id, email } = req.user;
  const { password } = req.valid.body;

  // 1. Re-check the password. 403, not 401: the client signs people out on any 401, and this session is fine.
  const reauth = await createAnonClient().auth.signInWithPassword({ email, password });
  if (reauth.error || !reauth.data.session) {
    if (reauth.error?.status === 429) throw new HttpError(429, 'Too many attempts. Please wait a minute and try again.');
    throw forbidden('That password is not correct.');
  }

  // 2. Deleting the auth user cascades through the database: trips.owner_id is ON DELETE CASCADE, so an owner
  //    who leaves would wipe the trip (itinerary, memories, ...) for everyone else in it. Same rule as the
  //    trips API ("the owner cannot leave; delete the trip instead"): sort those trips out first.
  const owned = check(await supabase.from('trips').select('id, name').eq('owner_id', id));
  if (owned.length) {
    const others = check(
      await supabase.from('trip_members').select('trip_id').in('trip_id', owned.map((t) => t.id)).neq('user_id', id),
    );
    const shared = new Set(others.map((row) => row.trip_id));
    const blocking = owned.filter((t) => shared.has(t.id));
    if (blocking.length) {
      throw new HttpError(
        409,
        'You still own trips that other people are in. Delete those trips, or remove the other members, then try again.',
        { trips: blocking.map(({ id: tripId, name }) => ({ id: tripId, name })) },
      );
    }
  }

  // 3. Remember what we need for the clean-up; it is gone once the account is.
  const name = await displayName(id);
  const memberships = check(await supabase.from('trip_members').select('trip_id, role').eq('user_id', id));
  const tripIds = memberships.map((m) => m.trip_id);
  const leftTripIds = memberships.filter((m) => m.role !== 'owner').map((m) => m.trip_id);

  // 4. Delete the auth user. profiles (and, via it, their tales, memories, memberships and any trip only they
  //    were in) are removed by the database cascade; their messages stay, with the author cleared.
  const deleted = await supabase.auth.admin.deleteUser(id);
  if (deleted.error) {
    console.error('[deleteAccount] deleteUser failed:', deleted.error.message);
    throw new HttpError(500, 'We could not delete your account. Please try again.');
  }

  // 5. Best-effort tidy-up: tell the crews they left, and remove uploaded files. Neither can fail the request.
  await Promise.allSettled([
    ...leftTripIds.map((tripId) => postSystemMessage(tripId, `${name} left the crew`)),
    removeUserFiles(id, tripIds),
  ]);

  res.json({ deleted: true });
}

// Avatars: no animated GIFs (they cannot be paused, which is an accessibility problem next to every name).
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Delete an old avatar file, but only if it is one of ours and sits in this user's own avatar folder. */
async function removeOldAvatar(url, userId) {
  const path = pathFromPublicUrl(url);
  if (path && path.startsWith(`avatars/${userId}/`)) await removeFile(path);
}

// PUT /api/auth/me/avatar  (multipart, field "image") -> { avatar_url }
export async function setAvatar(req, res) {
  if (!req.file) throw badRequest('Attach a photo in the "image" field');
  const type = sniffImageType(req.file.buffer);
  if (!AVATAR_TYPES.includes(type)) throw badRequest('That file is not a JPG, PNG or WebP image.');

  const previous = (await getProfile(req.user)).avatar_url; // also makes sure the profiles row exists
  // The server picks the URL (avatars/<userId>/<uuid>.<ext>); the client can never point it somewhere else.
  const { url, path } = await uploadImage({ buffer: req.file.buffer, mimetype: type }, { folder: 'avatars', userId: req.user.id });

  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', req.user.id);
  if (error) {
    await removeFile(path); // do not leave an orphan behind
    throw new HttpError(500, 'We could not save your photo. Please try again.');
  }
  await removeOldAvatar(previous, req.user.id);
  res.json({ avatar_url: url });
}

// DELETE /api/auth/me/avatar -> { avatar_url: null }
export async function removeAvatar(req, res) {
  const previous = (await getProfile(req.user)).avatar_url;
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', req.user.id);
  if (error) throw new HttpError(500, 'We could not remove your photo. Please try again.');
  await removeOldAvatar(previous, req.user.id);
  res.json({ avatar_url: null });
}

