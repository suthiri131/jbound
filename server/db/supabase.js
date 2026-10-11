import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const serverOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * Admin client — uses the SERVICE ROLE key, bypasses RLS.
 * Every controller must do its own permission checks (see middleware/tripAccess.js).
 */
export const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, serverOptions);

/**
 * Fresh anon client per call. Used for password sign-in so that one user's
 * session is never stored on a client shared between requests.
 */
export function createAnonClient() {
  return createClient(config.supabase.url, config.supabase.anonKey, serverOptions);
}
