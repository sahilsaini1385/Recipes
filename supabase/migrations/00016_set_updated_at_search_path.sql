-- Pin the search_path on set_updated_at.
--
-- Supabase's security advisor flags this one (`function_search_path_mutable`).
-- The function is SECURITY INVOKER, so it cannot be used to escalate on its
-- own, but a trigger function that resolves its names against whatever
-- search_path the caller happens to have is a loose end -- and as of 00015 it
-- fires on every trips update, so it is worth closing.
--
-- Body is unchanged. Safe to run more than once.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
