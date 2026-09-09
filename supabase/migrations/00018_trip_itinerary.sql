-- Itinerary: what happens, or happened, on each day of a trip.
--
-- The same rows serve both halves of a trip's life. Before it, they are the
-- plan; after it, they are the diary — which is the point. Keeping planning
-- and remembering in one record is the difference between this and owning a
-- planning app plus a journal app that never reference each other.
--
-- Deliberately not a calendar. No reminders, no invitations, no attendees.
-- A day, an optional time, and a line about what happens.
--
-- Safe to run more than once.

create table if not exists public.trip_days (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references public.trips (id) on delete cascade,
  -- The calendar day this entry belongs to. Required, unlike a trip's own
  -- dates: an entry with no day cannot be placed in a day-by-day list, and
  -- the trip's blurb is the right home for something that floats.
  day      date not null,
  -- Free text, not a time column. "morning", "after nap" and "9:30" are all
  -- things people write, and only one of them parses. Sorting uses `position`
  -- below, so nothing depends on reading this.
  at       text,
  title    text not null,
  note     text,
  -- Optional link to somewhere already recorded, so an itinerary entry and
  -- the restaurant it points at do not drift apart. Set null rather than
  -- cascade: removing a place should not silently delete the plan that
  -- mentioned it.
  place_id uuid references public.trip_places (id) on delete set null,
  -- Order within a day, for the entries whose `at` does not sort itself.
  position    integer not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trip_days_trip_day_idx
  on public.trip_days (trip_id, day, position);

drop trigger if exists trip_days_set_updated_at on public.trip_days;
create trigger trip_days_set_updated_at
  before update on public.trip_days
  for each row execute function public.set_updated_at();

alter table public.trip_days enable row level security;

-- Reads mirror trips and places: the public link sees live rows, family can
-- also see soft-deleted ones so a mis-tap stays recoverable.
drop policy if exists "Anyone reads trip days" on public.trip_days;
create policy "Anyone reads trip days"
  on public.trip_days for select using (deleted_at is null);

drop policy if exists "Family reads deleted trip days" on public.trip_days;
create policy "Family reads deleted trip days"
  on public.trip_days for select
  to authenticated
  using (public.is_family());

drop policy if exists "Family writes trip days" on public.trip_days;
create policy "Family writes trip days"
  on public.trip_days for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());
