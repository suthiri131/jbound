-- run in Supabase SQL editor

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- PROFILES (1:1 with auth.users, created automatically on sign-up)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  name        text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- PLACES (Explorer)
-- -------------------------------------------------------------
create table if not exists public.places (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  address      text,
  lat          double precision not null,
  lng          double precision not null,
  vibes        text[] not null default '{}'
               check (vibes <@ array['eating','activities','culture','adventure']),
  price_level  smallint check (price_level between 1 and 4),
  photos       text[] not null default '{}',
  source       text not null default 'curated' check (source in ('curated','community','google')),
  google_place_id text unique,               -- set when imported from Google Places
  rating       numeric(2,1),                 -- Google rating at import time
  rating_count integer,
  maps_url     text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists places_vibes_idx on public.places using gin (vibes);

-- -------------------------------------------------------------
-- TALES (community feed)
-- -------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  place_id    uuid references public.places (id) on delete set null,
  vibe        text check (vibe in ('eating','activities','culture','adventure')),
  caption     text not null check (char_length(caption) between 1 and 2000),
  images      text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_place_idx   on public.posts (place_id);

create table if not exists public.post_likes (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- -------------------------------------------------------------
-- TRIPS (Planner) + MEMBERS + ITINERARY
-- Phase is derived from dates (see services/logic/memoryWindow.js):
--   planning → on_the_road → memory_box (7 days after end_date) → archived
-- -------------------------------------------------------------
create table if not exists public.trips (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  mission      text check (char_length(mission) <= 160),
  cover_color  text not null default '#2E5A3C',
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  start_date   date,
  end_date     date,
  invite_code  text not null unique default substr(md5(gen_random_uuid()::text), 1, 8),
  archived_at  timestamptz,          -- set when the trip moves into the Archives
  created_at   timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.trip_members (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members (user_id);

create table if not exists public.itinerary_items (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  place_id       uuid references public.places (id) on delete set null,
  title          text not null,
  day            date,
  time           time,
  position       integer not null default 0,
  notes          text,
  vibe           text check (vibe in ('eating','activities','culture','adventure')),
  dwell_minutes  integer check (dwell_minutes between 0 and 1440), -- override for the feasibility check
  lat            double precision,   -- for manual stops/crossings without a place
  lng            double precision,
  crossing       text check (crossing in ('woodlands','tuas')),       -- this stop is a border crossing
  crossing_dir   text check (crossing_dir in ('to_jb','to_sg')),
  done           boolean not null default false,                      -- ticked off the bucket list
  done_at        timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists itinerary_trip_idx on public.itinerary_items (trip_id, day, position);

-- -------------------------------------------------------------
-- CAMP CHAT
-- -------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  kind        text not null default 'user' check (kind in ('user','system')),
  text        text not null check (char_length(text) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_trip_idx on public.messages (trip_id, created_at);

-- -------------------------------------------------------------
-- LEDGER (expenses)
-- -------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  paid_by      uuid not null references public.profiles (id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null check (currency in ('SGD','MYR')),
  description  text not null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_trip_idx on public.expenses (trip_id, created_at);

create table if not exists public.expense_splits (
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  primary key (expense_id, user_id)
);

create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  from_user    uuid not null references public.profiles (id) on delete cascade,
  to_user      uuid not null references public.profiles (id) on delete cascade,
  amount_sgd   numeric(12,2) not null check (amount_sgd > 0),
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------
-- MEMORY BOX + ARCHIVES
-- -------------------------------------------------------------
create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  image_url   text,                 -- null only for seeded placeholders
  caption     text check (char_length(caption) <= 200),
  item_id     uuid references public.itinerary_items (id) on delete set null, -- the stop it's tagged to
  created_at  timestamptz not null default now()
);
create index if not exists memories_trip_idx on public.memories (trip_id, created_at);

-- Stickers each user puts on their own drawer in the attic (max 4 per drawer)
create table if not exists public.drawer_stickers (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  trip_id  uuid not null references public.trips (id) on delete cascade,
  slot     smallint not null check (slot between 0 and 3),
  kind     text not null check (kind in ('star','sun','palm','chili','heart','car','bowl','compass')),
  primary key (user_id, trip_id, slot)
);

-- -------------------------------------------------------------
-- WATCHER (checkpoint snapshots log)
-- -------------------------------------------------------------
create table if not exists public.congestion_snapshots (
  id               uuid primary key default gen_random_uuid(),
  checkpoint_id    text not null check (checkpoint_id in ('woodlands','tuas')),
  captured_at      timestamptz not null default now(),
  image_url        text,
  estimated_level  text check (estimated_level in ('Low','Medium','High'))
);
create index if not exists snapshots_cp_idx on public.congestion_snapshots (checkpoint_id, captured_at desc);

-- =============================================================
-- ROW LEVEL SECURITY
-- Express uses the SERVICE ROLE key (bypasses RLS) and checks
-- permissions itself. RLS still limits what the ANON key (used by
-- the Vue client for Auth + Realtime) can read.
-- =============================================================
alter table public.profiles             enable row level security;
alter table public.places               enable row level security;
alter table public.posts                enable row level security;
alter table public.post_likes           enable row level security;
alter table public.post_comments        enable row level security;
alter table public.trips                enable row level security;
alter table public.trip_members         enable row level security;
alter table public.itinerary_items      enable row level security;
alter table public.messages             enable row level security;
alter table public.expenses             enable row level security;
alter table public.expense_splits       enable row level security;
alter table public.settlements          enable row level security;
alter table public.memories             enable row level security;
alter table public.drawer_stickers      enable row level security;
alter table public.congestion_snapshots enable row level security;

create or replace function public.is_trip_member(tid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.trip_members where trip_id = tid and user_id = auth.uid());
$$;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);

drop policy if exists "messages read by members" on public.messages;
create policy "messages read by members" on public.messages
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "itinerary read by members" on public.itinerary_items;
create policy "itinerary read by members" on public.itinerary_items
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "expenses read by members" on public.expenses;
create policy "expenses read by members" on public.expenses
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "memories read by members" on public.memories;
create policy "memories read by members" on public.memories
  for select to authenticated using (public.is_trip_member(trip_id));

-- =============================================================
-- REALTIME (client subscribes to these for live updates)
-- =============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.messages;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.itinerary_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.expenses;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.memories;        exception when duplicate_object then null; end;
end $$;

-- =============================================================
-- STORAGE: public bucket for tale photos, memories and avatars
-- =============================================================
insert into storage.buckets (id, name, public)
values ('jbound-images', 'jbound-images', true)
on conflict (id) do nothing;
