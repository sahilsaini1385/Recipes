-- Trips: the missing middle of the archive.
--
-- The passport records WHERE the family has been, as a flat list of codes.
-- The tree records WHO. Nothing recorded WHEN, WITH WHOM, or WHAT HAPPENED,
-- which is the part anyone would actually want to read in twenty years.
--
-- Additive on purpose. A trip may name the same country codes the passport
-- holds, but the Google Sheet stays the source of truth for the counts and
-- `passport-sync` is untouched by any of this. Nothing here feeds back.
--
-- Public read, family write, matching the rest of the site.
-- Safe to run more than once.

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  -- Both dates optional: half the value of this table is recording a trip
  -- somebody half-remembers, and refusing the row until they pin down a date
  -- is how you end up with an empty table.
  start_date  date,
  end_date    date,
  blurb       text,
  -- Soft delete. This is an archive; a mis-tap should never destroy a record.
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint trips_dates_ordered
    check (start_date is null or end_date is null or end_date >= start_date)
);

-- Who went. References family_members (the passport's list of people, which
-- includes children and grandparents) rather than tree_members or auth users.
create table if not exists public.trip_travellers (
  trip_id   uuid not null references public.trips (id) on delete cascade,
  member_id uuid not null references public.family_members (id) on delete cascade,
  primary key (trip_id, member_id)
);

-- Which countries and US states the trip touched. Same code vocabulary as the
-- passport so the two can be read side by side, but stored separately and
-- never merged into the counts.
create table if not exists public.trip_destinations (
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind    text not null check (kind in ('country', 'state')),
  code    text not null,
  primary key (trip_id, kind, code)
);

create index if not exists trips_start_date_idx
  on public.trips (start_date desc nulls last);
create index if not exists trip_travellers_member_idx
  on public.trip_travellers (member_id);
create index if not exists trip_destinations_code_idx
  on public.trip_destinations (kind, code);

-- Keep updated_at honest.
drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.trips             enable row level security;
alter table public.trip_travellers   enable row level security;
alter table public.trip_destinations enable row level security;

-- Reads. Anyone may read a live trip; only family may see soft-deleted ones,
-- which is what makes a delete recoverable without leaking it to the public
-- link in the meantime.
drop policy if exists "Anyone reads trips" on public.trips;
create policy "Anyone reads trips"
  on public.trips for select using (deleted_at is null);

drop policy if exists "Family reads deleted trips" on public.trips;
create policy "Family reads deleted trips"
  on public.trips for select
  to authenticated
  using (public.is_family());

drop policy if exists "Anyone reads trip travellers" on public.trip_travellers;
create policy "Anyone reads trip travellers"
  on public.trip_travellers for select using (true);

drop policy if exists "Anyone reads trip destinations" on public.trip_destinations;
create policy "Anyone reads trip destinations"
  on public.trip_destinations for select using (true);

-- Writes. Family only, same gate as everything else on the site.
drop policy if exists "Family writes trips" on public.trips;
create policy "Family writes trips"
  on public.trips for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());

drop policy if exists "Family writes trip travellers" on public.trip_travellers;
create policy "Family writes trip travellers"
  on public.trip_travellers for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());

drop policy if exists "Family writes trip destinations" on public.trip_destinations;
create policy "Family writes trip destinations"
  on public.trip_destinations for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());
