# Acadexa — Development Plan

**Status:** V1 decisions locked. **Phase 0 is complete** (foundation only), with an accepted exit exception for live School A/B isolation. Do not start Phase 1 automatically.  
**V1 decisions locked:** [ACADEXA_SPEC.md](./ACADEXA_SPEC.md) §3.  
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md)

## 1. Goal of the current phase

**Phase 0 is complete in the repository** (foundation only). Stop here — do not start Phase 1 automatically.

**Accepted exit exception (2026-08-17):** the Phase 0 criterion “two school admins cannot see each other’s schools” is **BLOCKED** because the live project has insufficient existing tenant data (one school; two school admins on that same school). Isolation was not proven with two school-admin sessions. This exception was accepted so Phase 0 can close **without** creating test data or changing the database.

Planning documents remain the source of V1 product rules.

## 2. Recommended development phases (after planning is accepted)

Each phase should be mergeable with migrations + RLS tests. Do not skip RLS.

### Phase 0 — Repo and platform skeleton

- Next.js App Router, TypeScript, Tailwind, shadcn/ui baseline
- Supabase project, `.env.example`, server/browser/admin clients
- Auth: login + **parent register** (email and/or mobile)
- `profiles` + `user_roles` + `schools` + `school_memberships`
- RLS helpers and policies
- Route groups and role gates
- Super Admin: create school, assign school admin

**Exit:** Two school admins cannot see each other’s schools.

**Exit verification:** **BLOCKED** (accepted exception). Live data has one school; both school admins belong to it. No test tenants were created.

### Phase 1 — Academic structure, students, school-controlled links

- Academic years, classes, students (manual)
- CSV/Excel **student import** (school-scoped)
- `parent_students` writable **only** by school admin; parent cannot claim by student ID
- Many-to-many approved guardians
- Parent sees **only approved** children; child select sets school/year/class context

**Exit:** Isolation + multi-guardian + multi-child (including two schools) tests pass. Parent cannot attach a student.

### Phase 2 — Catalog, requirements, packs

- Products, variants, kinds
- Pack types: Book / Uniform / Complete / Custom
- `allows_repeat_purchase` default false; server-side duplicate prevention
- Parent: requirements and packs for **selected child** only
- Availability / low-stock display; purchase disabled when oversell protection applies (depends on Phase 3 stock)

**Exit:** Wrong-school pack cannot be loaded; duplicate required pack blocked by default.

### Phase 3 — Inventory ledger

- Balances + transactions
- Stock inward / adjustment
- Display on-hand, reserved, distributed
- **No write on pack select**

**Exit:** Every stock change has a transaction row.

### Phase 4 — Gateway-agnostic payments + Razorpay sandbox

- `PaymentProvider` interface; **Razorpay adapter**; test/sandbox keys from env
- Create `pending` orders with server amount, stock lock, duplicate check
- Webhook signature verify + fetch payment; **never** trust client success
- On verified pay: **reserve** inventory, mark paid
- Idempotency; fail closed without webhook/verify

**Exit:** Amount tampering and client “mark paid” fail. Sandbox payment completes end-to-end.

### Phase 5 — Receipts, QR, refunds

- Receipt + QR only after verified paid
- Receipt fields per spec; nullable tax/GST columns unused by default
- Refund records + Razorpay refund API where supported; status + **reservation release**
- Notifications: payment successful, receipt generated, refund/payment updates (in-app + email)

**Exit:** QR has no PII; refund does not leave stock reserved incorrectly.

### Phase 6 — Distribution desk

- Scan + search; paid verify
- Partial distribution; reserved ↓ distributed ↑; transaction
- Notifications: partial collection, remaining items available
- Collection reminder (cadence still open — implement once decided or with a conservative default **only if product confirms**)

**Exit:** 8/10 then 2/10 works; unpaid cannot distribute.

### Phase 7 — Reports and hardening

- School reports (exact list still open)
- Platform overview
- Recharts where useful
- RLS regression, webhook replay, oversell race tests
- Rate limits

### Phase 8 — Production readiness

- Responsive QA
- Secrets review (no hardcoded Razorpay keys)
- Razorpay live keys only in production env, still webhook-verified
- PII / backup / load tests

Do not build shipping. Do not fake production payment success.

## 3. Go-live checklist (later)

- RLS forced on tenant tables
- Service role and Razorpay secrets server-only
- Webhook signature verification on
- No client-side paid bypass
- Duplicate-pack and oversell tests
- Refund + reservation-release test
- Parent cannot claim student by ID
- Multi-school parent child-switch test
- School A/B isolation test
- Partial distribution test

## 4. Important technical risks

