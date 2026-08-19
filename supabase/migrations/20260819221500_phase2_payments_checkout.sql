-- Phase 2 foundation: parent checkout and school payment records.
-- Reuses packs, pack_items, students, student_enrollments, academic_years, classes.
-- Snapshots pack lines on order_items (not receipts). No inventory, QR, or receipts.

do $$
begin
  create type public.payment_status as enum (
    'pending',
    'successful',
    'failed',
    'refunded'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.payment_attempt_status as enum (
    'pending',
    'successful',
    'failed'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  parent_id uuid not null references public.profiles (id) on delete restrict,
  pack_id uuid not null,
  amount_snapshot numeric(12, 2) not null,
  currency text not null default 'INR',
  payment_status public.payment_status not null default 'pending',
  pack_name_snapshot text not null,
  pack_type_snapshot text not null,
  pack_price_snapshot numeric(12, 2) not null,
  student_name_snapshot text not null,
  school_name_snapshot text not null,
  academic_year_name_snapshot text not null,
  class_name_snapshot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_snapshot >= 0),
  check (pack_price_snapshot >= 0)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  order_id uuid not null,
  product_variant_id uuid not null,
  name_snapshot text not null,
  quantity integer not null,
  unit_price_snapshot numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity > 0),
  check (unit_price_snapshot is null or unit_price_snapshot >= 0)
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  order_id uuid not null,
  parent_id uuid not null references public.profiles (id) on delete restrict,
  provider text not null default 'sandbox',
  status public.payment_attempt_status not null default 'pending',
  amount numeric(12, 2) not null,
  currency text not null default 'INR',
  idempotency_key uuid not null default gen_random_uuid(),
  gateway_order_id text,
  gateway_payment_id text,
  failure_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount >= 0),
  unique (idempotency_key)
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

select pg_temp.app_add_constraint('alter table public.orders add constraint orders_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint(
  'alter table public.orders add constraint orders_year_school_fkey foreign key (academic_year_id, school_id) references public.academic_years (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.orders add constraint orders_class_school_fkey foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.orders add constraint orders_student_school_fkey foreign key (student_id, school_id) references public.students (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.orders add constraint orders_pack_school_fkey foreign key (pack_id, school_id) references public.packs (id, school_id) on delete restrict'
);

select pg_temp.app_add_constraint('alter table public.order_items add constraint order_items_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint(
  'alter table public.order_items add constraint order_items_order_school_fkey foreign key (order_id, school_id) references public.orders (id, school_id) on delete cascade'
);
select pg_temp.app_add_constraint(
  'alter table public.order_items add constraint order_items_variant_school_fkey foreign key (product_variant_id, school_id) references public.product_variants (id, school_id) on delete restrict'
);

select pg_temp.app_add_constraint('alter table public.payment_transactions add constraint payment_transactions_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint(
  'alter table public.payment_transactions add constraint payment_transactions_order_school_fkey foreign key (order_id, school_id) references public.orders (id, school_id) on delete cascade'
);

create index if not exists orders_school_idx on public.orders (school_id);
create index if not exists orders_year_idx on public.orders (academic_year_id);
create index if not exists orders_class_idx on public.orders (class_id);
create index if not exists orders_pack_idx on public.orders (pack_id);
create index if not exists orders_student_idx on public.orders (student_id);
create index if not exists orders_status_idx on public.orders (payment_status);
create index if not exists orders_created_idx on public.orders (created_at);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists payment_transactions_order_idx on public.payment_transactions (order_id);
create index if not exists payment_transactions_school_idx on public.payment_transactions (school_id);

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute procedure public.set_updated_at();

drop trigger if exists order_items_updated_at on public.order_items;
create trigger order_items_updated_at before update on public.order_items
for each row execute procedure public.set_updated_at();

drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at before update on public.payment_transactions
for each row execute procedure public.set_updated_at();

grant select, insert on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, insert on public.payment_transactions to authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;
alter table public.payment_transactions force row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or parent_id = auth.uid()
  or public.app_parent_can_access_student(student_id)
);

drop policy if exists orders_insert_parent on public.orders;
create policy orders_insert_parent on public.orders
for insert to authenticated
with check (
  parent_id = auth.uid()
  and payment_status = 'pending'
  and public.app_parent_can_access_student(student_id)
  and exists (
    select 1
    from public.packs p
    where p.id = orders.pack_id
      and p.school_id = orders.school_id
      and p.academic_year_id = orders.academic_year_id
      and p.class_id = orders.class_id
      and p.is_active = true
  )
  and exists (
    select 1
    from public.student_enrollments se
    where se.student_id = orders.student_id
      and se.school_id = orders.school_id
      and se.academic_year_id = orders.academic_year_id
      and se.class_id = orders.class_id
  )
);

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.school_id = order_items.school_id
      and (
        o.parent_id = auth.uid()
        or public.app_parent_can_access_student(o.student_id)
      )
  )
);

drop policy if exists order_items_insert_parent on public.order_items;
create policy order_items_insert_parent on public.order_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.school_id = order_items.school_id
      and o.parent_id = auth.uid()
      and o.payment_status = 'pending'
      and public.app_parent_can_access_student(o.student_id)
  )
);

drop policy if exists payment_transactions_select on public.payment_transactions;
create policy payment_transactions_select on public.payment_transactions
for select to authenticated
using (
  public.app_is_school_staff(school_id)
  or parent_id = auth.uid()
);

drop policy if exists payment_transactions_insert_parent on public.payment_transactions;
create policy payment_transactions_insert_parent on public.payment_transactions
for insert to authenticated
with check (
  parent_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.orders o
    where o.id = payment_transactions.order_id
      and o.school_id = payment_transactions.school_id
      and o.parent_id = auth.uid()
      and o.payment_status in ('pending', 'failed')
  )
);
