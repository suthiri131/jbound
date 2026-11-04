import { supabase } from '../db/supabase.js';
import { postSystemMessage } from './systemMessages.js';
import { tripPhase, sgToday } from './logic/memoryWindow.js';

const TRIP_FIELDS = 'id, name, start_date, end_date, archived_at, completed_notified_at, memory_reminder_notified_at';

/**
 * Checks every non-archived trip and posts the "trip complete" and
 * "3 days left to add memories" system messages when they first become due.
 * Meant to be called once a day by Vercel Cron — see server/vercel.json.
 */
export async function runNotificationScheduler(today = sgToday()) {
  const { data: trips, error } = await supabase.from('trips').select(TRIP_FIELDS).is('archived_at', null);
  if (error) throw new Error(error.message);

  let completedNotified = 0;
  let reminderNotified = 0;

  for (const trip of trips) {
    const info = tripPhase(trip, today);
    if (info.phase !== 'memory_box') continue;

    if (!trip.completed_notified_at) {
      await postSystemMessage(trip.id, `"${trip.name}" is done — add your photos before the memory box closes!`);
      await supabase.from('trips').update({ completed_notified_at: new Date().toISOString() }).eq('id', trip.id);
      completedNotified += 1;
    }

    if (info.daysLeft === 3 && !trip.memory_reminder_notified_at) {
      await postSystemMessage(trip.id, `3 days left to add photos to "${trip.name}" before the memory box closes.`);
      await supabase.from('trips').update({ memory_reminder_notified_at: new Date().toISOString() }).eq('id', trip.id);
      reminderNotified += 1;
    }
  }

  return { tripsChecked: trips.length, completedNotified, reminderNotified };
}
