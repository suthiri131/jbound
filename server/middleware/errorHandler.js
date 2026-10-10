import { config } from '../config.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Multer file errors
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && config.env === 'production' ? 'Something went wrong' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
