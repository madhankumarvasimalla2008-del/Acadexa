# Acadexa — Product Specification (Foundation)

**Status:** V1 decisions locked. **Phase 0 complete** (foundation only; live School A/B isolation blocked by insufficient tenant data — accepted exception).  
**Audience:** Product, architecture, and engineering review.  
**Updated:** 2026-08-14 — additional V1 locks: parent invite/accept, dual roles, enrollments, pack snapshots, school-admin distribution.

## 1. What Acadexa is

Acadexa is a **centralized, multi-school platform** for managing:

- School books, uniforms, and other student requirements
- Packs (bundled requirement sets)
- Parent payments
- Digital receipts with QR codes
- School inventory
- On-campus distribution of physical items

One Acadexa deployment serves **many independent schools**. Each school’s operational data is **isolated**.

## 2. What Acadexa is not

Acadexa is **not**:

- An e-commerce delivery / shipping platform
- A marketplace where items are couriered to parents
- A general school ERP (attendance, exams, fees beyond requirement packs, LMS)
- A system that trusts the browser for role, school, price, payment status, or inventory

**Collection model (V1 locked):** Parents pay online and **collect physical items at the school**. Staff scan a QR (or search a receipt), verify payment, and hand over items. **Do not add shipping or home-delivery functionality.**

## 3. Locked V1 product decisions

These are approved for V1. Do not reopen without a new product review.

### 3.1 Parent registration and linking (V1 locked)

- Parents **can create** an Acadexa account using **mobile and/or email** authentication.
- A parent **must not** gain access to a student merely by knowing a Student ID.
- School Admin **controls** parent–student linking:
  - Search for an existing parent by **mobile number or email**.
  - If the parent exists, the school can **send / attach an invitation**.
  - If the parent does not exist, the school can **invite them to create an account**.
  - The parent must **accept / confirm** the relationship **before** seeing the child’s information.
- Invited-but-not-accepted links do **not** grant parent data access.

### 3.2 Parent–student relationships

- **Many-to-many:** multiple parents/guardians per student; multiple children per parent.
- A child can have multiple authorized parents/guardians.

### 3.3 Student onboarding

- School Admin can add students **manually**.
- School Admin can **bulk import** students via CSV/Excel.
- Student–parent relationships are **established by the school**.

### 3.3a Multiple roles on one account (V1 locked)

- A single login **may** hold multiple roles (e.g. parent **and** school staff).
- Permissions stay **role-based** and **school-scoped**.
- A parent hat at School B must **never** grant staff access to School A, or vice versa.
- UI should use an explicit **workspace / role context** (platform vs school vs parent).

### 3.3b School Admin distribution (V1 locked)

- School Admins **may** use distribution functionality.
- Distribution Staff get a **restricted desk** (QR scan, receipt/student lookup, item distribution, pending lists).
- School Admins may have **both** admin and distribution capabilities. Full desk UI is **not** Phase 0.

### 3.3c Academic years and enrollment (V1 locked)

- Students use **enrollment records**. Do **not** overwrite a student’s class in place as the only history.
- Example: Rahul → 2025–26 Class 5; 2026–27 Class 6; 2027–28 Class 7.
- Support academic years, school-specific class enrollment, and historical records.
- Design FKs so **mid-year transfers are possible later**; do **not** build transfer workflows in Phase 0.

### 3.4 Pack purchases

- Parents purchase **available packs** for a linked child.
- Supported pack types: **Book Pack**, **Uniform Pack**, **Complete Pack**, **Custom Pack**.
- School Admin controls pack configuration: **required/optional**, items, quantities, **uniform sizes/variants**, **repeat purchase**.
- **Default:** prevent accidental **duplicate purchases of the same required pack**.
- The school can **configure** whether a given pack **allows repeat purchases**.
- After successful payment, the purchase is a **historical snapshot**. Later edits to the live pack **must not** change an already-paid receipt or purchase.

### 3.5 Inventory reservation

