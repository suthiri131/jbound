import { createAnonClient, supabase } from '../db/supabase.js';
import { HttpError, conflict, unauthorized } from '../utils/httpError.js';

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

/** Shape the Vue auth store expects: { user, profile, session }. */
function authPayload(authUser, session, profile) {
  return {
    user: { id: authUser.id, email: authUser.email },
    profile,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    },
  };
}

// POST /api/auth/signup  { email, password, name, username }
export async function signup(req, res) {
  const { email, password, name, username } = req.valid.body;

  // Friendly check first; the unique constraint on profiles.username still guards against races.
  const taken = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken.error) throw new HttpError(500, taken.error.message);
  if (taken.data) throw conflict('That username is taken. Try another one.');

  // email_confirm: true marks the email as verified, so nobody has to click a confirmation link.
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, username },
  });
  if (created.error) {
    const { code, message = '' } = created.error;
    if (code === 'email_exists' || /already (been )?registered/i.test(message)) {
      throw conflict('An account with this email already exists. Try signing in instead.');
    }
    // the profiles trigger failed on the unique username (two people signing up at the same moment)
    if (/database error/i.test(message)) throw conflict('That username is taken. Try another one.');
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
  res.json({ user: req.user, profile: await getProfile(req.user) });
}
