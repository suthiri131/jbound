-- -------------------------------------------------------------
-- REMOVE USERNAMES
-- People are identified by their name (and friends join a trip with its invite code), so profiles no
-- longer store a username, and the sign-up trigger no longer invents one ("user_xxxxxxxx").
-- -------------------------------------------------------------

-- 1. Stop the sign-up trigger from writing a username. This must come first: the old version of the
--    function still names the column.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- 2. Drop the column. This also drops its UNIQUE constraint and its format CHECK, and deletes the stored values.
alter table public.profiles drop column if exists username;
