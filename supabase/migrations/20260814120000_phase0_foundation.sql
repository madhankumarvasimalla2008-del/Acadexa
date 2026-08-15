-- Acadexa Phase 0 — database foundation (FOR REVIEW; do not apply until approved)
-- Scope: tenants, profiles/roles, academic structure, students, enrollments, parent links, audit, RLS
-- Out of scope: packs, inventory, payments, receipts, QR, refunds, notifications

create extension if not exists "pgcrypto";

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.global_role as enum ('super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.school_role as enum ('school_admin', 'distribution_staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.school_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_status as enum ('active', 'completed', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.parent_link_status as enum ('invited', 'accepted', 'revoked');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Identity and tenancy
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.global_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  status public.school_status not null default 'active',
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create table if not exists public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.school_role not null,
  created_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  check (ends_on > starts_on)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  section text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_code text not null,
  full_name text not null,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_code)
);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  academic_year_id uuid not null,
  class_id uuid not null,
  status public.enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);

create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  parent_id uuid references public.profiles (id) on delete set null,
  invited_email text,
  invited_phone text,
  invite_token_hash text not null,
  status public.parent_link_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (invited_email is not null or invited_phone is not null or parent_id is not null)
);

alter table public.parent_students add column if not exists invite_token_hash text;
alter table public.parent_students drop column if exists invite_token;

update public.parent_students
set invite_token_hash = encode(digest(gen_random_uuid()::text, 'sha256'), 'hex')
where invite_token_hash is null;

