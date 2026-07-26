-- Ancestors for the family tree: a card can now record whose parents it
-- holds (parents_of + which side of the couple), so grandparent couples
-- render above the tree. Deleting a person also removes their ancestor
-- cards. Run in the Supabase SQL editor (safe to run more than once).

alter table public.tree_members
  add column if not exists parents_of uuid
    references public.tree_members (id) on delete cascade,
  add column if not exists parents_side text not null default 'self'
    check (parents_side in ('self', 'spouse'));

-- John's parents and Nancy's parents, above John & Nancy.
insert into public.tree_members (id, name, spouse_name, parents_of, parents_side, sort_index) values
  ('a0000000-0000-4000-8000-000000000009', 'Frank Jungman', 'Skippy Jungman',
   'a0000000-0000-4000-8000-000000000001', 'self',   1),
  ('a0000000-0000-4000-8000-000000000010', 'Kay Reeves',    'Erwin Reeves',
   'a0000000-0000-4000-8000-000000000001', 'spouse', 2)
on conflict (id) do nothing;
