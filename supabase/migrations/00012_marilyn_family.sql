-- Marilyn (Skippy) Jungman's family, from her Find a Grave page:
-- parents William Harvey Skipwith Sr (1895-1955) and Florence Worley
-- Skipwith (1896-1977), and brother William Harvey Skipwith Jr
-- (1924-1970). Also fills in Frank's years (1929-2006) only where the
-- family hasn't already typed something.
-- Run in the Supabase SQL editor (safe to run more than once).

-- The Skipwiths, above Marilyn's side of the Frank & Marilyn card.
with frank as (
  select id from public.tree_members
  where parents_of = 'a0000000-0000-4000-8000-000000000001'
    and parents_side = 'self'
  limit 1
)
insert into public.tree_members
  (id, name, spouse_name, parents_of, parents_side, sort_index,
   born_year, died_year, spouse_born_year, spouse_died_year)
select
  'a0000000-0000-4000-8000-000000000012',
  'William Harvey Skipwith Sr', 'Florence Worley Skipwith',
  frank.id, 'spouse', 2, 1895, 1955, 1896, 1977
from frank
on conflict (id) do nothing;

-- Marilyn's brother, below the Skipwiths.
insert into public.tree_members
  (id, name, parent_id, sort_index, born_year, died_year)
values
  ('a0000000-0000-4000-8000-000000000013',
   'William Harvey Skipwith Jr',
   'a0000000-0000-4000-8000-000000000012', 1, 1924, 1970)
on conflict (id) do nothing;

-- Frank's dates from the same page, without overwriting anything entered.
update public.tree_members
  set born_year = coalesce(born_year, 1929),
      died_year = coalesce(died_year, 2006)
  where parents_of = 'a0000000-0000-4000-8000-000000000001'
    and parents_side = 'self';
