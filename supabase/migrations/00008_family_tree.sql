-- Family tree. One row per person; a couple shares a card via spouse_name,
-- and children point at their parent's row, so adding a branch is just
-- adding a child. Public read, family write.
-- Run in the Supabase SQL editor (safe to run more than once).

create table if not exists public.tree_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spouse_name text,
  parent_id uuid references public.tree_members (id) on delete cascade,
  sort_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tree_members enable row level security;

drop policy if exists "Anyone reads the family tree" on public.tree_members;
create policy "Anyone reads the family tree"
  on public.tree_members for select using (true);

drop policy if exists "Family writes the family tree" on public.tree_members;
create policy "Family writes the family tree"
  on public.tree_members for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());

-- Starting tree: John & Nancy at the top.
insert into public.tree_members (id, name, spouse_name, parent_id, sort_index) values
  ('a0000000-0000-4000-8000-000000000001', 'John Jungman',        'Nancy Jungman',      null,                                   1),
  ('a0000000-0000-4000-8000-000000000002', 'Will Jungman',        'Frédérique Jungman', 'a0000000-0000-4000-8000-000000000001', 1),
  ('a0000000-0000-4000-8000-000000000003', 'Kathryn Saini',       'Sahil Saini',        'a0000000-0000-4000-8000-000000000001', 2),
  ('a0000000-0000-4000-8000-000000000004', 'Elisabeth Jungman',   null,                 'a0000000-0000-4000-8000-000000000002', 1),
  ('a0000000-0000-4000-8000-000000000005', 'James Jungman',       null,                 'a0000000-0000-4000-8000-000000000002', 2),
  ('a0000000-0000-4000-8000-000000000006', 'Asher Jungman',       null,                 'a0000000-0000-4000-8000-000000000002', 3),
  ('a0000000-0000-4000-8000-000000000007', 'Jack Bahal Saini',    null,                 'a0000000-0000-4000-8000-000000000003', 1),
  ('a0000000-0000-4000-8000-000000000008', 'Nina Florence Saini', null,                 'a0000000-0000-4000-8000-000000000003', 2)
on conflict (id) do nothing;
