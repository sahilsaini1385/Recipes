-- US states each family member has visited (companion to country_visits).
-- Public read, family write. Run in the Supabase SQL editor.

create table if not exists public.state_visits (
  member_id uuid not null references public.family_members (id) on delete cascade,
  state_code text not null,
  created_at timestamptz not null default now(),
  primary key (member_id, state_code)
);

alter table public.state_visits enable row level security;

drop policy if exists "Anyone reads state visits" on public.state_visits;
create policy "Anyone reads state visits"
  on public.state_visits for select using (true);

drop policy if exists "Family writes state visits" on public.state_visits;
create policy "Family writes state visits"
  on public.state_visits for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());