| Risk | Mitigation |
| --- | --- |
| RLS gaps / cross-school leak | Per-table policies; School A/B tests; composite FKs |
| Parent context uses wrong school | Context = selected **student** |
| Parent self-claim | No parent INSERT on `parent_students`; no “join by student ID” API |
| Client payment success | Razorpay webhook + server fetch; ignore Checkout callback as truth |
| Hardcoded keys | Env only; `.env.example` empty values |
| Double pay / double reserve | Idempotent `raw_event_id`; unique receipt per order |
| Oversell race | Lock inventory rows in the pay-verify transaction |
| Select-pack deducts stock | No inventory writes until verified payment |
| Refund leaves reservation | `release_on_refund` for undistributed qty |
| QR PII | Opaque token; auth on resolve |
| Email/SMS mix-up | V1: in-app + email only; other channels not implemented |
| Import assigns students to wrong school | School id from membership, never from CSV column as authority |

## 5. Remaining product decisions (not invented)

V1 locked items are **not** listed here. The following are still unclear:

### Identity and access

1. Parent auth details: email+password, email OTP, mobile OTP, or combination in V1? (Phase 0 uses email+password as the Auth foundation; extra OTP methods later if requested.)  
2. Super Admin: full student/payment PII vs aggregates plus audited inspect?  
3. Who creates the first Super Admin? (Phase 0: `SUPER_ADMIN_EMAIL` env bootstrap on login — replaceable, not fake auth.)

### Academic model

4. One `is_current` academic year vs multiple concurrent open years?  
5. Classes as stable entities reused across years (recommended with enrollments) vs class-per-year rows?  
6. Mid-year transfer **workflow** (schema allows a future transfer; Phase 0 does not build the workflow).

### Catalog and packs

7. Exact CSV/Excel **columns** and matching rules for student import?  
8. Does a **pending** (unpaid) order block a second checkout of the same pack?  
9. Uniform size captured on student vs chosen at order vs pack variant lines only? (Packs may include variants; order UX still open.)

### Inventory and distribution

10. Exact **alternative oversell policy** when the school opts out of the default block?  
11. Who may **reverse** a mistaken distribution?  
12. Cash / unpaid collection at the counter in V1?  
13. Substitute items if a line is unavailable?  
14. Distribute when `on_hand` < reserved (data error) — block or allow with audit?

### Payments and refunds

15. Who **initiates** refunds (school admin, super admin, both)?  
16. **Partial** refunds in V1, or full refunds only?  
17. How reservation release is allocated on partial refund?  
18. Instalments / partial payments?  
19. Pending order **expiry**?  
20. Chargebacks / Razorpay disputes beyond initiated refunds?

### Receipts and notifications

21. Receipt numbering: per school vs global?  
22. When a school “specifically requires” GST, is that a school setting in V1 or a later project?  
23. Collection reminder **timing and cadence**?  
24. What triggers “remaining items available”?  
25. Localization / languages?

### Product surface

26. `/` marketing site vs login-only? (Phase 0: login-oriented home.)  
27. Exact V1 **report** list?  
28. If a school is `suspended`, may parents still open old receipts?  
29. Soft-delete vs archive for mistaken student imports?

**Explicitly out of V1 unless requested later:** delivery/shipping, complex GST invoicing, WhatsApp/SMS, advanced analytics, complex transfer workflows, SaaS billing of schools.

## 6. Locked V1 decisions (do not reopen without review)

Restated for implementers; full text in `ACADEXA_SPEC.md` §3:

1. Parents self-register (mobile/email); **no** student self-claim by ID.  
2. School searches parent by phone/email, invites existing or new parents; **parent must accept** before child access.  
3. Many-to-many parents and children.  
4. One account may have multiple roles; permissions remain role-based and school-scoped.  
5. School Admins may use distribution; Distribution Staff get a restricted desk.  
6. Students use **enrollment history** (year + class), not a single overwritten class. Transfers later; no Phase 0 transfer UI.  
7. Manual students + CSV/Excel import (import UI after Phase 0).  
8. Pack types + required/optional + variants + repeat flag; **paid packs are snapshots**.  
9. Pending payment does **not** reserve stock; verified payment reserves; distribute + ledger.  
10. Prevent overselling unless school sets an explicit alternative.  
11. Gateway-agnostic core; **Razorpay** first; sandbox; server-verified success; no hardcoded credentials.  
12. Refunds in Acadexa + gateway sync.  
13. Digital receipt + opaque QR; GST-capable schema; GST invoicing not mandatory V1.  
14. Notifications: **in-app + email** V1.  
15. Multi-tenant isolation + RLS.  
16. Parent may have children at different schools; context follows selected child.  
17. Pay online, **collect at school**; no shipping/delivery.

## 7. Next step after remaining decisions (or explicit deferral)

**Phase 0 only** — not the full application. Remaining §5 items should be answered or explicitly deferred before they are coded as if they were requirements.
