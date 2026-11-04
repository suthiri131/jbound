import { Router } from 'express';
import * as c from '../controllers/internalController.js';
import { config } from '../config.js';
import { unauthorized } from '../utils/httpError.js';

const router = Router();

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set. */
function requireCronSecret(req, _res, next) {
  if (!config.cronSecret) return next(unauthorized('CRON_SECRET not configured'));
  if (req.headers.authorization !== `Bearer ${config.cronSecret}`) return next(unauthorized());
  next();
}

router.get('/notify-reminders', requireCronSecret, c.notifyReminders);

export default router;
