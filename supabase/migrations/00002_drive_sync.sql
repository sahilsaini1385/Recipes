-- Google Drive sync: remembers which Drive files were already imported (or
-- deliberately skipped) so the "Check Drive" button only offers new ones.
-- Run in the Supabase SQL editor.

create table if not exists public.drive_files (
  file_id text primary key,
  name text not null,
  status text not null default 'imported' check (status in ('imported', 'skipped')),
  processed_at timestamptz not null default now()
);

alter table public.drive_files enable row level security;

drop policy if exists "Family reads drive log" on public.drive_files;
create policy "Family reads drive log"
  on public.drive_files for select
  to authenticated
  using (public.is_family());

drop policy if exists "Family writes drive log" on public.drive_files;
create policy "Family writes drive log"
  on public.drive_files for insert
  to authenticated
  with check (public.is_family());

drop policy if exists "Family updates drive log" on public.drive_files;
create policy "Family updates drive log"
  on public.drive_files for update
  to authenticated
  using (public.is_family())
  with check (public.is_family());
