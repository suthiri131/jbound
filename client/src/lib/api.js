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

/** Turn any axios error into a short, human message for the UI. */
export function errorMessage(err, fallback = 'Something went wrong. Try again.') {
    console.error('Actual error:', err);

    if (err?.code === 'ECONNABORTED') {
        return 'The server took too long. Try again.';
    }

    if (axios.isAxiosError(err)) {
        if (!err.response) {
            return 'Cannot reach the JBound server. Is it running?';
        }

        return err.response.data?.error || fallback;
    }

    return err?.message || fallback;
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
