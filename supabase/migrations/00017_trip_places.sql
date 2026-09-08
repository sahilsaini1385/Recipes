-- Places: the restaurants, hotels and sights a trip was actually made of.
--
-- The one live trip in the table already records these by hand, in its blurb:
-- "Rickie's Passover lamb dinner", "Jack hanging out on the pool table". That
-- is the feature asking to exist. Structured, the same information answers a
-- question free text cannot -- "where did we eat in Lisbon" -- across every
-- trip at once, years later.
--
-- Additive, like the rest of Theme 1. Nothing here feeds the passport counts;
-- the Google Sheet remains their source of truth.
--
-- Safe to run more than once.

create table if not exists public.trip_places (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  name         text not null,
  -- City is the axis people actually search on, and it is deliberately free
  -- text rather than a lookup: "Lisbon", "Hill Country" and "somewhere near
  -- Fredericksburg" are all answers somebody will want to type.
  city         text,
  -- Same vocabulary as the passport and trip_destinations so the three can be
  -- read together. Optional: a place remembered without a country is still
  -- worth keeping.
  country_code text,
  kind         text not null default 'restaurant'
    check (kind in ('restaurant', 'cafe', 'bar', 'hotel', 'sight', 'shop', 'other')),
  note         text,
  -- Three states on purpose. NULL means nobody said, which is not the same as
  -- "no" -- and defaulting an unanswered question to "no" would quietly libel
  -- every restaurant added in a hurry.
  would_return boolean,
  url          text,
  -- Soft delete, like trips. This is an archive.
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists trip_places_trip_idx
  on public.trip_places (trip_id);
-- The cross-trip browser searches on city; lower() so it is case-insensitive
-- without the query having to care.
create index if not exists trip_places_city_idx
  on public.trip_places (lower(city));

drop trigger if exists trip_places_set_updated_at on public.trip_places;
create trigger trip_places_set_updated_at
  before update on public.trip_places
  for each row execute function public.set_updated_at();

alter table public.trip_places enable row level security;

-- Reads mirror trips exactly: the public link sees live rows, family can also
-- see soft-deleted ones so a mis-tap stays recoverable without leaking.
drop policy if exists "Anyone reads trip places" on public.trip_places;
create policy "Anyone reads trip places"
  on public.trip_places for select using (deleted_at is null);

drop policy if exists "Family reads deleted trip places" on public.trip_places;
create policy "Family reads deleted trip places"
  on public.trip_places for select
  to authenticated
  using (public.is_family());

drop policy if exists "Family writes trip places" on public.trip_places;
create policy "Family writes trip places"
  on public.trip_places for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());
