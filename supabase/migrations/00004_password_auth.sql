-- Password sign-in support. Safe to re-run.
-- Run in the Supabase SQL editor. Also: in Authentication -> Sign In /
-- Providers -> Email, turn OFF "Confirm email" so first-time password
-- sign-ins don't require clicking an email link.

-- Lets the sign-in page check the allowlist BEFORE creating an account, so
-- only family emails can register. Security definer because the allowlist
-- table itself is not readable by clients.
create or replace function public.email_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.email_allowed(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ONE-TIME ONLY -- deliberately left commented out.
--
-- This resets the password of every family account. It was run once, when
-- the site moved from magic links to passwords. Running it again would
-- silently overwrite any password a family member has since chosen, so it
-- is not part of the re-runnable migration.
--
-- To set the shared password on a fresh database: uncomment the statement,
-- replace PUT-THE-FAMILY-PASSWORD-HERE, run it once, then comment it out
-- again. (The password is intentionally not stored in this file.)
--
-- update auth.users
-- set encrypted_password = extensions.crypt(
--   'PUT-THE-FAMILY-PASSWORD-HERE', extensions.gen_salt('bf')
-- )
-- where lower(email) in (select lower(email) from public.allowed_emails);
-- ---------------------------------------------------------------------
