import { randomUUID } from 'node:crypto';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);

/** Uploads an in-memory file (from multer) to Supabase Storage and returns its public URL. */
export async function uploadImage({ buffer, mimetype }, { folder, userId }) {
  const path = `${folder}/${userId}/${randomUUID()}.${EXT[mimetype] || 'bin'}`;
  const { error } = await supabase.storage
    .from(config.supabase.bucket)
    .upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new HttpError(500, `Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(config.supabase.bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/**
 * Best-effort: delete the files a person uploaded (tale photos, avatars, memory photos), used when they
 * delete their account. Files live at `<folder>/<userId>/...` and `memories/<tripId>/<userId>/...`.
 * `places/` is skipped on purpose: places are shared and may still be showing those photos.
 * Never throws (the account is already gone); anything we could not remove is only logged.
 * Lists at most 1000 files per folder.
 */
export async function removeUserFiles(userId, tripIds = []) {
  const bucket = supabase.storage.from(config.supabase.bucket);
  const prefixes = ['posts', 'avatars', 'memories', ...tripIds.map((id) => `memories/${id}`)].map((p) => `${p}/${userId}`);
  for (const prefix of prefixes) {
    try {
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      if (error) throw error;
      const files = (data || []).filter((entry) => entry.id).map((entry) => `${prefix}/${entry.name}`); // no id = sub-folder
      if (!files.length) continue;
      const removed = await bucket.remove(files);
      if (removed.error) throw removed.error;
    } catch (err) {
      console.warn(`[deleteAccount] could not clean up ${prefix}:`, err.message);
    }
  }
}