- Selecting a pack **does not** permanently deduct or reserve inventory.
- A **pending** payment must **not** permanently consume inventory. Reservation happens **only** after successful **server-side** payment verification.
- After **successful server-side payment verification**:
  - required inventory is **reserved**
  - payment is recorded **successful**
  - **digital receipt** is generated
- When staff **physically distributes** an item:
  - reserved quantity **decreases**
  - distributed quantity **increases**
  - an **inventory transaction** is recorded

### 3.6 Stock protection

- Acadexa **prevents overselling**.
- If sufficient stock is unavailable, the pack is **not purchasable**, unless the school has **explicitly configured an alternative policy**.
- Show **availability / low-stock** information to parents and school users as appropriate.

### 3.7 Payment architecture

- Payments are **gateway-independent** at the application layer.
- **Initial Indian gateway: Razorpay.**
- Development uses **sandbox / test mode**.
- Never trust client-side payment success.
- Payment status is verified **server-side** with the gateway.
- **Do not hardcode** payment credentials (environment variables only).

### 3.8 Refunds

- Refunds are **first-class records** in Acadexa.
- Refunds are **synchronized with the payment gateway** where the gateway supports it.
- Refunds must update **payment status** and **release applicable inventory reservations**.

### 3.9 Receipts / GST

V1 digital payment receipt includes:

- Receipt ID, student, school, class, academic year
- Pack, items, quantities
- Amount, payment status, date
- QR code (opaque token; no PII in the payload)

The data model **must be capable** of holding GST/tax fields when a school requires them. **GST-compliant invoicing is not mandatory for V1** unless a school specifically requires it.

### 3.10 Notifications

**V1 channels:** in-app notifications, email.  
**Future-ready (do not build as V1 delivery):** WhatsApp, SMS.

**V1 event types (at least):**

- Payment successful
- Receipt generated
- Collection reminder
- Partial collection
- Remaining items available
- Refund / payment updates

### 3.11 Multi-school architecture

- Multi-tenant platform; **isolated school data**.
- School Admin A must never access School B’s students, parents, requirements, packs, inventory, payments, receipts, or distribution records.
- Isolation via **school/tenant context + Supabase RLS**, not frontend-only checks.

### 3.12 Parent multi-school

- A parent account **may** have children at **different schools**.
- Selecting a child loads that child’s **school, academic year, and class** data only.

### 3.13 Business model

- Not a delivery/e-commerce platform.
- Pay online, collect at school.

## 4. Actors and goals

| Role | Primary goal |
| --- | --- |
| Super Admin | Operate the platform: schools, school administrators, platform-wide visibility |
| School Admin | Configure a school year: classes, students (manual + import), parent–student links, products, quantities, packs, inventory, payments, refunds, distribution, reports |
| Distribution Staff | Verify paid receipts and record what was physically given (including partial handovers) |
| Parent | Create account; after school-approved links, select a child, see that child’s class requirements, choose a pack, pay, receive a digital receipt + QR, track collection status |

After a child is selected, all requirement/pack/payment views are scoped to **that child’s school, academic year, and class**.

## 5. Core operational flow

```
School Admin
  → Academic year
  → Classes
  → Students (manual and/or CSV/Excel import)
  → Parent–student links (school-controlled)
  → Requirements + quantities
  → Packs (type + repeat-purchase policy + stock policy)
  → Inventory (on-hand)

Parent
  → Create account (mobile/email)
  → Login
  → See only school-approved children
  → Select child (loads that child’s school/year/class)
  → View class requirements
  → Select pack (no stock reservation yet)
  → Pay online (Razorpay sandbox in development; server-verified)
  → On verified success: reserve stock + digital receipt + QR

Distribution Staff
  → Scan QR or search student/receipt
  → Verify payment (server-side status, not client claim)
  → View pack contents
  → Give physical items
  → Record quantities distributed (full or partial)
  → reserved ↓, distributed ↑, inventory transaction
  → Distribution status update
```

## 6. Functional domains (V1)

