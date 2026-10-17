import axios from 'axios';
import { supabase } from './supabase';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });

// Attach the Supabase access token to every request.
api.interceptors.request.use(async (config) => {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return config;
});

// If the API rejects a token we sent (expired / revoked), drop the dead local session. The auth
// store listens for Supabase's SIGNED_OUT event, so the UI signs out and the router guard sends the
// person to /sign-in instead of leaving them "logged in" on a session that no longer works.
api.interceptors.response.use(
  (response) => response,
  async (err) => {
    const hadToken = Boolean(err?.config?.headers?.Authorization);
    const isCredentialCall = /^\/auth\/(login|signup)/.test(err?.config?.url || '');
    if (supabase && err?.response?.status === 401 && hadToken && !isCredentialCall) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    return Promise.reject(err);
  },
);

/** Turn any axios error into a short, human message for the UI. */
export function errorMessage(err, fallback = 'Something went wrong. Try again.') {
  if (err?.userMessage) return err.userMessage; // errors we threw ourselves (e.g. session could not be saved)
  if (err?.code === 'ECONNABORTED') return 'The server took too long. If it is on Render free tier, wait ~30s and retry.';
  if (!err?.response) return 'Cannot reach the JBound server. Is it running?';
  return err.response.data?.error || fallback;
}

/** Upload one image file for posts/avatars. Returns the public URL. */
export async function uploadImage(file, folder = 'posts') {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post(`/uploads?folder=${folder}`, form);
  return data.url;
}

/** Photo URLs from the API may be relative ("/api/places/google/photo?..."); make them absolute. */
export const assetUrl = (url) => (url && url.startsWith('/api/') ? `${API_URL}${url}` : url);
