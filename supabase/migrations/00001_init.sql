-- Jungman Family Recipes — initial schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Allowlist of family email addresses. No client-facing policies: only the
-- service role (dashboard / SQL editor) can read or edit it. The is_family()
-- function below is SECURITY DEFINER so RLS checks can consult it.
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- Seed the family members. Add more with:
--   insert into allowed_emails (email) values ('name@example.com');
insert into public.allowed_emails (email)
values
  ('ss3694@cornell.edu'),
  ('kathrynjsaini@gmail.com')
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
-- Recipes
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null check (category in (
    'Appetizers & Party Food',
    'Baby & Toddler',
    'Bread',
    'Breakfast',
    'Dessert',
    'Drinks',
    'Entrees',
    'Salads',
    'Dressings & Sauces',
    'Sides',
    'Soup'
  )),
  credit text not null default '',
  source_url text,
  base_servings integer not null default 4 check (base_servings > 0),
  servings_estimated boolean not null default false,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  notes text,
  photo_path text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_category_idx on public.recipes (category);
create index if not exists recipes_tags_idx on public.recipes using gin (tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "Anyone can read recipes" on public.recipes;
create policy "Anyone can read recipes"
  on public.recipes for select
  using (true);

drop policy if exists "Family can add recipes" on public.recipes;
create policy "Family can add recipes"
  on public.recipes for insert
  to authenticated
  with check (public.is_family());

drop policy if exists "Family can edit recipes" on public.recipes;
create policy "Family can edit recipes"
  on public.recipes for update
  to authenticated
  using (public.is_family())
  with check (public.is_family());

drop policy if exists "Family can delete recipes" on public.recipes;
create policy "Family can delete recipes"
  on public.recipes for delete
  to authenticated
  using (public.is_family());

-- ---------------------------------------------------------------------------
-- Favorites (per signed-in user; anonymous visitors fall back to localStorage)
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites"
  on public.favorites for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket for recipe photos (public read, family write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read recipe photos" on storage.objects;
create policy "Public read recipe photos"
  on storage.objects for select
  using (bucket_id = 'recipe-photos');

drop policy if exists "Family upload recipe photos" on storage.objects;
create policy "Family upload recipe photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-photos' and public.is_family());

drop policy if exists "Family update recipe photos" on storage.objects;
create policy "Family update recipe photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-photos' and public.is_family());

drop policy if exists "Family delete recipe photos" on storage.objects;
create policy "Family delete recipe photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipe-photos' and public.is_family());
