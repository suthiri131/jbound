import multer from 'multer';
import { HttpError, badRequest } from '../utils/httpError.js';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB; the browser shrinks photos long before this

const single = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }).single('image');

/**
 * Reads one multipart file from the "image" field into req.file. Turns multer's errors into friendly ones.
 * The real file type is checked in the controller from the file's bytes, not from the mimetype sent here.
 */
export function avatarUpload(req, res, next) {
  single(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, `That photo is too large. Photos must be ${MAX_AVATAR_BYTES / 1024 / 1024} MB or smaller.`));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return next(badRequest('Attach the photo in the "image" field'));
    next(err);
  });
}
