-- A frozen copy of the finance blob as it stood in the OLD project, taken
-- immediately before that project was retired.
--
-- WHY THIS EXISTS
--
-- The live row was copied across at version 106. A device that was still
-- pointed at the old project then pushed versions 107 and 108 to it, at
-- 13:45 UTC on 2026-09-07, after that copy was taken. Those writes are
-- almost certainly not lost -- every version originates from some device's
-- local state, and both devices have since reconnected and merged onto this
-- project -- but "almost certainly" is not a good enough reason to let the
-- only other copy vanish behind a retired project.
--
-- Archived here: household a1d32299…, version 108, 250732 bytes,
-- md5 8ab9efdff7ad92b7f8cc52508c4a6c2a, written 2026-09-07 13:45:11 UTC.
--
-- Deliberately unreachable from the API: RLS on with no policies, and no
-- grants to anon or authenticated. Restoring is a manual decision, never
-- something a sync bug can trigger.
--
-- TO INSPECT IT: copy the ciphertext into finance.budgie_sync under a
-- throwaway household id, point a device at that household, and read it. The
-- encryption key still works because VITE_SYNC_REALM pins key derivation to
-- the original host rather than to whichever project holds the row.
--
-- TO DELETE IT, once the finance app has been confirmed complete for a
-- while:  drop table finance.budgie_sync_archive;

create table if not exists finance.budgie_sync_archive (
  household    text not null,
  version      bigint not null,
  ciphertext   text not null,
  updated_at   timestamptz,
  archived_at  timestamptz not null default now(),
  note         text,
  primary key (household, version)
);

comment on table finance.budgie_sync_archive is
  'Frozen pre-migration copies of budgie_sync rows from the retired finance project. Not exposed to the API; restore by hand only.';

alter table finance.budgie_sync_archive enable row level security;

revoke all on finance.budgie_sync_archive from anon;
revoke all on finance.budgie_sync_archive from authenticated;
