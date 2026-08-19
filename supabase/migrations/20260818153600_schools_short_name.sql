-- Optional display short name. Does not replace schools.code (tenant identity).
-- Does not modify Phase 0 SQL or RLS helpers.

alter table public.schools
  add column if not exists short_name text;

comment on column public.schools.short_name is
  'Optional display short name. Not used for tenancy or uniqueness.';
