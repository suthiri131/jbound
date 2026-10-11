-- Run this ONLY if you created the database before Google Places was added.
-- (A fresh schema.sql already includes these columns.)
alter table public.places drop constraint if exists places_source_check;
alter table public.places add constraint places_source_check check (source in ('curated','community','google'));
alter table public.places add column if not exists google_place_id text unique;
alter table public.places add column if not exists rating numeric(2,1);
alter table public.places add column if not exists rating_count integer;
alter table public.places add column if not exists maps_url text;
