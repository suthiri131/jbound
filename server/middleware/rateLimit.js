import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Tiny in-memory rate limiter (fixed window, per client IP). No extra dependency, so the
 * lockfiles and the Render `--frozen-lockfile` install are unaffected.
 *
 * It lives in this server process's memory, which is fine for a single Render instance.
 * Skipped when NODE_ENV=test, or when AUTH_RATE_LIMIT=off (handy for load/E2E runs).
 */
export function rateLimit({ windowMs, max, message = 'Too many requests. Please wait a bit and try again.' }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // drop expired entries so the map cannot grow forever; unref() so it never keeps the process alive
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    if (config.env === 'test' || process.env.AUTH_RATE_LIMIT === 'off') return next();

    const now = Date.now();
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, message));
    }
    next();
  };
}
