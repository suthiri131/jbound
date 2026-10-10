import { badRequest } from '../utils/httpError.js';

/**
 * Validate req.body / req.query / req.params with a zod schema.
 * Parsed (coerced, defaulted) values replace the raw ones on req.valid.
 *   router.post('/', validate({ body: schema }), handler)
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid || {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest(`Invalid ${part}`, issues));
    }
    req.valid[part] = result.data;
  }
  next();
};
