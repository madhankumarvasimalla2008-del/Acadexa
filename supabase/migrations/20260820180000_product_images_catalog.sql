-- Parent catalog phase: product images, descriptions, availability function.
-- Additive only — does not alter existing RLS, triggers, or business logic.
-- Reuses existing products (id, school_id) composite key from phase2_school_requirements.

-- 1. Add description column to products (nullable, backward-compatible).
alter table public.products add column if not exists description text;

-- 2. Product images table (multiple images per product, one primary).
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  product_id uuid not null,
  storage_path text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

-- Idempotent constraint helper (session-scoped, same pattern as all other migrations).
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

-- Composite FK: (product_id, school_id) → products (id, school_id).
select pg_temp.app_add_constraint(
  'alter table public.product_images add constraint product_images_product_school_fkey
     foreign key (product_id, school_id)
     references public.products (id, school_id)
     on delete cascade'
);

-- One primary image per product (partial unique index).
create unique index if not exists product_images_primary_uidx
  on public.product_images (product_id, school_id)
  where is_primary;

create index if not exists product_images_product_idx
  on public.product_images (product_id);
create index if not exists product_images_school_idx
  on public.product_images (school_id);

-- 3. RLS on product_images.
alter table public.product_images enable row level security;
alter table public.product_images force row level security;

grant select, insert, update, delete on public.product_images to authenticated;

-- SELECT: same chain as products (staff OR parent via requirement/enrollment chain).
drop policy if exists product_images_select on public.product_images;
create policy product_images_select on public.product_images
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
    where pv.product_id = product_images.product_id
      and pv.school_id = product_images.school_id
      and public.app_parent_can_access_student(se.student_id)
  )
);

-- CUD: school admin only.
drop policy if exists product_images_insert_admin on public.product_images;
create policy product_images_insert_admin on public.product_images
for insert to authenticated
with check (public.app_is_school_admin(school_id));

drop policy if exists product_images_update_admin on public.product_images;
create policy product_images_update_admin on public.product_images
for update to authenticated
using (public.app_is_school_admin(school_id))
with check (public.app_is_school_admin(school_id));

drop policy if exists product_images_delete_admin on public.product_images;
create policy product_images_delete_admin on public.product_images
for delete to authenticated
using (public.app_is_school_admin(school_id));

-- 4. Supabase Storage bucket for product images.
-- Public bucket: anyone can read image URLs (required for <img> tags).
-- Write access controlled by storage policies (school admin only).
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-images', 'product-images', true, 5242880)
on conflict (id) do nothing;

-- Storage policies: school admin can upload/update/delete within their school folder.
-- Path convention: {school_id}/{product_id}/{filename}
drop policy if exists product_images_storage_insert on storage.objects;
create policy product_images_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.app_is_school_admin(((storage.foldername(name))[1])::uuid)
);

drop policy if exists product_images_storage_update on storage.objects;
create policy product_images_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.app_is_school_admin(((storage.foldername(name))[1])::uuid)
);

drop policy if exists product_images_storage_delete on storage.objects;
create policy product_images_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.app_is_school_admin(((storage.foldername(name))[1])::uuid)
);

-- 5. Server-side availability function.
-- Returns a label string, never raw stock quantities.
-- Uses security definer to read inventory_balances (staff-only RLS).
-- Called from server-side code only (catalog-queries.ts).
create or replace function public.product_variant_availability(
  p_school_id uuid,
  p_variant_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when ib.on_hand is null or ib.on_hand <= 0 then 'out_of_stock'
      when (ib.on_hand - ib.distributed) <= 5 then 'low_stock'
      else 'in_stock'
    end
  from public.inventory_balances ib
  where ib.school_id = p_school_id
    and ib.product_variant_id = p_variant_id;
$$;

-- Do not expose this function to the public role; only authenticated + service role.
revoke all on function public.product_variant_availability(uuid, uuid) from public;
grant execute on function public.product_variant_availability(uuid, uuid) to authenticated;
