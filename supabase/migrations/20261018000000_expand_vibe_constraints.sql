-- Keep database constraints aligned with the client and server vibe options.
begin;

alter table public.itinerary_items
  drop constraint itinerary_items_vibe_check,
  add constraint itinerary_items_vibe_check
    check (vibe in ('eating', 'activities', 'culture', 'adventure', 'cozy', 'peaceful', 'chaotic'));

alter table public.posts
  drop constraint posts_vibe_check,
  add constraint posts_vibe_check
    check (vibe in ('eating', 'activities', 'culture', 'adventure', 'cozy', 'peaceful', 'chaotic'));

alter table public.places
  drop constraint places_vibes_check,
  add constraint places_vibes_check
    check (vibes <@ array['eating', 'activities', 'culture', 'adventure', 'cozy', 'peaceful', 'chaotic']);

commit;