alter table public.parent_students alter column invite_token_hash set not null;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  school_id uuid references public.schools (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Idempotent constraints (safe if tables already existed from an earlier draft)
create or replace function pg_temp.app_add_constraint(p_sql text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end;
$$;

select pg_temp.app_add_constraint('alter table public.user_roles add constraint user_roles_user_id_role_key unique (user_id, role)');
select pg_temp.app_add_constraint('alter table public.schools add constraint schools_code_key unique (code)');
select pg_temp.app_add_constraint('alter table public.school_memberships add constraint school_memberships_school_user_role_key unique (school_id, user_id, role)');
select pg_temp.app_add_constraint('alter table public.academic_years add constraint academic_years_school_name_key unique (school_id, name)');
select pg_temp.app_add_constraint('alter table public.academic_years add constraint academic_years_dates_check check (ends_on > starts_on)');
select pg_temp.app_add_constraint('alter table public.academic_years add constraint academic_years_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.classes add constraint classes_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.students add constraint students_school_code_key unique (school_id, student_code)');
select pg_temp.app_add_constraint('alter table public.students add constraint students_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.student_enrollments add constraint student_enrollments_student_year_key unique (student_id, academic_year_id)');
select pg_temp.app_add_constraint(
  'alter table public.student_enrollments add constraint student_enrollments_student_school_fkey foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade'
);
select pg_temp.app_add_constraint(
  'alter table public.student_enrollments add constraint student_enrollments_year_school_fkey foreign key (academic_year_id, school_id) references public.academic_years (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.student_enrollments add constraint student_enrollments_class_school_fkey foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.parent_students add constraint parent_students_student_school_fkey foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade'
);
select pg_temp.app_add_constraint(
  'alter table public.parent_students add constraint parent_students_id_school_key unique (id, school_id)'
);
select pg_temp.app_add_constraint(
  'alter table public.parent_students add constraint parent_students_invitee_check check (invited_email is not null or invited_phone is not null or parent_id is not null)'
);
select pg_temp.app_add_constraint(
  'alter table public.school_memberships add constraint school_memberships_school_id_fkey foreign key (school_id) references public.schools (id) on delete cascade'
);
select pg_temp.app_add_constraint(
  'alter table public.school_memberships add constraint school_memberships_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade'
);

create unique index if not exists classes_school_name_section_uidx
  on public.classes (school_id, name, coalesce(section, ''));

-- Keep one current year per school before the unique index (safe on re-apply)
with ranked as (
  select
    id,
    row_number() over (
      partition by school_id
      order by updated_at desc, created_at desc, id desc
    ) as rn
  from public.academic_years
  where is_current
)
update public.academic_years ay
set is_current = false
from ranked
where ay.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists academic_years_one_current_uidx
  on public.academic_years (school_id)
  where is_current;

create unique index if not exists parent_students_accepted_unique
  on public.parent_students (parent_id, student_id)
  where parent_id is not null and status = 'accepted';

create unique index if not exists parent_students_invited_parent_uidx
  on public.parent_students (student_id, parent_id)
  where parent_id is not null and status = 'invited';

create unique index if not exists parent_students_invited_email_uidx
  on public.parent_students (student_id, lower(invited_email))
  where invited_email is not null and status = 'invited';

create unique index if not exists parent_students_invited_phone_uidx
  on public.parent_students (student_id, invited_phone)
  where invited_phone is not null and status = 'invited';

create unique index if not exists parent_students_token_hash_uidx
  on public.parent_students (invite_token_hash);

create unique index if not exists profiles_email_lower_uidx
  on public.profiles (lower(email))
  where email is not null and email <> '';

create unique index if not exists profiles_phone_uidx
  on public.profiles (phone)
  where phone is not null and phone <> '';

create index if not exists school_memberships_user_idx on public.school_memberships (user_id);
create index if not exists school_memberships_school_idx on public.school_memberships (school_id);
create index if not exists academic_years_school_idx on public.academic_years (school_id);
create index if not exists classes_school_idx on public.classes (school_id);
create index if not exists students_school_idx on public.students (school_id);
create index if not exists enrollments_school_idx on public.student_enrollments (school_id);
create index if not exists enrollments_student_idx on public.student_enrollments (student_id);
create index if not exists parent_students_parent_idx on public.parent_students (parent_id);
create index if not exists parent_students_student_idx on public.parent_students (student_id);
create index if not exists parent_students_school_idx on public.parent_students (school_id);
create index if not exists audit_logs_school_idx on public.audit_logs (school_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists schools_updated_at on public.schools;
create trigger schools_updated_at before update on public.schools
for each row execute procedure public.set_updated_at();

drop trigger if exists academic_years_updated_at on public.academic_years;
create trigger academic_years_updated_at before update on public.academic_years
for each row execute procedure public.set_updated_at();

drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes
for each row execute procedure public.set_updated_at();

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students
for each row execute procedure public.set_updated_at();

drop trigger if exists enrollments_updated_at on public.student_enrollments;
create trigger enrollments_updated_at before update on public.student_enrollments
for each row execute procedure public.set_updated_at();

drop trigger if exists parent_students_updated_at on public.parent_students;
create trigger parent_students_updated_at before update on public.parent_students
for each row execute procedure public.set_updated_at();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.email is distinct from old.email or new.phone is distinct from old.phone then
    if current_user = 'authenticated' then
      raise exception 'profile email and phone are managed by authentication and cannot be changed here';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity before update on public.profiles
for each row execute procedure public.protect_profile_identity();

create or replace function public.protect_school_admin_columns()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if public.app_is_super_admin() then
    return new;
  end if;
  if new.code is distinct from old.code or new.status is distinct from old.status then
    raise exception 'school code and status can only be changed by a super admin';
  end if;
  return new;
end;
$$;

drop trigger if exists schools_protect_admin_columns on public.schools;
create trigger schools_protect_admin_columns before update on public.schools
for each row execute procedure public.protect_school_admin_columns();

create or replace function public.protect_parent_link_acceptance()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    if current_user = 'authenticated' then
      raise exception 'parent relationship can only be accepted via invitation confirmation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists parent_students_protect_accept on public.parent_students;
create trigger parent_students_protect_accept before update on public.parent_students
for each row execute procedure public.protect_parent_link_acceptance();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.phone, '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.profiles
  set
    email = new.email,
    phone = case
      when new.phone is distinct from old.phone then nullif(trim(coalesce(new.phone, '')), '')
      else phone
    end
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, phone on auth.users
  for each row execute procedure public.sync_profile_from_auth();

create or replace function public.ensure_one_current_academic_year()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.is_current then
    update public.academic_years
    set is_current = false
    where school_id = new.school_id
      and id is distinct from new.id
      and is_current;
  end if;
  return new;
end;
$$;

drop trigger if exists academic_years_one_current on public.academic_years;
create trigger academic_years_one_current
  before insert or update of is_current on public.academic_years
  for each row execute procedure public.ensure_one_current_academic_year();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function public.app_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.status = 'active'
    where ur.user_id = auth.uid() and ur.role = 'super_admin'
  );
$$;

create or replace function public.app_is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.school_memberships sm
    join public.schools s on s.id = sm.school_id and s.status = 'active'
    join public.profiles p on p.id = sm.user_id and p.status = 'active'
    where sm.user_id = auth.uid()
      and sm.school_id = p_school_id
      and sm.role = 'school_admin'
  );
$$;

create or replace function public.app_is_school_staff(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.school_memberships sm
    join public.schools s on s.id = sm.school_id and s.status = 'active'
    join public.profiles p on p.id = sm.user_id and p.status = 'active'
    where sm.user_id = auth.uid()
      and sm.school_id = p_school_id
      and sm.role in ('school_admin', 'distribution_staff')
  );
$$;

create or replace function public.app_school_ids_for_roles(p_roles public.school_role[])
returns setof uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select sm.school_id
  from public.school_memberships sm
  join public.schools s on s.id = sm.school_id and s.status = 'active'
  join public.profiles p on p.id = sm.user_id and p.status = 'active'
  where sm.user_id = auth.uid()
    and sm.role = any (p_roles);
$$;

create or replace function public.app_parent_can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.schools s on s.id = ps.school_id and s.status = 'active'
    join public.profiles p on p.id = ps.parent_id and p.status = 'active'
    where ps.student_id = p_student_id
      and ps.parent_id = auth.uid()
      and ps.status = 'accepted'
  );
