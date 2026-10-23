-- Vibes belong to places and posts; custom itinerary stops no longer have a vibe.
-- Deploy the updated API before applying this migration.
alter table public.itinerary_items drop column if exists vibe;
