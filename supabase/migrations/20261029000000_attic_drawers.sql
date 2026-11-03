-- The Archives attic has 7 drawers per user (4 in the mahogany dresser, 3 in the map chest).
-- Each member files an archived trip into one of their own drawers; clearing it out only
-- removes it from that member's attic, the trip stays intact for the rest of the crew.
alter table public.trip_members
  add column if not exists attic_slot       smallint check (attic_slot between 0 and 6),
  add column if not exists attic_cleared_at timestamptz;

create unique index if not exists trip_members_attic_slot_idx
  on public.trip_members (user_id, attic_slot)
  where attic_slot is not null;