$$;

create or replace function public.app_parent_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select distinct ps.school_id
  from public.parent_students ps
  join public.schools s on s.id = ps.school_id and s.status = 'active'
  join public.profiles p on p.id = ps.parent_id and p.status = 'active'
  where ps.parent_id = auth.uid()
    and ps.status = 'accepted';
$$;

create or replace function public.app_can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p_user_id = auth.uid()
    or exists (
      select 1
      from public.school_memberships target
      join public.schools s
        on s.id = target.school_id and s.status = 'active'
      join public.school_memberships me
        on me.school_id = target.school_id
       and me.user_id = auth.uid()
       and me.role in ('school_admin', 'distribution_staff')
      join public.profiles caller
        on caller.id = me.user_id and caller.status = 'active'
      where target.user_id = p_user_id
    )
    or exists (
      select 1
      from public.parent_students ps
      where ps.parent_id = p_user_id
        and ps.status in ('invited', 'accepted')
        and public.app_is_school_admin(ps.school_id)
    );
$$;

create or replace function public.app_hash_invite_token(p_token uuid)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_token::text, 'sha256'), 'hex');
$$;

revoke all on function public.app_is_super_admin() from public;
revoke all on function public.app_is_school_admin(uuid) from public;
revoke all on function public.app_is_school_staff(uuid) from public;
revoke all on function public.app_school_ids_for_roles(public.school_role[]) from public;
revoke all on function public.app_parent_can_access_student(uuid) from public;
revoke all on function public.app_parent_school_ids() from public;
revoke all on function public.app_can_view_profile(uuid) from public;
revoke all on function public.app_hash_invite_token(uuid) from public;

grant execute on function public.app_is_super_admin() to authenticated;
grant execute on function public.app_is_school_admin(uuid) to authenticated;
grant execute on function public.app_is_school_staff(uuid) to authenticated;
grant execute on function public.app_school_ids_for_roles(public.school_role[]) to authenticated;
grant execute on function public.app_parent_can_access_student(uuid) to authenticated;
grant execute on function public.app_parent_school_ids() to authenticated;
grant execute on function public.app_can_view_profile(uuid) to authenticated;

drop function if exists public.find_profile_by_contact(text, text);

