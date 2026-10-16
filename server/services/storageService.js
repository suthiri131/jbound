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
