-- Acadexa Phase 1 — student CSV/Excel import (identity only)
-- Compatible with Phase 0 helpers: app_is_school_admin, existing students RLS, write_audit_log
-- Does not replace or alter Phase 0 functions, students policies, or parent invite RPCs

set search_path = public, extensions;

do $$ begin
  create type public.student_import_job_status as enum (
    'pending', 'processing', 'completed', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_import_row_status as enum (
    'inserted', 'failed', 'skipped'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.student_import_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  filename text not null,
  byte_size integer not null check (byte_size >= 0),
  status public.student_import_job_status not null default 'pending',
  total_rows integer not null default 0 check (total_rows >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_summary text,
  storage_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, school_id)
);

create table if not exists public.student_import_job_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  school_id uuid not null,
  row_number integer not null check (row_number > 0),
  status public.student_import_row_status not null,
  student_code text,
  message text,
  created_at timestamptz not null default now(),
  unique (job_id, row_number),
  foreign key (job_id, school_id) references public.student_import_jobs (id, school_id) on delete cascade
);

create index if not exists student_import_jobs_school_idx
  on public.student_import_jobs (school_id, created_at desc);

create index if not exists student_import_job_rows_job_idx
  on public.student_import_job_rows (job_id, row_number);

revoke all on public.student_import_jobs from public, anon;
revoke all on public.student_import_job_rows from public, anon;
grant select, insert, update on public.student_import_jobs to authenticated;
grant select, insert on public.student_import_job_rows to authenticated;

alter table public.student_import_jobs enable row level security;
alter table public.student_import_jobs force row level security;
alter table public.student_import_job_rows enable row level security;
alter table public.student_import_job_rows force row level security;

drop policy if exists import_jobs_select on public.student_import_jobs;
create policy import_jobs_select on public.student_import_jobs
for select to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists import_jobs_insert on public.student_import_jobs;
create policy import_jobs_insert on public.student_import_jobs
for insert to authenticated
with check (
  public.app_is_school_admin(school_id)
  and uploaded_by = auth.uid()
);

drop policy if exists import_jobs_update on public.student_import_jobs;
create policy import_jobs_update on public.student_import_jobs
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists import_rows_select on public.student_import_job_rows;
create policy import_rows_select on public.student_import_job_rows
for select to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists import_rows_insert on public.student_import_job_rows;
create policy import_rows_insert on public.student_import_job_rows
for insert to authenticated
with check (public.app_is_school_admin(school_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('student-imports', 'student-imports', false, 2097152)
on conflict (id) do nothing;

drop policy if exists import_storage_select on storage.objects;
create policy import_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'student-imports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.app_is_school_admin(((storage.foldername(name))[1])::uuid)
);

drop policy if exists import_storage_insert on storage.objects;
create policy import_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-imports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.app_is_school_admin(((storage.foldername(name))[1])::uuid)
);
