/** Helpers for choosing a profile photo in the browser. */

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // must match the API (middleware/avatarUpload.js)
export const AVATAR_PIXELS = 512;
const SOURCE_MAX_BYTES = 25 * 1024 * 1024; // do not even try to decode something enormous

/** An Error whose message is safe to show as-is (errorMessage() in lib/api.js prefers userMessage). */
const problem = (message) => Object.assign(new Error(message), { userMessage: message });

/** Largest centred square inside a width x height image: where to start cutting and how long each side is. */
export function squareCrop(width, height) {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

/** Throws a friendly error if the chosen file is not something we can use. */
export function checkAvatarFile(file) {
  const looksLikeHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
  if (looksLikeHeic) throw problem('HEIC photos are not supported yet. Please choose a JPG, PNG or WebP photo.');
  if (!AVATAR_TYPES.includes(file.type)) throw problem('Please choose a JPG, PNG or WebP photo.');
  if (file.size > SOURCE_MAX_BYTES) throw problem('That photo is too large. Please choose one under 25 MB.');
}

async function decode(file) {
  // createImageBitmap applies the photo's rotation (EXIF) in current browsers
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Centre-crops the photo to a square, shrinks it to at most 512x512 and re-saves it as a JPEG.
 * Re-drawing it on a canvas also drops hidden metadata such as the GPS location the photo was taken at.
 * If the browser cannot do that, the original is returned as long as it fits the upload limit
 * (the server checks the file again either way).
 */
export async function prepareAvatar(file) {
  checkAvatarFile(file);
  try {
    const bitmap = await decode(file);
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    const size = Math.min(AVATAR_PIXELS, side); // never scale a small photo up
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG has no transparency
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('The canvas gave no image');
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  } catch {
    if (file.size > AVATAR_MAX_BYTES) throw problem('We could not read that photo, and it is over 5 MB. Please choose a smaller one.');
    return file;
  }
}
