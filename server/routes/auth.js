import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as c from '../controllers/authController.js';
import { signupBody, loginBody } from './schemas.js';

const r = Router();
r.post('/signup', validate({ body: signupBody }), c.signup);
r.post('/login', validate({ body: loginBody }), c.login);
r.get('/me', requireAuth, c.me);

export default r;
