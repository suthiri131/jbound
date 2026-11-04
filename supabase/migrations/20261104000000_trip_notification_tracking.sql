-- Tracks whether the "trip complete" and "3 days left in the memory box" reminders
-- have already been posted for a trip, so the daily cron job doesn't repeat them.
alter table public.trips
  add column if not exists completed_notified_at timestamptz,
  add column if not exists memory_reminder_notified_at timestamptz;
