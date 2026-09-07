-- Budgie (the personal-finance app) moves in as a lodger.
--
-- Its database used to be a Supabase project of its own. A Supabase project
-- is a dedicated server billed by the hour whether anyone uses it or not, so
-- four projects meant four bills. This puts Budgie's one table in this
-- project instead, in a schema of its own.
--
-- Safe to re-run. Additive only: it reads and writes nothing in `public`.
--
-- ISOLATION -- deliberately tighter than the project it came from:
--   * `anon` only. The finance app authenticates with the anon key and
--     nothing else. `authenticated` is granted NOTHING here, so a signed-in
--     family member on the recipes site cannot reach finance data even by
--     accident, and neither can any account added to this project later.
--   * No DELETE, for anyone. Not granted, not policied. Rows hold blobs
--     encrypted in the browser -- the server never has the key, so the anon
--     key was never a confidentiality boundary. Withholding DELETE removes
--     the one destructive thing a key-holder could otherwise do; a bad
--     overwrite is still caught by the app's version check.
--   * Privileges are granted per table, never schema-wide, so any table
--     added here in future is unreachable until someone grants it on purpose.
--
-- ALSO REQUIRED, and not expressible in SQL: `finance` must appear in
-- Settings -> API -> Exposed schemas, or PostgREST answers PGRST106.
--
-- TO UNDO: see 00013_finance_lodger_schema_rollback.sql.

create schema if not exists finance;

comment on schema finance is
  'Budgie personal-finance app. Isolated lodger schema, reachable only by the anon role. See 00013_finance_lodger_schema_rollback.sql to remove.';

create table if not exists finance.budgie_sync (
  household   text primary key,
  version     bigint not null,
  ciphertext  text not null,
  updated_at  timestamptz default now()
);

comment on table finance.budgie_sync is
  'One row per household: an AES-GCM blob encrypted client-side. The server never holds the key.';

alter table finance.budgie_sync enable row level security;

drop policy if exists "budgie anon select" on finance.budgie_sync;
drop policy if exists "budgie anon insert" on finance.budgie_sync;
drop policy if exists "budgie anon update" on finance.budgie_sync;

create policy "budgie anon select" on finance.budgie_sync
  for select to anon using (true);
create policy "budgie anon insert" on finance.budgie_sync
  for insert to anon with check (true);
create policy "budgie anon update" on finance.budgie_sync
  for update to anon using (true) with check (true);

grant usage on schema finance to anon;
grant select, insert, update on finance.budgie_sync to anon;

revoke delete on finance.budgie_sync from anon;
revoke all on schema finance from authenticated;
revoke all on finance.budgie_sync from authenticated;
