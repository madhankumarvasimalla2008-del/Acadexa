-- Phase 2 foundation: school catalog + class-year requirements.
-- Reuses existing academic_years and classes (composite school FKs).
-- Does not create packs, inventory, payments, or alter Phase 0/1 RLS.

do $$
begin
  create type public.product_kind as enum ('book', 'uniform', 'other');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.product_kind not null,
  name text not null,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  product_id uuid not null,
  sku text,
  size text,
  edition text,
  unit_price_amount numeric(12, 2),
  currency text not null default 'INR',
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (unit_price_amount is null or unit_price_amount >= 0)
);

create table if not exists public.school_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null,
  class_id uuid not null,
  product_variant_id uuid not null,
  required_quantity integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (required_quantity > 0)
);

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

select pg_temp.app_add_constraint('alter table public.products add constraint products_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.product_variants add constraint product_variants_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.school_requirements add constraint school_requirements_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.school_requirements add constraint school_requirements_school_year_class_variant_key unique (school_id, academic_year_id, class_id, product_variant_id)');
select pg_temp.app_add_constraint(
  'alter table public.product_variants add constraint product_variants_product_school_fkey foreign key (product_id, school_id) references public.products (id, school_id) on delete cascade'
);
select pg_temp.app_add_constraint(
  'alter table public.school_requirements add constraint school_requirements_year_school_fkey foreign key (academic_year_id, school_id) references public.academic_years (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.school_requirements add constraint school_requirements_class_school_fkey foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.school_requirements add constraint school_requirements_variant_school_fkey foreign key (product_variant_id, school_id) references public.product_variants (id, school_id) on delete restrict'
);

create unique index if not exists products_school_kind_name_subject_uidx
  on public.products (school_id, kind, name, coalesce(subject, ''));

create unique index if not exists product_variants_school_sku_uidx
  on public.product_variants (school_id, sku)
  where sku is not null and sku <> '';

create index if not exists products_school_idx on public.products (school_id);
create index if not exists product_variants_school_idx on public.product_variants (school_id);
create index if not exists product_variants_product_idx on public.product_variants (product_id);
create index if not exists school_requirements_school_idx on public.school_requirements (school_id);
create index if not exists school_requirements_year_idx on public.school_requirements (academic_year_id);
create index if not exists school_requirements_class_idx on public.school_requirements (class_id);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants
for each row execute procedure public.set_updated_at();

drop trigger if exists school_requirements_updated_at on public.school_requirements;
create trigger school_requirements_updated_at before update on public.school_requirements
for each row execute procedure public.set_updated_at();

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select, insert, update, delete on public.school_requirements to authenticated;

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.school_requirements enable row level security;
alter table public.products force row level security;
alter table public.product_variants force row level security;
alter table public.school_requirements force row level security;

drop policy if exists products_select on public.products;
create policy products_select on public.products
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.product_variants pv
    join public.school_requirements sr
      on sr.product_variant_id = pv.id
     and sr.school_id = pv.school_id
    join public.student_enrollments se
      on se.school_id = sr.school_id
     and se.academic_year_id = sr.academic_year_id
     and se.class_id = sr.class_id
    where pv.product_id = products.id
      and pv.school_id = products.school_id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin on public.products
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists variants_select on public.product_variants;
create policy variants_select on public.product_variants
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.school_requirements sr
    join public.student_enrollments se
      on se.school_id = sr.school_id
     and se.academic_year_id = sr.academic_year_id
     and se.class_id = sr.class_id
    where sr.product_variant_id = product_variants.id
      and sr.school_id = product_variants.school_id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists variants_insert_admin on public.product_variants;
create policy variants_insert_admin on public.product_variants
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists variants_update_admin on public.product_variants;
create policy variants_update_admin on public.product_variants
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists variants_delete_admin on public.product_variants;
create policy variants_delete_admin on public.product_variants
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists requirements_select on public.school_requirements;
create policy requirements_select on public.school_requirements
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.student_enrollments se
    where se.school_id = school_requirements.school_id
      and se.academic_year_id = school_requirements.academic_year_id
      and se.class_id = school_requirements.class_id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists requirements_insert_admin on public.school_requirements;
create policy requirements_insert_admin on public.school_requirements
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists requirements_update_admin on public.school_requirements;
create policy requirements_update_admin on public.school_requirements
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists requirements_delete_admin on public.school_requirements;
create policy requirements_delete_admin on public.school_requirements
for delete to authenticated
using (public.app_is_school_admin(school_id));
