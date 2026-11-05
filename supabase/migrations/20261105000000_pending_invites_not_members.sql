-- Someone who has only been invited isn't on the trip yet: until they accept, they can't read its
-- chat, itinerary, expenses or memories, whether directly or through Realtime.
create or replace function public.is_trip_member(tid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = tid and user_id = auth.uid() and status = 'accepted'
  );
$$;
