# Acadexa — Authentication, Roles, and RLS

**Status:** Planning only.  
**Rule:** Frontend hides buttons. PostgreSQL RLS and server checks **forbid** cross-school access.  
**V1 decisions:** [ACADEXA_SPEC.md](./ACADEXA_SPEC.md) §3.

## 1. Authentication strategy (V1 locked)

- **Provider:** Supabase Auth.
- **Parents:** may **create an account** using **mobile and/or email** authentication.
- **Session:** Next.js cookie-based server client; browser uses anon key + user JWT.
- **Profile:** Trigger on `auth.users` insert creates `profiles`.
- Signup **does not** create `parent_students` rows.

**Student linking (V1 locked):**

| Allowed | Not allowed |
| --- | --- |
| School Admin searches parent by **email or mobile** (exact match, not a global directory dump) | Parent claims a student by entering a Student ID |
| Invite existing parent **or** invite a new email/phone to register | Access to child data while status is only `invited` |
| Parent **accepts** invitation → `accepted` → child access | Treating any `profiles` row as linked without an accepted row |
| Multiple accepted guardians per student | Cross-school staff access via a parent hat |

School Admin **initiates** invites. Parent **confirms**. Server and RLS both require `status = accepted` for parent reads.

## 2. Role strategy

| Product role | Stored where | Scope |
| --- | --- | --- |
| Super Admin | `user_roles.role = super_admin` | Platform |
| School Admin | `school_memberships.role = school_admin` | That school only |
| Distribution Staff | `school_memberships.role = distribution_staff` | That school only |
| Parent | Approved rows in `parent_students` | Each linked student (hence that student’s school) |

**Do not** store `role` or `school_id` in a form field as authorization input.

**Do not** use a single `profiles.role` + `profiles.school_id` as the only model: it breaks multi-school parents.

### 2.1 Multiple hats (V1 locked)

A single account **may** be parent and school staff (possibly at different schools). Permissions are evaluated from:

- `user_roles` (super admin)
- `school_memberships` for the **active school**
- accepted `parent_students` for **parent workspace**

A staff role at School A must not read School B. A parent workspace must not use staff RLS. Phase 0 provides a **workspace switcher** foundation (platform / school / parent) without full portals.

### 2.2 Authorization checks (every mutation)

1. Identify `auth.uid()`.
2. Resolve **active context** (platform vs school X vs parent-child Y).
3. Load target row by id **and** verify `school_id` / **approved** student link.
4. Ignore client-sent role and school id.

Parent pack purchase: student must be approved for this parent; pack must belong to that student’s school, academic year, and class; price and stock from DB.

Distribution: receipt loaded by token/id; staff membership on `receipt.school_id`; order paid; qty ≤ remaining.

## 3. Permission matrix (V1)

Legend: **F** = full; **R** = read; **—** = none; **Own** = approved children / own profile.

| Resource | Super Admin | School Admin | Dist. Staff | Parent |
| --- | --- | --- | --- | --- |
| Schools (create/suspend) | F | — | — | — |
| Own school profile | R | F (limited fields) | R | R (child’s school name) |
| School admins | F | — | — | — |
| Distribution staff | R (ops) | F for own school | — | — |
| Academic years, classes | R (ops) | F | R needed for search | R child’s |
| Students (manual + import) | R (ops, minimize PII) | F | R (search/distribute) | Own approved children |
| Parent–student links | R | **F (school-controlled)** | R limited | R own approved; **no insert** |
| Products, requirements, packs | R | F | R pack contents | R published packs/requirements for child’s class |
| Inventory | R | F | R + distribute posting | — (see availability display on packs, not raw ledger) |
| Orders/payments | R | R (not forge paid) | R for desk | Own orders |
| Mark payment paid | Webhook/service only | — | — | — |
| Refunds | R / ops tools TBD | Initiate per remaining decision | — | R own refund status |
| Receipts | R | R | R for school | Own |
| Distribution write | — | F (same school; desk UI later) | F | — |
| Reports | Platform | School | Limited desk lists | Own status |
| Audit logs | Platform | School | — | — |
| Notifications | ops | school | desk relevant | own in-app |

