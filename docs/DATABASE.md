# Acadexa — Database Design

**Status:** Planning only. **No migrations in this phase.**  
**Tenancy rule (V1 locked):** Every school-owned row carries `school_id`. Parents span schools via **school-approved** `parent_students`.  
**V1 decisions:** [ACADEXA_SPEC.md](./ACADEXA_SPEC.md) §3.

## 1. Design principles

1. **Shared schema, tenant column** — not a database-per-school at V1.
2. **Append-only money and stock history** — balances are projections of transactions.
3. **Server is source of truth** for price, payment status, remaining distribution qty.
4. **UUIDs** for public identifiers; human-readable receipt numbers as a separate unique field.
5. Prefer `status` / `archived_at` for schools, students, packs rather than deleting paid history. Hard-delete policy for mistaken imports is still open.
6. **Do not store payment success without a gateway-verified event.**
7. **Do not reserve stock on pack selection.** Reserve only after verified payment. Release reservation on applicable refunds.

Suggested PostgreSQL types: `uuid`, `timestamptz`, `numeric(12,2)` for money (INR), `integer` for item quantities.

## 2. Entity list

### 2.1 Identity and tenancy

| Entity | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users`; display name, phone, email, account status; **not** a single `school_id` |
| `user_roles` | Global role flags (e.g. `super_admin`) |
| `schools` | Tenant; name, code, status, contact |
| `school_memberships` | User ↔ school ↔ school-scoped role (`school_admin`, `distribution_staff`) |
| `audit_logs` | Actor, school (nullable for platform), action, entity, metadata |

`auth.users` remains Supabase-managed. Application tables reference `auth.users.id` / `profiles.id`.

### 2.2 Academic structure and people (V1)

| Entity | Purpose |
| --- | --- |
| `academic_years` | Per school; label, start/end, optional `is_current` |
| `classes` | Per school; reusable across years via enrollments |
| `students` | Per school identity; **not** the place to overwrite historical class |
| `student_enrollments` | `school_id` + `student_id` + `academic_year_id` + `class_id` + status; preserves year-by-year class (Rahul: 2025–26 Class 5, …) |
| `parent_students` | Invite/accept many-to-many; statuses `invited` \| `accepted` \| `revoked` |
| `student_import_jobs` | School-scoped CSV/Excel import (table in Phase 0 optional; UI later) |

Parents **self-register** (auth). **Links are not created at signup.** School Admin **invites** by email/phone (existing user or new). Parent must **accept** before RLS grants child access. `parent_id` may be null until the invitee registers.

**V1 locked:** multiple parents per student; multiple students per parent; children may be at different schools.

### 2.3 Catalog and requirements

| Entity | Purpose |
| --- | --- |
| `products` | School-scoped item; `kind`: `book` \| `uniform` \| `other` |
| `product_variants` | Size, edition, SKU, attributes JSON |
| `school_requirements` | School + academic year + class + variant + **required_quantity** |
| `packs` | Named bundle; school, year, class; **price_amount**; **pack_type**; repeat and stock policies |
| `pack_items` | Pack → variant + quantity |

**V1 pack types (locked):** `book_pack` \| `uniform_pack` \| `complete_pack` \| `custom_pack`.

**V1 duplicate purchases (locked):** by default a student cannot buy the same **required** pack twice. Pack-level `allows_repeat_purchase` (boolean, default `false`) lets the school allow repeats.

Catalog is **per school** for isolation (School A products are not School B’s). A shared ISBN master is **not** a V1 requirement.

### 2.4 Inventory

| Entity | Purpose |
| --- | --- |
| `inventory_balances` | Projection per school + variant: `on_hand`, `reserved`, `distributed` (or distributed from ledger) |
| `inventory_transactions` | Immutable ledger |

Do not treat balances as staff-typed overwrites.

**Sellable quantity (oversell check):**

```
sellable = on_hand - reserved
```

A pack is purchasable only if every line’s `qty` fits in `sellable`, unless `packs.allow_purchase_when_insufficient_stock` (or equivalent school/pack policy) is **explicitly true**. Default: **false** (prevent overselling).

Selecting a pack does **not** write inventory rows.

### 2.5 Orders, payments, receipts, refunds

| Entity | Purpose |
| --- | --- |
| `orders` | Buy a pack for a student; amounts snapshotted **on server** |
| `payment_transactions` | Gateway attempts; provider name; gateway ids; idempotency keys |
| `refunds` | Acadexa refund records linked to order/payment |
| `refund_transactions` | Gateway refund attempts/results |
| `receipts` | Issued only after verified success; receipt number; QR token |
| `receipt_items` | Snapshot of pack lines at payment |
| `receipt_tax_lines` | **Optional / nullable** GST or tax breakdown for schools that need it later; unused in default V1 receipts |

Provider column (e.g. `razorpay`) keeps the core gateway-independent.

### 2.6 Distribution

| Entity | Purpose |
| --- | --- |
| `distribution_records` | One handover event |
| `distribution_items` | Variant + quantity given |

Distribution status is **derived** from summed items vs receipt items.

### 2.7 Notifications

| Entity | Purpose |
| --- | --- |
| `notifications` | In-app rows: user, school (nullable), type, payload, read_at |
| `notification_deliveries` | Per channel attempt: `in_app` \| `email` \| (later `sms` \| `whatsapp`); status |

V1 sends **in-app + email** for the locked event types.

## 3. Relationships (logical)

```
auth.users 1──1 profiles
profiles 1──* user_roles
profiles 1──* school_memberships *──1 schools
schools 1──* academic_years
schools 1──* classes
schools 1──* students
schools 1──* student_import_jobs
schools 1──* products 1──* product_variants
schools 1──* school_requirements
schools 1──* packs 1──* pack_items
schools 1──* inventory_balances
schools 1──* inventory_transactions
schools 1──* orders 1──* payment_transactions
orders 1──* refunds 1──* refund_transactions
orders 1──0..1 receipts 1──* receipt_items
receipts 1──* receipt_tax_lines          -- optional GST-capable
receipts 1──* distribution_records 1──* distribution_items
profiles (parent) 1──* parent_students *──1 students
orders *──1 students
orders *──1 packs
orders *──1 profiles (parent)
profiles 1──* notifications
notifications 1──* notification_deliveries
```

**Cardinality (V1 locked):**

- One parent, many students, possibly many schools.
- One student, **many** approved parents/guardians.
- One order: one pack, one student, one parent payer, one school, one academic year, one class (denormalized FKs).
- One paid order: one receipt. Many `payment_transactions` per order (retries).
- Many refunds per order (partial refunds **if** offered — partial vs full still open).
- Many distribution events per receipt.

## 4. Recommended columns (selected)

Not a full DDL.

### 4.1 `schools`

- `id`, `name`, `code` (unique), `status` (`active` \| `suspended` \| …), `created_at`

### 4.2 `school_memberships`

- `id`, `school_id`, `user_id`, `role` (`school_admin` \| `distribution_staff`)
- Unique `(school_id, user_id, role)` or unique `(school_id, user_id)` if one role per school — **still open**

### 4.3 `parent_students` (V1 locked)

- `student_id`, `school_id` (from student)
- `parent_id` nullable until the invited person has an account
- `invited_email`, `invited_phone`
- `invite_token` (opaque; not a student id)
- `status`: `invited` \| `accepted` \| `revoked`
- `invited_by`, `accepted_at`
- Parent **SELECT** of child data only when `status = accepted` and `parent_id = auth.uid()`
- Parent may **UPDATE** own invite `invited` → `accepted` (token + matching email/phone verified server-side)
- Parent **cannot INSERT** a row and **cannot** accept by student ID
- School admin: insert invites for their school only

### 4.4 `students` and `student_enrollments`

- `students`: `school_id`, `student_code` unique per school, name, status — **no single current class column as source of truth**
- `student_enrollments`: `school_id`, `student_id`, `academic_year_id`, `class_id`, `status` (`active` \| `completed` \| `withdrawn`; leave room for future `transferred`)
- Unique `(student_id, academic_year_id)` in V1 (one class per year); mid-year transfer can relax this later without rewriting students
- Current class = enrollment for the school’s current academic year, not an overwritten field on `students`

### 4.5 `packs` (V1 locked)

- `school_id`, `academic_year_id`, `class_id`, `name`
- `pack_type`: `book_pack` \| `uniform_pack` \| `complete_pack` \| `custom_pack`
- `price_amount`, `currency` (`INR`), `status` (published/archived, etc.)
- `allows_repeat_purchase` boolean **default false**
- `allow_purchase_when_insufficient_stock` boolean **default false** (alternative oversell policy)
- Optional: `is_required` if “required pack” is distinct from pack type — **still open** whether required is a flag or inferred from type

Duplicate rule (server, not only unique index): if `allows_repeat_purchase` is false, reject a new **paid or pending** order for the same `(student_id, pack_id)` (whether pending counts toward the lock is **still open** — recommend blocking a second pending as well to prevent double checkout).

### 4.6 `orders`

- `school_id`, `academic_year_id`, `class_id`, `student_id`, `parent_id`, `pack_id`
- `amount`, `currency`
- `status`: include at least `pending` \| `paid` \| `failed` \| `cancelled` \| `refunded` \| `partially_refunded` (exact set can be refined)
- `pack_price_snapshot`, `pack_name_snapshot`, `pack_type_snapshot`
- Never set `paid` except from verified payment processor code

### 4.7 `payment_transactions`

- `order_id`, `school_id`, `provider` (`razorpay` in V1), `gateway_order_id`, `gateway_payment_id`, `status`, `amount`, `raw_event_id` (idempotency), `verified_at`

### 4.8 `refunds` / `refund_transactions`

- `order_id`, `school_id`, `amount`, `reason`, `status` (`pending` \| `processed` \| `failed`)
- Gateway refund id; idempotency key
- On `processed`: adjust order payment status; inventory `release_on_refund` for **undistributed reserved qty** affected by the refund

How much stock to release on **partial** refund is **still open** if V1 allows partial refunds.

### 4.9 `receipts`

- `order_id` unique, `school_id`, `receipt_number`, `issued_at`
- `qr_token` unique (opaque)
- Snapshots for print stability: student, school, class, academic year, pack, amount, payment status, date
- Nullable tax fields or `receipt_tax_lines` for future GST (taxable value, GSTIN, tax rate, HSN — **not required to populate in V1**)

### 4.10 `inventory_transactions`

- `school_id`, `product_variant_id`, signed `quantity_delta` and/or explicit `reserved_delta` / `on_hand_delta` / `distributed_delta`
- `reason`: `stock_in` \| `adjustment` \| `reserve_on_payment` \| `release_on_refund` \| `distribute` \| … (reversal reason still open)
- `order_id`, `refund_id`, `distribution_item_id` nullable
- `created_by`, `created_at`

### 4.11 Inventory balance fields (projection)

Per `(school_id, product_variant_id)`:

| Field | Meaning |
| --- | --- |
| `on_hand` | Physical quantity in school store |
| `reserved` | Paid, not yet distributed |
| `distributed` | Optionally stored; else sum of distribute transactions |

**Per-order remaining:**

```
remaining_for_line = receipt_item.qty - sum(distribution_items.qty for that variant)
```

Status: `not_distributed` / `partially_distributed` / `distributed`. Never allow sum > total.

## 5. Inventory posting (V1 locked)

**Pack select / browse:** no writes.

**Verified payment:**

1. Re-check sellable stock inside a DB transaction (unless alternative policy).
2. For each pack line: `reserved += qty`. **`on_hand` unchanged.**
3. Insert `inventory_transactions` (`reserve_on_payment`).
4. Issue receipt.

**Physical distribution:**

1. `reserved -= qty`
2. `on_hand -= qty`
3. distributed += qty
4. `inventory_transactions` (`distribute`)
5. Recompute distribution status

**Refund processed (undistributed remainder):**

1. Release reservation for items not yet distributed that the refund covers.
2. `inventory_transactions` (`release_on_refund`).
3. Do not automatically restock `on_hand` from items **already handed over** unless a distribution reversal exists (reversal still open).

## 6. Multi-school tenancy in the schema

| Table type | `school_id` | Access path |
| --- | --- | --- |
| School-owned operational | **Required FK** | RLS: membership |
| `profiles` | No | Self; staff via school people; not “all parents globally” |
| `parent_students` | Denormalized from student (**recommended**) | Parent: approved rows only; school admin: own school |
| `user_roles` | No | Super admin policies |
| `audit_logs` | Null for platform actions | Super admin vs school admin |

**Integrity:** composite-FK `(school_id, …)` so pack items cannot reference another school’s variant.

**Parent with children in two schools:** two students, two `school_id`s; after child select, filter by that student.

## 7. Constraints that encode V1 rules

- Parent cannot claim students: **no parent INSERT** on `parent_students`.
- Duplicate pack: application (+ partial unique index if we only count `paid` rows — design at migration time).
- Oversell: application transaction + optional CHECK cannot express pack-level policy alone; enforce in the payment Server Action with row locks on `inventory_balances`.
- Receipts only for verified paid orders (trigger or service-role-only insert).

## 8. Remaining schema-impacting questions

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) §5. Do not invent columns for unclear workflows (e.g. exact import template, enrollment history, one vs many current years, whether `is_required` is a separate pack flag).
