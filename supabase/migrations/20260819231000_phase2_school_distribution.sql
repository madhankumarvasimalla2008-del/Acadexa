-- Phase 2 foundation: school distribution ledger.
-- Reuses successful orders, order_items, and inventory_transactions.
-- Does not add QR, receipts, parent collection, or a second inventory system.

create table if not exists public.distribution_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  order_id uuid not null,
  order_item_id uuid not null,
  product_variant_id uuid not null,
  quantity integer not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
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

select pg_temp.app_add_constraint('alter table public.distribution_events add constraint distribution_events_id_school_key unique (id, school_id)');
select pg_temp.app_add_constraint(
  'alter table public.distribution_events add constraint distribution_events_order_school_fkey foreign key (order_id, school_id) references public.orders (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.distribution_events add constraint distribution_events_item_school_fkey foreign key (order_item_id, school_id) references public.order_items (id, school_id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.distribution_events add constraint distribution_events_variant_school_fkey foreign key (product_variant_id, school_id) references public.product_variants (id, school_id) on delete restrict'
);

create index if not exists distribution_events_school_idx on public.distribution_events (school_id);
create index if not exists distribution_events_order_idx on public.distribution_events (order_id);
create index if not exists distribution_events_item_idx on public.distribution_events (order_item_id);
create index if not exists distribution_events_created_idx on public.distribution_events (created_at);

alter table public.inventory_transactions
  add column if not exists distributed_delta integer not null default 0;

alter table public.inventory_transactions
  add column if not exists distribution_event_id uuid;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.inventory_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%on_hand_delta <> 0%'
  loop
    execute format('alter table public.inventory_transactions drop constraint %I', r.conname);
  end loop;
end;
$$;

select pg_temp.app_add_constraint(
  'alter table public.inventory_transactions add constraint inventory_transactions_delta_nonzero_check check (on_hand_delta <> 0 or distributed_delta <> 0)'
);
select pg_temp.app_add_constraint(
  'alter table public.inventory_transactions add constraint inventory_transactions_distribute_shape_check check (
    (reason <> ''distribute'' and distributed_delta = 0 and distribution_event_id is null)
    or (reason = ''distribute'' and distributed_delta > 0 and on_hand_delta = 0 and distribution_event_id is not null)
  )'
);
select pg_temp.app_add_constraint(
  'alter table public.inventory_transactions add constraint inventory_transactions_distribution_event_fkey foreign key (distribution_event_id) references public.distribution_events (id) on delete restrict'
);
select pg_temp.app_add_constraint(
  'alter table public.inventory_transactions add constraint inventory_transactions_distribution_event_key unique (distribution_event_id)'
);

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

  v_on_hand := v_on_hand + coalesce(new.on_hand_delta, 0);
  v_distributed := v_distributed + coalesce(new.distributed_delta, 0);

  if v_on_hand < 0 then
    raise exception 'Stock cannot go below zero.';
  end if;
  if v_distributed < 0 then
    raise exception 'Distributed quantity cannot go below zero.';
  end if;
  if v_distributed > v_on_hand then
    raise exception 'Distributed quantity cannot exceed available stock.';
  end if;

  update public.inventory_balances
  set on_hand = v_on_hand,
      distributed = v_distributed
  where school_id = new.school_id
    and product_variant_id = new.product_variant_id;

  return new;
end;
$$;

create or replace function public.apply_distribution_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_status public.payment_status;
  v_paid_qty integer;
  v_item_order_id uuid;
  v_item_variant uuid;
  v_already integer;
  v_on_hand integer;
  v_distributed integer;
begin
  if new.quantity <= 0 then
    raise exception 'Cannot distribute a negative quantity.';
  end if;

  select payment_status
  into v_payment_status
  from public.orders
  where id = new.order_id
    and school_id = new.school_id
  for update;

  if v_payment_status is null then
    raise exception 'Order was not found for this school.';
  end if;
  if v_payment_status <> 'successful' then
    raise exception 'Only successfully paid orders can be distributed.';
  end if;

  select quantity, order_id, product_variant_id
  into v_paid_qty, v_item_order_id, v_item_variant
  from public.order_items
  where id = new.order_item_id
    and school_id = new.school_id
  for update;

  if v_paid_qty is null then
    raise exception 'That item is not on this paid order.';
  end if;
  if v_item_order_id <> new.order_id or v_item_variant <> new.product_variant_id then
    raise exception 'That item is not on this paid order.';
  end if;

  select coalesce(sum(quantity), 0)
  into v_already
  from public.distribution_events
  where order_item_id = new.order_item_id
    and school_id = new.school_id
    and id <> new.id;

  if v_already + new.quantity > v_paid_qty then
    raise exception 'Distributed quantity cannot exceed the paid quantity.';
  end if;

  insert into public.inventory_balances (school_id, product_variant_id, on_hand, distributed)
  values (new.school_id, new.product_variant_id, 0, 0)
  on conflict (school_id, product_variant_id) do nothing;

  select on_hand, distributed
  into v_on_hand, v_distributed
  from public.inventory_balances
  where school_id = new.school_id
    and product_variant_id = new.product_variant_id
  for update;

  if (coalesce(v_on_hand, 0) - coalesce(v_distributed, 0)) < new.quantity then
    raise exception 'Distributed quantity cannot exceed available inventory.';
  end if;

  insert into public.inventory_transactions (
    school_id,
    product_variant_id,
    reason,
    on_hand_delta,
    distributed_delta,
    note,
    created_by,
    distribution_event_id
  )
  values (
    new.school_id,
    new.product_variant_id,
    'distribute',
    0,
    new.quantity,
    new.note,
    new.created_by,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists distribution_events_apply on public.distribution_events;
create trigger distribution_events_apply
after insert on public.distribution_events
for each row execute procedure public.apply_distribution_event();

grant select, insert on public.distribution_events to authenticated;

alter table public.distribution_events enable row level security;
alter table public.distribution_events force row level security;

drop policy if exists distribution_events_select on public.distribution_events;
create policy distribution_events_select on public.distribution_events
for select to authenticated
using (public.app_is_school_staff(school_id));

drop policy if exists distribution_events_insert_staff on public.distribution_events;
create policy distribution_events_insert_staff on public.distribution_events
for insert to authenticated
with check (
  public.app_is_school_staff(school_id)
  and created_by = auth.uid()
  and quantity > 0
);
