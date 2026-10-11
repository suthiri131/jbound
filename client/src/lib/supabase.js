import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


export const hasSupabase = Boolean(url && anonKey && !url.includes('YOUR-PROJECT'));


export const supabase = hasSupabase
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
