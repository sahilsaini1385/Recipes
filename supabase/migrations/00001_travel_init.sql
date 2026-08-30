-- Waypoint (travel-article → itinerary) — initial schema.
-- Run via `supabase db push` or paste into the Supabase SQL editor.
--
-- Everything here is idempotent, so it is safe to run in a fresh Supabase
-- project OR in the same project that already hosts the family recipes app
-- (in that case the allowlist and is_family() already exist and are reused
-- unchanged).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Allowlist of editor email addresses. No client-facing policies: only the
-- service role (dashboard / SQL editor) can read or edit it. The is_family()
-- function below is SECURITY DEFINER so RLS checks can consult it.
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- Seed the owner. Add more editors with:
--   insert into allowed_emails (email) values ('name@example.com');
insert into public.allowed_emails (email)
values ('ss3694@cornell.edu')
on conflict (email) do nothing;

create or replace function public.is_family()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.email(), ''))
  );
$$;

grant execute on function public.is_family() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Itineraries. Anyone with the link can read (slugs are unguessable);
-- only allowlisted, signed-in users can create/modify/delete.
-- ---------------------------------------------------------------------------
create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  destination text not null default '',
  source_url text,
  data jsonb not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.itineraries enable row level security;

drop policy if exists "itineraries are readable by everyone" on public.itineraries;
create policy "itineraries are readable by everyone"
  on public.itineraries for select
  using (true);

drop policy if exists "allowlisted users insert itineraries" on public.itineraries;
create policy "allowlisted users insert itineraries"
  on public.itineraries for insert
  with check (public.is_family());

drop policy if exists "allowlisted users update itineraries" on public.itineraries;
create policy "allowlisted users update itineraries"
  on public.itineraries for update
  using (public.is_family())
  with check (public.is_family());

drop policy if exists "allowlisted users delete itineraries" on public.itineraries;
create policy "allowlisted users delete itineraries"
  on public.itineraries for delete
  using (public.is_family());
