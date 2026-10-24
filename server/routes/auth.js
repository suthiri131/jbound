import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as c from '../controllers/authController.js';
import { signupBody, loginBody, deleteAccountBody } from './schemas.js';

const FIFTEEN_MIN = 15 * 60 * 1000;
const signupLimiter = rateLimit({ windowMs: FIFTEEN_MIN, max: 15, message: 'Too many sign-up attempts. Please wait a few minutes and try again.' });
const loginLimiter = rateLimit({ windowMs: FIFTEEN_MIN, max: 30, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' });
// the password is re-checked on delete, so it needs the same brute-force protection as sign-in
const deleteLimiter = rateLimit({ windowMs: FIFTEEN_MIN, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' });

const r = Router();
r.post('/signup', signupLimiter, validate({ body: signupBody }), c.signup);
r.post('/login', loginLimiter, validate({ body: loginBody }), c.login);
r.get('/me', requireAuth, c.me);
r.post('/delete-account', requireAuth, deleteLimiter, validate({ body: deleteAccountBody }), c.deleteAccount);

export default r;
