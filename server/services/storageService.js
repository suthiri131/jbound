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

/** Real image type from the file's first bytes. The mimetype a browser sends can say anything. */
export function sniffImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('latin1', 0, 6))) return 'image/gif';
  return null;
}

/** Public URL -> path inside our bucket, or null when the URL is not one of ours. */
export function pathFromPublicUrl(url) {
  if (typeof url !== 'string') return null;
  const marker = `/object/public/${config.supabase.bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  try {
    return decodeURIComponent(url.slice(at + marker.length).split('?')[0]) || null;
  } catch {
    return null;
  }
}

/** Best-effort delete of one stored file. Never throws; a leftover file is only logged. */
export async function removeFile(path) {
  try {
    const { error } = await supabase.storage.from(config.supabase.bucket).remove([path]);
    if (error) throw error;
  } catch (err) {
    console.warn(`[storage] could not remove ${path}:`, err.message);
  }
}

