-- Birth/death years for family tree cards, plus Robert (Bob) Jungman as
-- John's brother. Run in the Supabase SQL editor (safe to run more than
-- once; it never overwrites names you've edited on the site).

alter table public.tree_members
  add column if not exists born_year int,
  add column if not exists died_year int,
  add column if not exists spouse_born_year int,
  add column if not exists spouse_died_year int;

-- Robert hangs from John's parents' card (no children).
insert into public.tree_members (id, name, parent_id, sort_index) values
  ('a0000000-0000-4000-8000-000000000011', 'Robert "Bob" Jungman',
   'a0000000-0000-4000-8000-000000000009', 2)
on conflict (id) do nothing;
