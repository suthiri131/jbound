-- Tales about a place that isn't in our places table keep its typed-in name here.
-- Some databases already have this column, so this only adds it where it's missing.
alter table public.posts
  add column if not exists custom_place_name text;

notify pgrst, 'reload schema';
