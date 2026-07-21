-- Family passport: countries each family member has visited.
-- Public read (not sensitive); family members can edit. Members are their own
-- list, not tied to logins, so kids/grandparents can be tracked too.
-- Run in the Supabase SQL editor.

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.country_visits (
  member_id uuid not null references public.family_members (id) on delete cascade,
  country_code text not null,
  created_at timestamptz not null default now(),
  primary key (member_id, country_code)
);

alter table public.family_members enable row level security;
alter table public.country_visits enable row level security;

drop policy if exists "Anyone reads members" on public.family_members;
create policy "Anyone reads members"
  on public.family_members for select using (true);

drop policy if exists "Family writes members" on public.family_members;
create policy "Family writes members"
  on public.family_members for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());

drop policy if exists "Anyone reads visits" on public.country_visits;
create policy "Anyone reads visits"
  on public.country_visits for select using (true);

drop policy if exists "Family writes visits" on public.country_visits;
create policy "Family writes visits"
  on public.country_visits for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());