1. **Platform administration** — schools, school admins, platform health/overview.
2. **School academic structure** — academic years, classes, students, school-approved parent–student links.
3. **Student import** — CSV/Excel bulk create (school-scoped).
4. **Catalog** — products (books, uniforms, other), variants (size, edition, etc. where needed).
5. **Requirements** — class needs for an academic year, with required quantities.
6. **Packs** — typed bundles (book / uniform / complete / custom), price, repeat-purchase flag, availability.
7. **Inventory** — on-hand, reserved, distributed; append-only transactions.
8. **Orders and payments** — gateway-agnostic core; Razorpay adapter; server-side verification.
9. **Refunds** — Acadexa records + gateway sync; reservation release.
10. **Receipts** — digital receipt + QR; optional tax fields for later GST use.
11. **Distribution** — full and partial; remaining items later.
12. **Notifications** — in-app + email; channel abstraction for later SMS/WhatsApp.
13. **Audit** — money, stock, links, distribution.
14. **Reporting** — school-scoped operational reports (exact report list still open).

## 7. Inventory semantics (V1 locked)

Distinguish, and never collapse into one mutable integer:

| Concept | Meaning |
| --- | --- |
| Required quantity | What the school says a class/student/pack needs |
| Available / sellable stock | On-hand not already reserved (used for oversell checks) |
| Paid / reserved quantity | Paid but not yet fully handed over |
| Distributed quantity | Physically given and recorded |
| Remaining quantity | Still owed to the student/order (e.g. 2 of 10 left) |

**Select pack:** no reservation.  
**Verified payment:** reserve.  
**Physical distribute:** reserved decreases, distributed increases, transaction row.

Partial example: pack has 10 items, school gives 8 → **8 / 10**, status **PARTIALLY_DISTRIBUTED**; the remaining 2 can be distributed later.

**Oversell:** checkout is blocked when sellable stock cannot cover the pack, unless that school/pack has an explicit alternative policy configured.

## 8. Payments (V1 locked)

- Application code talks to a **payment provider interface**, not Razorpay types throughout the domain.
- **Razorpay** is the first adapter; credentials only in env vars.
- Development: **Razorpay test/sandbox**.
- Success is valid only after **server-side verification** (webhook and/or gateway fetch), never because the client said so.
- Order records associate at least: parent, student, school, academic year, class, pack, amount, payment status, gateway reference.

Amounts, pack contents, and prices used at charge time are resolved **on the server** from school-owned records.

Refunds are stored in Acadexa and submitted to the gateway when supported; they must not leave reservations dangling.

## 9. Digital receipts and QR (V1 locked)

See §3.9. QR payload is a **secure reference / token**. Lookup happens server-side after authentication and authorization.

## 10. Security principles (non-negotiable)

- Authentication via Supabase Auth (email and/or mobile as configured).
- Authorization via roles + school membership + **approved** parent–student links + RLS.
- Never trust client-provided: user role, school ID, payment status, price, inventory quantity, distribution status.
- Validate with Zod on the server (and forms on the client for UX).
- Secrets only in environment variables.
- School-level isolation for all school-owned records.
- Audit logging for sensitive mutations.

## 11. Platforms

The product must be responsive: **mobile, tablet, laptop, desktop**. Distribution staff and parents are expected to use phones heavily (QR scan, pay, receipt).

## 12. Explicitly out of scope (this phase and V1 product)

**This planning phase:** no application code, no migrations, no dependency installs for the app.

**V1 product:**

- Shipping, courier, address checkout, delivery tracking
- Parent self-claim of students by ID
- GST-compliant invoicing as a mandatory platform feature (schema may still hold tax fields)
- WhatsApp / SMS as V1 notification delivery (architecture may reserve channel types)

## 13. Remaining product decisions

Items still unclear are listed in [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) §5. Do not invent rules for them.

## 14. Related documents

| Document | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, routes, folders, modules |
| [DATABASE.md](./DATABASE.md) | Entities, relationships, inventory/payment models |
| [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) | Auth, RBAC, RLS |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | Phases, risks, remaining decisions |
