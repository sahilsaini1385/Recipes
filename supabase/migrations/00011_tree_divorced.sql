-- Mark a couple on the family tree as divorced/separated: they stay on one
-- card as co-parents, but the heart between them is shown muted and
-- slashed. Run in the Supabase SQL editor (safe to run more than once).

alter table public.tree_members
  add column if not exists divorced boolean not null default false;
