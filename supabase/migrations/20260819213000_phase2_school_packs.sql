-- Phase 2 foundation: school packs for a year + class.
-- Reuses academic_years, classes, product_variants, and school_requirements.
-- Pack lines point at product_variants; year/class come from the pack row.
-- Does not create orders, inventory, payments, or alter existing RLS.

do $$
begin
  create type public.pack_type as enum (
    'book_pack',
    'uniform_pack',
    'complete_pack',
    'custom_pack'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null,
  class_id uuid not null,
  name text not null,
  pack_type public.pack_type not null,
  price_amount numeric(12, 2) not null,
  currency text not null default 'INR',
  is_active boolean not null default true,
  allows_repeat_purchase boolean not null default false,
  allow_purchase_when_insufficient_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_amount >= 0)
);

create table if not exists public.pack_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  pack_id uuid not null,
  product_variant_id uuid not null,
  quantity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity > 0)
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

select pg_temp.app_add_constraint('alter table public.packs add constraint packs_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.packs add constraint packs_school_year_class_name_key unique (school_id, academic_year_id, class_id, name)');
select pg_temp.app_add_constraint(
  'alter table public.packs add constraint packs_year_school_fkey foreign key (academic_year_id, school_id) references public.academic_years (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.packs add constraint packs_class_school_fkey foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint('alter table public.pack_items add constraint pack_items_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.pack_items add constraint pack_items_pack_variant_key unique (pack_id, product_variant_id)');
select pg_temp.app_add_constraint(
  'alter table public.pack_items add constraint pack_items_pack_school_fkey foreign key (pack_id, school_id) references public.packs (id, school_id) on delete cascade'
);
select pg_temp.app_add_constraint(
  'alter table public.pack_items add constraint pack_items_variant_school_fkey foreign key (product_variant_id, school_id) references public.product_variants (id, school_id) on delete restrict'
);

create index if not exists packs_school_idx on public.packs (school_id);
create index if not exists packs_year_idx on public.packs (academic_year_id);
create index if not exists packs_class_idx on public.packs (class_id);
create index if not exists pack_items_school_idx on public.pack_items (school_id);
create index if not exists pack_items_pack_idx on public.pack_items (pack_id);

drop trigger if exists packs_updated_at on public.packs;
create trigger packs_updated_at before update on public.packs
for each row execute procedure public.set_updated_at();

drop trigger if exists pack_items_updated_at on public.pack_items;
create trigger pack_items_updated_at before update on public.pack_items
for each row execute procedure public.set_updated_at();

grant select, insert, update, delete on public.packs to authenticated;
grant select, insert, update, delete on public.pack_items to authenticated;

alter table public.packs enable row level security;
alter table public.pack_items enable row level security;
alter table public.packs force row level security;
alter table public.pack_items force row level security;

drop policy if exists packs_select on public.packs;
create policy packs_select on public.packs
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.student_enrollments se
    where se.school_id = packs.school_id
      and se.academic_year_id = packs.academic_year_id
      and se.class_id = packs.class_id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists packs_insert_admin on public.packs;
create policy packs_insert_admin on public.packs
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists packs_update_admin on public.packs;
create policy packs_update_admin on public.packs
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists packs_delete_admin on public.packs;
create policy packs_delete_admin on public.packs
for delete to authenticated
using (public.app_is_school_admin(school_id));

drop policy if exists pack_items_select on public.pack_items;
create policy pack_items_select on public.pack_items
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.packs p
    join public.student_enrollments se
      on se.school_id = p.school_id
     and se.academic_year_id = p.academic_year_id
     and se.class_id = p.class_id
    where p.id = pack_items.pack_id
      and p.school_id = pack_items.school_id
      and public.app_parent_can_access_student(se.student_id)
  )
);

drop policy if exists pack_items_insert_admin on public.pack_items;
create policy pack_items_insert_admin on public.pack_items
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists pack_items_update_admin on public.pack_items;
create policy pack_items_update_admin on public.pack_items
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists pack_items_delete_admin on public.pack_items;
create policy pack_items_delete_admin on public.pack_items
for delete to authenticated
using (public.app_is_school_admin(school_id));