create or replace function public.find_profile_by_contact(
  p_email text,
  p_phone text,
  p_school_id uuid default null
)
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if public.app_is_super_admin() then
    null;
  elsif p_school_id is not null and public.app_is_school_admin(p_school_id) then
    null;
  else
    raise exception 'not authorized';
  end if;

  if v_email is null and v_phone is null then
    raise exception 'email or phone is required';
  end if;

  return query
  select p.id, p.full_name
  from public.profiles p
  where (
    (v_email is not null and p.email is not null and lower(p.email) = v_email)
    or (v_email is null and v_phone is not null and p.phone is not null and p.phone = v_phone)
  )
  and (
    public.app_is_super_admin()
    or exists (
      select 1
      from public.parent_students ps
      where ps.parent_id = p.id
        and ps.school_id = p_school_id
        and ps.status in ('invited', 'accepted')
    )
    or exists (
      select 1
      from public.school_memberships sm
      where sm.user_id = p.id
        and sm.school_id = p_school_id
    )
  )
  limit 1;
end;
$$;

revoke all on function public.find_profile_by_contact(text, text, uuid) from public;
grant execute on function public.find_profile_by_contact(text, text, uuid) to authenticated;

create or replace function public.create_parent_student_invite(
  p_school_id uuid,
  p_student_id uuid,
  p_email text,
  p_phone text,
  p_parent_id uuid
)
returns table (id uuid, invite_token uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token uuid := gen_random_uuid();
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.app_is_school_admin(p_school_id) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.school_id = p_school_id
  ) then
    raise exception 'student is not in this school';
  end if;

  if v_email is null and v_phone is null and p_parent_id is null then
    raise exception 'email, phone, or existing parent is required';
  end if;

  if exists (
    select 1
    from public.parent_students ps
    where ps.student_id = p_student_id
      and ps.status in ('invited', 'accepted')
      and (
        (p_parent_id is not null and ps.parent_id = p_parent_id)
        or (v_email is not null and ps.invited_email is not null and lower(ps.invited_email) = v_email)
        or (v_phone is not null and ps.invited_phone is not null and ps.invited_phone = v_phone)
      )
  ) then
    raise exception 'an invitation or link already exists for this student';
  end if;

  if p_parent_id is not null and not (
    exists (
      select 1 from public.parent_students ps
      where ps.parent_id = p_parent_id
        and ps.school_id = p_school_id
        and ps.status in ('invited', 'accepted')
    )
    or exists (
      select 1 from public.school_memberships sm
      where sm.user_id = p_parent_id
        and sm.school_id = p_school_id
    )
  ) then
    raise exception 'parent is not associated with this school';
  end if;

  insert into public.parent_students (
    school_id, student_id, parent_id, invited_email, invited_phone,
    invite_token_hash, status, invited_by
  )
  values (
    p_school_id,
    p_student_id,
    p_parent_id,
    v_email,
    v_phone,
    public.app_hash_invite_token(v_token),
    'invited',
    auth.uid()
  )
  returning parent_students.id into v_id;

  return query select v_id, v_token;
exception
  when unique_violation then
    raise exception 'an invitation or link already exists for this student';
end;
$$;

revoke all on function public.create_parent_student_invite(uuid, uuid, text, text, uuid) from public;
grant execute on function public.create_parent_student_invite(uuid, uuid, text, text, uuid) to authenticated;

