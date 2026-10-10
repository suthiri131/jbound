export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Not signed in') => new HttpError(401, msg);
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

/** Throw a 500 (or mapped status) if a Supabase call returned an error. */
export function check({ data, error }, notFoundMsg) {
  if (error) {
    // PostgREST: no rows for .single()
    if (error.code === 'PGRST116') throw notFound(notFoundMsg);
    // Unique violation
    if (error.code === '23505') throw conflict(error.details || 'Already exists');
    // FK violation
    if (error.code === '23503') throw badRequest('Referenced record does not exist');
    throw new HttpError(500, error.message);
  }
  return data;
}