**Locked:** School Admins may perform distribution for their school. Distribution Staff see a restricted desk only (UI in a later phase).

**Still open:** Super Admin depth of PII access. Who may **initiate** refunds.

## 4. Route-level gates (defense in depth)

| Route group | Allowed if |
| --- | --- |
| `/register` | Unauthenticated parent signup |
| `/platform/*` | `super_admin` |
| `/school/*` | `school_admin` for that school |
| `/desk/*` | `distribution_staff` **or** `school_admin` for that school |
| `/parent/*` | Authenticated; child routes require **accepted** `parent_students` |

Gates are **in addition to RLS**.

## 5. Supabase RLS strategy (V1 locked isolation)

### 5.1 Helper functions

- `app_is_super_admin()`
- `app_school_ids_for_roles(roles text[])`
- `app_is_school_admin(school_id)`
- `app_is_school_staff(school_id)` — admin or distribution
- `app_parent_can_access_student(student_id)` — **accepted** link only
- `app_parent_school_ids()` — schools of **accepted** students

### 5.2 Policy patterns

**School-owned tables** (students, packs, inventory, orders, receipts, distribution, import jobs, …):

```text
SELECT: app_is_super_admin() OR app_is_school_staff(school_id)
        OR parent policies per table (approved child only)

INSERT/UPDATE/DELETE: app_is_school_admin(school_id)
        — except distribution_* also app_is_school_staff
        — except orders insert: parent of student (approved) AND student.school_id = orders.school_id
        — parent_students INSERT/UPDATE: school admin of that school only
```

School Admin A **fails** RLS for School B `school_id` even with a valid-looking UUID.

**`parent_students`:**

- Parent: `SELECT` where `parent_id = auth.uid()` (see own invites + accepted links). Child **data** only if `status = accepted`.
- School admin: full for `school_id` they administer.
- Parent: **no INSERT, no UPDATE** to attach students.

**`orders` / `receipts`:**

- Parent: select own `parent_id`.
- Staff: `app_is_school_staff(school_id)`.
- Insert order: parent + approved student + matching school/year/class on server.
- `paid` updates: **service role after gateway verify only**.

**`payment_transactions` / `refund_transactions`:**

- Insert/update: service role (webhook / refund worker).
- Read: own/school as above.

**`inventory_transactions`:**

- Insert: service role on payment/refund; school staff on distribute/stock-in.
- No user UPDATE/DELETE (append-only).

**`notifications`:**

- User selects own rows.
- Insert: service role or definer function after domain events.

### 5.3 Storage RLS

- Paths prefixed `school_id/...` (imports, receipts).
- Staff of that school; parent only for own receipt objects.
- Import files: school admin of that school only.

### 5.4 Service role usage

Server only:

- Payment webhook (mark paid, reserve stock, issue receipt, notify)
- Refund confirmation (status + release reservation)
- Profile creation if not a SQL trigger
- Email send orchestration if required

Never take `school_id`, `amount`, or `payment_status` from the client as truth.

### 5.5 JWT custom claims

Table-based RLS first. Optional claims later if needed.

## 6. Input validation vs authorization

| Input | Client | Server |
| --- | --- | --- |
| Email / mobile | Form | Supabase Auth |
| Student ID to “claim” | Must not be offered as self-serve attach | Reject parent-initiated link |
| Selected student | UI | Approved `parent_students` |
| Pack id | UI | Child’s school/year/class; price from row; duplicate + stock rules |
| Pay amount | Display only | Pack snapshot |
| Payment status | Show DB value | Gateway verify |
| Distributed qty | Form | `0 < qty ≤ remaining` |
| School id | Never trusted | Membership / student |

## 7. QR token security

- High-entropy opaque token on `receipts`.
- QR encodes only the token (or a staff-auth URL).
- Unauthenticated lookup must not return PII.
- Rate-limit desk token resolution.

## 8. Audit

Log at least: membership changes, parent–student approve/revoke, student imports, pack price/policy changes, inventory adjustments, payment and refund transitions, distribution posts, receipt issuance.

No card/gateway secrets in logs.