create or replace function public.accept_parent_student_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.parent_students%rowtype;
  v_email text;
  v_phone text;
  v_hash text := public.app_hash_invite_token(p_token);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  ) then
    raise exception 'account is disabled';
  end if;

  select u.email, coalesce(nullif(u.phone, ''), p.phone) into v_email, v_phone
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = auth.uid();

  select * into v_link
  from public.parent_students
  where invite_token_hash = v_hash
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;

  if not exists (
    select 1 from public.schools s
    where s.id = v_link.school_id and s.status = 'active'
  ) then
    raise exception 'school is not active';
  end if;

  if v_link.status = 'accepted' and v_link.parent_id = auth.uid() then
    return v_link.id;
  end if;

  if v_link.status <> 'invited' then
    raise exception 'invitation is not pending';
  end if;

  if v_link.parent_id is not null and v_link.parent_id <> auth.uid() then
    raise exception 'invitation belongs to another account';
  end if;

  if v_link.parent_id is null then
    if v_link.invited_email is not null
       and v_email is not null
       and lower(v_link.invited_email) = lower(v_email) then
      null;
    elsif v_link.invited_phone is not null
          and v_phone is not null
          and v_link.invited_phone = v_phone then
      null;
    else
      raise exception 'invitation does not match this account';
    end if;
  end if;

  update public.parent_students
  set parent_id = auth.uid(),
      status = 'accepted',
      accepted_at = now()
  where id = v_link.id;

  insert into public.audit_logs (actor_id, school_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_link.school_id,
    'parent_student.accept',
    'parent_students',
    v_link.id,
    jsonb_build_object('student_id', v_link.student_id)
  );

  return v_link.id;
end;
$$;

revoke all on function public.accept_parent_student_invite(uuid) from public;
grant execute on function public.accept_parent_student_invite(uuid) to authenticated;

create or replace function public.accept_own_parent_student_invite(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.parent_students%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  ) then
    raise exception 'account is disabled';
  end if;

  select * into v_link
  from public.parent_students
  where id = p_id
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;

  if not exists (
    select 1 from public.schools s
    where s.id = v_link.school_id and s.status = 'active'
  ) then
    raise exception 'school is not active';
  end if;

  if v_link.parent_id is distinct from auth.uid() then
    raise exception 'invitation does not belong to this account';
  end if;

  if v_link.status = 'accepted' then
    return v_link.id;
  end if;

  if v_link.status <> 'invited' then
    raise exception 'invitation is not pending';
  end if;

  update public.parent_students
  set status = 'accepted',
      accepted_at = now()
  where id = v_link.id;

  insert into public.audit_logs (actor_id, school_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_link.school_id,
    'parent_student.accept',
    'parent_students',
    v_link.id,
    jsonb_build_object('student_id', v_link.student_id)
  );

  return v_link.id;
end;
$$;

revoke all on function public.accept_own_parent_student_invite(uuid) from public;
grant execute on function public.accept_own_parent_student_invite(uuid) to authenticated;

