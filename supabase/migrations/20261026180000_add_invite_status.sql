alter table public.trip_members
 add column status text not null default 'accepted'
  check (status in ('pending', 'accepted'));