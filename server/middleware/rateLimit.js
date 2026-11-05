import { config } from "../config.js";
import { HttpError } from "../utils/httpError.js";

export function rateLimit({
  windowMs,
  max,
  message = "Too many requests. Please wait a bit and try again.",
}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    if (config.env === "test" || process.env.AUTH_RATE_LIMIT === "off")
      return next();

    const now = Date.now();
    const key = req.ip || "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, message));
    }
    next();
  };
}