create or replace function public.write_audit_log(
  p_school_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_school_id is not null and not (
    public.app_is_super_admin()
    or public.app_is_school_admin(p_school_id)
  ) then
    raise exception 'not authorized';
  end if;

  if p_school_id is null and not public.app_is_super_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.audit_logs (actor_id, school_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_school_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

revoke insert, update, delete on public.profiles from authenticated;
revoke select on public.profiles from authenticated;
grant select (id, full_name, status, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert on public.user_roles to authenticated;
grant select, insert, update on public.schools to authenticated;
grant select, insert, delete on public.school_memberships to authenticated;
grant select, insert, update, delete on public.academic_years to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.student_enrollments to authenticated;
grant select, insert on public.audit_logs to authenticated;

revoke all on public.parent_students from public;
revoke all on public.parent_students from anon;
revoke all on public.parent_students from authenticated;
grant select (
  id, school_id, student_id, parent_id, status, invited_by, accepted_at, created_at, updated_at
) on public.parent_students to authenticated;
grant update (status) on public.parent_students to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.parent_students enable row level security;
alter table public.audit_logs enable row level security;

alter table public.profiles force row level security;
alter table public.user_roles force row level security;
alter table public.schools force row level security;
alter table public.school_memberships force row level security;
alter table public.academic_years force row level security;
alter table public.classes force row level security;
alter table public.students force row level security;
alter table public.student_enrollments force row level security;
alter table public.parent_students force row level security;
alter table public.audit_logs force row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (public.app_can_view_profile(id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.app_is_super_admin());

drop policy if exists user_roles_insert_super on public.user_roles;
create policy user_roles_insert_super on public.user_roles
for insert to authenticated
with check (public.app_is_super_admin());

drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools
for select to authenticated
using (
  public.app_is_super_admin()
  or public.app_is_school_staff(id)
  or id in (select public.app_parent_school_ids())
);

drop policy if exists schools_insert_super on public.schools;
create policy schools_insert_super on public.schools
for insert to authenticated
with check (public.app_is_super_admin());

drop policy if exists schools_update_super on public.schools;
create policy schools_update_super on public.schools
for update to authenticated
using (public.app_is_super_admin())
with check (public.app_is_super_admin());

drop policy if exists schools_update_admin on public.schools;
create policy schools_update_admin on public.schools
for update to authenticated
using (public.app_is_school_admin(id))
with check (public.app_is_school_admin(id));

drop policy if exists memberships_select on public.school_memberships;
create policy memberships_select on public.school_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.app_is_super_admin()
  or public.app_is_school_admin(school_id)
);

drop policy if exists memberships_insert_super on public.school_memberships;
create policy memberships_insert_super on public.school_memberships
for insert to authenticated
with check (public.app_is_super_admin());

drop policy if exists memberships_insert_admin_staff on public.school_memberships;
create policy memberships_insert_admin_staff on public.school_memberships
for insert to authenticated
with check (
  public.app_is_school_admin(school_id)
  and role = 'distribution_staff'
);

drop policy if exists memberships_delete_super on public.school_memberships;
create policy memberships_delete_super on public.school_memberships
for delete to authenticated
using (public.app_is_super_admin());

drop policy if exists memberships_delete_admin_staff on public.school_memberships;
create policy memberships_delete_admin_staff on public.school_memberships
for delete to authenticated
using (
  public.app_is_school_admin(school_id)
  and role = 'distribution_staff'
);

drop policy if exists years_select on public.academic_years;
create policy years_select on public.academic_years
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.student_enrollments se
    where se.academic_year_id = academic_years.id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists years_write_admin on public.academic_years;
create policy years_write_admin on public.academic_years
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists years_update_admin on public.academic_years;
create policy years_update_admin on public.academic_years
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists years_delete_admin on public.academic_years;
create policy years_delete_admin on public.academic_years
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.student_enrollments se
    where se.class_id = classes.id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists classes_insert_admin on public.classes;
create policy classes_insert_admin on public.classes
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists classes_update_admin on public.classes;
create policy classes_update_admin on public.classes
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists classes_delete_admin on public.classes;
create policy classes_delete_admin on public.classes
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists students_select on public.students;
create policy students_select on public.students
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or public.app_parent_can_access_student(id)
);

drop policy if exists students_insert_admin on public.students;
create policy students_insert_admin on public.students
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists students_update_admin on public.students;
create policy students_update_admin on public.students
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists students_delete_admin on public.students;
create policy students_delete_admin on public.students
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists enrollments_select on public.student_enrollments;
create policy enrollments_select on public.student_enrollments
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or public.app_parent_can_access_student(student_id)
);

drop policy if exists enrollments_insert_admin on public.student_enrollments;
create policy enrollments_insert_admin on public.student_enrollments
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists enrollments_update_admin on public.student_enrollments;
create policy enrollments_update_admin on public.student_enrollments
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists enrollments_delete_admin on public.student_enrollments;
create policy enrollments_delete_admin on public.student_enrollments
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists parent_students_select on public.parent_students;
create policy parent_students_select on public.parent_students
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or (
    parent_id = auth.uid()
    and status in ('invited', 'accepted')
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.status = 'active'
    )
    and exists (
      select 1 from public.schools s
      where s.id = parent_students.school_id and s.status = 'active'
    )
  )
);

drop policy if exists parent_students_insert_admin on public.parent_students;

drop policy if exists parent_students_update_admin on public.parent_students;
create policy parent_students_update_admin on public.parent_students
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (
  public.app_is_school_admin(school_id)
  and status = 'revoked'
);

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
for select to authenticated
using (
  public.app_is_super_admin()
  or (school_id is not null and public.app_is_school_admin(school_id))
);

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs
for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    public.app_is_super_admin()
    or (school_id is not null and public.app_is_school_admin(school_id))
  )
);
