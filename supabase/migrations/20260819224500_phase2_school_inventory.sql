-- Phase 2 foundation: school inventory ledger.
-- Reuses product_variants, school_requirements, and successful orders for reserved qty.
-- Does not create distribution, receipts, QR, or alter existing RLS.

do $$
begin
  create type public.inventory_reason as enum (
    'stock_in',
    'adjustment',
    'reserve_on_payment',
    'release_on_refund',
    'distribute'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  product_variant_id uuid not null,
  on_hand integer not null default 0,
  distributed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (on_hand >= 0),
  check (distributed >= 0),
  check (distributed <= on_hand)
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  product_variant_id uuid not null,
  reason public.inventory_reason not null,
  on_hand_delta integer not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (on_hand_delta <> 0)
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

select pg_temp.app_add_constraint('alter table public.inventory_balances add constraint inventory_balances_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint('alter table public.inventory_balances add constraint inventory_balances_school_variant_key unique (school_id, product_variant_id)');
select pg_temp.app_add_constraint(
  'alter table public.inventory_balances add constraint inventory_balances_variant_school_fkey foreign key (product_variant_id, school_id) references public.product_variants (id, school_id) on delete restrict'
);

select pg_temp.app_add_constraint('alter table public.inventory_transactions add constraint inventory_transactions_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint(
  'alter table public.inventory_transactions add constraint inventory_transactions_variant_school_fkey foreign key (product_variant_id, school_id) references public.product_variants (id, school_id) on delete restrict'
);

create index if not exists inventory_balances_school_idx on public.inventory_balances (school_id);
create index if not exists inventory_transactions_school_idx on public.inventory_transactions (school_id);
create index if not exists inventory_transactions_variant_idx on public.inventory_transactions (product_variant_id);
create index if not exists inventory_transactions_created_idx on public.inventory_transactions (created_at);

drop trigger if exists inventory_balances_updated_at on public.inventory_balances;
create trigger inventory_balances_updated_at before update on public.inventory_balances
for each row execute procedure public.set_updated_at();

create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on_hand integer;
  v_distributed integer;
begin
  insert into public.inventory_balances (school_id, product_variant_id, on_hand, distributed)
  values (new.school_id, new.product_variant_id, 0, 0)
  on conflict (school_id, product_variant_id) do nothing;

  select on_hand, distributed
  into v_on_hand, v_distributed
  from public.inventory_balances
  where school_id = new.school_id
    and product_variant_id = new.product_variant_id
  for update;

  v_on_hand := v_on_hand + new.on_hand_delta;

  if v_on_hand < 0 then
    raise exception 'Stock cannot go below zero.';
  end if;
  if v_distributed > v_on_hand then
    raise exception 'Distributed quantity cannot exceed available stock.';
  end if;

  update public.inventory_balances
  set on_hand = v_on_hand
  where school_id = new.school_id
    and product_variant_id = new.product_variant_id;

  return new;
end;
$$;

drop trigger if exists inventory_transactions_apply on public.inventory_transactions;
create trigger inventory_transactions_apply
after insert on public.inventory_transactions
for each row execute procedure public.apply_inventory_transaction();

grant select on public.inventory_balances to authenticated;
grant select, insert on public.inventory_transactions to authenticated;

alter table public.inventory_balances enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_balances force row level security;
alter table public.inventory_transactions force row level security;

drop policy if exists inventory_balances_select on public.inventory_balances;
create policy inventory_balances_select on public.inventory_balances
for select to authenticated
using (public.app_is_school_staff(school_id));

drop policy if exists inventory_transactions_select on public.inventory_transactions;
create policy inventory_transactions_select on public.inventory_transactions
for select to authenticated
using (public.app_is_school_staff(school_id));

drop policy if exists inventory_transactions_insert_admin on public.inventory_transactions;
create policy inventory_transactions_insert_admin on public.inventory_transactions
for insert to authenticated
with check (
  public.app_is_school_admin(school_id)
  and created_by = auth.uid()
  and reason in ('stock_in', 'adjustment')
);
