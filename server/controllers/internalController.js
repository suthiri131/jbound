import { runNotificationScheduler } from '../services/notificationScheduler.js';

export async function notifyReminders(_req, res) {
  const result = await runNotificationScheduler();
  res.json({ ok: true, ...result });
}
