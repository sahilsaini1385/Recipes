-- "We cooked this": a log of when a recipe was actually made, by whom, and
-- how it went.
--
-- The archive currently records where a recipe came from and what is in it,
-- but nothing about it ever being cooked. That is the part that accumulates:
-- in ten years "Nancy's cornbread, made 31 times, usually at Christmas" is a
-- more interesting fact about this family than anything in the recipe itself,
-- and it costs one tap to maintain.
--
-- `cooked_by` is free text rather than a reference to auth.users, and that is
-- deliberate. Seven addresses are on the family allowlist and exactly one has
-- ever created an account, so keying the cook to the signed-in user would
-- write Sahil's name on every entry the family ever logged. It is not a
-- reference to tree_members either: the person who cooked might be a friend,
-- a child too young to be on the tree, or "all of us".
--
-- Additive and safe to run more than once.

create table if not exists public.recipe_cooks (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  -- A date, not a timestamp: people log this afterwards ("we made it on
  -- Sunday"), and nobody cares that it was 7:42pm.
  cooked_on  date not null default current_date,
  -- Optional. "This got cooked" is worth recording even when nobody says who.
  cooked_by  text,
  -- "Halved the chilli, Jack ate it." The reason to come back years later.
  note       text,
  -- Soft delete, like trips and places. This is an archive.
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every read is "the cooks for this recipe, newest first".
create index if not exists recipe_cooks_recipe_idx
  on public.recipe_cooks (recipe_id, cooked_on desc);

drop trigger if exists recipe_cooks_set_updated_at on public.recipe_cooks;
create trigger recipe_cooks_set_updated_at
  before update on public.recipe_cooks
  for each row execute function public.set_updated_at();

alter table public.recipe_cooks enable row level security;

-- Reads mirror the rest of the site: the public link sees live rows, family
-- can also see soft-deleted ones so a mis-tap stays recoverable.
drop policy if exists "Anyone reads recipe cooks" on public.recipe_cooks;
create policy "Anyone reads recipe cooks"
  on public.recipe_cooks for select using (deleted_at is null);

drop policy if exists "Family reads deleted recipe cooks" on public.recipe_cooks;
create policy "Family reads deleted recipe cooks"
  on public.recipe_cooks for select
  to authenticated
  using (public.is_family());

drop policy if exists "Family writes recipe cooks" on public.recipe_cooks;
create policy "Family writes recipe cooks"
  on public.recipe_cooks for all
  to authenticated
  using (public.is_family())
  with check (public.is_family());
