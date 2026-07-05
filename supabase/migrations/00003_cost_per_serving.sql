-- Estimated cost per serving in USD (rough, AI-estimated; null = not yet
-- estimated — the estimate-costs edge function fills these in).
-- Run in the Supabase SQL editor.

alter table public.recipes
  add column if not exists cost_per_serving numeric;
