-- Password sign-in support.
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

-- Set the shared family password for accounts that already exist (created
-- earlier via magic link). New family members get theirs at first sign-in.
update auth.users
set encrypted_password = extensions.crypt('Beasley1', extensions.gen_salt('bf'))
where lower(email) in (select lower(email) from public.allowed_emails);
