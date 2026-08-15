# Acadexa — System Architecture

**Status:** V1 decisions locked. Phase 0 implements the secure foundation only.  
**V1 decisions:** Locked in [ACADEXA_SPEC.md](./ACADEXA_SPEC.md) §3.  
**Companion docs:** [DATABASE.md](./DATABASE.md), [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md), [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

## 1. Recommended system architecture

### 1.1 Style

**Modular monolith** on Next.js (App Router), with PostgreSQL + Supabase as the system of record.

Rationale:

- One product, one team-sized surface area to start.
- Strong fit for RLS, Auth, and Storage without a separate API fleet.
- Clear module boundaries inside one repo so GitHub review stays tractable.
- Split to dedicated services later only if payment webhooks, reporting, or QR scan volume require it.

### 1.2 Logical layers

```
┌─────────────────────────────────────────────────────────────┐
│  Clients: Browser (responsive) — Parent / Staff / Admin     │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────┐
│  Next.js App Router                                         │
│  ├── Route groups (auth, platform, school, desk, parent)    │
│  ├── Server Components + Server Actions (default)           │
│  ├── Route Handlers: webhooks, QR resolve (narrow)          │
│  └── Zod validation on every mutation boundary              │
└────────────────────────────┬────────────────────────────────┘
                             │ service role (server only) OR
                             │ user JWT (RLS-enforced)
┌────────────────────────────▼────────────────────────────────┐
│  Supabase                                                   │
│  ├── Auth (email and/or mobile)                             │
│  ├── PostgreSQL + RLS (school_id + approved parent links)   │
│  ├── Storage (receipts, import files, product images)       │
│  └── (optional) Edge Functions for webhook verification     │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          │ PaymentProvider interface          │ NotificationPublisher
          ▼                                    ▼
   Razorpay adapter (V1)                 In-app + Email (V1)
   (sandbox in development)              SMS / WhatsApp reserved
```

### 1.3 Trust boundary

| Layer | Trust |
| --- | --- |
| Browser / client components | Untrusted |
| Next.js Server Actions / Route Handlers | Trusted application logic; still must not skip RLS where a user JWT is used |
| Supabase **service role** | Superuser; **server-only**, never in the client; used for webhooks, receipt issuance, reservation posting, refund/gateway sync |
| PostgreSQL RLS | Last line of defense for user-scoped queries |

**Rule:** User-facing reads/writes go through the **user session + RLS**. Privileged flows (payment webhook, refund confirmation, generating receipt numbers, inventory posting from verified payment) use the **service role** with explicit, audited server code.

### 1.4 Tenancy placement (V1 locked)

**Shared database, shared schema, `school_id` on every school-owned table**, enforced by RLS.

Parents are **not** a single-school tenant. Access is derived from **school-approved `parent_students` links**. When a parent selects a child, all queries use that student’s `school_id`, academic year, and class — never “the parent’s school.”

School Admin A must not read School B operational data even if they guess UUIDs.

### 1.5 Key technical choices

| Concern | Choice |
| --- | --- |
| UI | Next.js App Router, TypeScript, Tailwind, shadcn/ui |
| Forms | React Hook Form + Zod (shared schemas between client UX and server) |
| Charts | Recharts on school/platform dashboards when reports exist |
| Auth | Supabase Auth — parent signup via **email and/or mobile** |
| Data | PostgreSQL via Supabase |
| Files | Supabase Storage (receipts, CSV/Excel imports, optional product images) |
| QR | Generate server-side from opaque token; scan via device camera on staff UI |
| Payments | **Gateway-agnostic domain** + **Razorpay adapter (V1)**; verify on server; env-only secrets; sandbox in development |
| Notifications | In-app + email V1; publisher interface reserved for SMS/WhatsApp |
| Validation | Zod everywhere money, stock, roles, and IDs are involved |

### 1.6 Request patterns

**School Admin / Staff / Parent mutations (typical):**

1. Authenticated Server Action.
2. Zod parse input (IDs only; never prices/roles from client).
3. Load authoritative rows (pack price, school, student) in DB.
4. Authorize: membership / **approved** parent-child / role.
5. Write; RLS still applies if using user client.
6. Audit log.

**Parent–student linking (V1 locked):**

1. School Admin creates or approves the link for a student **in their school**.
2. Parent **cannot** insert a link by submitting a student ID.
3. Parent UI lists only **approved** links.

**Student import:**

1. School Admin uploads CSV/Excel (school context from membership).
2. Server parses, validates, inserts students for **that school only**.
3. Import errors returned as a row-level report (exact file columns still open).

**Payment (V1 locked):**

1. Parent selects pack → **no inventory change**.
2. Server creates `orders` in `pending` with **server-computed amount**.
3. Server checks: approved parent–student link; pack matches child’s school/year/class; duplicate-purchase rule; **sellable stock** (unless school alternative policy).
4. `PaymentProvider.createCheckout(...)` — Razorpay in V1.
5. Client completes Razorpay Checkout UI (test keys in development).
6. Gateway **webhook** hits a Route Handler (or Edge Function).
7. Signature verified; payment fetched/verified with gateway API (**not** client success callback).
8. Order → `paid`; **reserve** inventory; receipt + QR token; notifications (in-app + email).
9. Client confirmation page **re-reads order status** from DB.

**Refund (V1 locked):**

1. Authorized school/platform action creates a refund request with server-computed remaining refundable amount.
2. `PaymentProvider.refund(...)` when the gateway supports it.
3. On gateway confirmation (webhook/fetch): update payment/order status; **release remaining reservation** (and do not reverse already-distributed qty without an explicit distribution reversal — reversal policy still open).
4. Notify parent (in-app + email).

**Distribution:**

1. Staff authenticates.
2. QR token resolved server-side to receipt/order.
3. Payment status checked in DB (paid, not fully refunded as applicable).
4. Staff submits distributed quantities (≤ remaining).
5. Server: `reserved -= qty`, distributed += qty, `inventory_transactions` row.
6. Order/receipt distribution status recomputed; partial-collection / remaining-items notifications as designed.

## 2. Main application routes

Route groups keep URLs and layouts aligned with roles. Exact paths can be adjusted; the **grouping and access** should not.

### 2.1 Public / auth (V1)

| Path | Purpose |
| --- | --- |
| `/` | Marketing or login redirect (still open — see remaining decisions) |
| `/login` | Sign in (email and/or mobile) |
| `/register` | Account creation (email foundation in Phase 0) |
| `/invite/[token]` | Parent accepts a school-issued parent–student invitation |
| `/forgot-password` | Recovery where the auth method supports it |
| `/unauthorized` | Authenticated but wrong role/school |

Registration creates a **parent-capable account**. It does **not** attach children.

### 2.2 Super Admin (`/platform`)

| Path | Purpose |
| --- | --- |
| `/platform` | Platform overview |
| `/platform/schools` | List/create schools |
| `/platform/schools/[schoolId]` | School record, status, assigned admins |
| `/platform/admins` | School administrator accounts |
| `/platform/audit` | Platform-level audit (if exposed) |

### 2.3 School Admin (`/school`)

All routes implied **current school from membership**, not from a client-supplied school id in the body.

| Path | Purpose |
| --- | --- |
| `/school` | School dashboard |
| `/school/academic-years` | Years |
| `/school/classes` | Classes |
| `/school/students` | Students (manual add) |
| `/school/students/import` | CSV/Excel bulk import |
| `/school/parents` | Parents and **school-controlled** child links |
| `/school/catalog` | Products / books / uniforms / other |
| `/school/requirements` | Class requirements and quantities |
| `/school/packs` | Packs (type, items, price, repeat-purchase, stock policy) |
| `/school/inventory` | Stock, transactions, reserved vs on-hand |
| `/school/orders` | Payments / orders |
| `/school/refunds` | Refund records and status |
| `/school/receipts` | Receipts |
| `/school/distribution` | Distribution queue and history |
| `/school/reports` | Reports |
| `/school/staff` | Distribution staff (and other school users) |
| `/school/notifications` | School-side notification view (optional) |

### 2.4 Distribution Staff (`/desk`)

Narrow UI, mobile-first.

| Path | Purpose |
| --- | --- |
| `/desk` | Pending distributions / search |
| `/desk/scan` | Camera QR scan |
| `/desk/receipts/[receiptId]` | Verify pay, pack contents, record handover |

Staff must not receive School Admin configuration screens.

School Admins **may** use `/desk` for their school. Distribution Staff see desk only, not `/school` admin screens. Desk UI is not built in Phase 0 (route gate only).

### 2.5 Parent (`/parent`)

| Path | Purpose |
| --- | --- |
| `/parent` | Child picker (empty state if no approved links yet) |
| `/parent/children/[studentId]` | Child home: school/class context |
| `/parent/children/[studentId]/requirements` | Class requirements |
| `/parent/children/[studentId]/packs` | Available packs + availability/low-stock |
| `/parent/children/[studentId]/packs/[packId]` | Pack detail + pay (blocked if not purchasable) |
| `/parent/orders/[orderId]` | Payment status (poll/read from server) |
| `/parent/receipts/[receiptId]` | Digital receipt + QR |
| `/parent/notifications` | In-app notification inbox |

Switching child **must** change school/year/class context. Never reuse another child’s pack or price.

### 2.6 API (minimal)

| Path | Purpose |
| --- | --- |
| `/api/payments/webhook` | Provider webhook (Razorpay first); signature verify |
| `/api/health` | Deploy health |

Prefer Server Actions for app mutations. Keep HTTP APIs for gateways that cannot use form actions.

Webhook URL is provider-specific internally but behind a **provider-agnostic** handler that dispatches on gateway type.

## 3. Recommended folder structure

GitHub-friendly: feature modules under `src/`, SQL in `supabase/`, docs in `docs/`.

```
acadexa/
├── docs/
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (platform)/platform/...
│   │   ├── (school)/school/...
│   │   ├── (desk)/desk/...
│   │   ├── (parent)/parent/...
│   │   └── api/payments/webhook/
│   ├── components/ui/ layout/ domain/
│   ├── features/
│   │   ├── auth/
│   │   ├── platform/
│   │   ├── schools/
│   │   ├── academic/
│   │   ├── people/                # students, import, parent links
│   │   ├── catalog/
│   │   ├── requirements/
│   │   ├── packs/
│   │   ├── inventory/
│   │   ├── payments/              # orders, provider interface, Razorpay adapter
│   │   ├── refunds/
│   │   ├── receipts/
│   │   ├── distribution/
│   │   ├── notifications/         # in-app + email publisher
│   │   └── audit/
│   ├── lib/
│   │   ├── supabase/              # client.ts, server.ts, admin.ts
│   │   ├── auth/
│   │   ├── tenancy/
│   │   ├── money/
│   │   ├── qr/
│   │   ├── payments/              # PaymentProvider; razorpay/
│   │   ├── notifications/         # channels: in_app, email; stubs: sms, whatsapp
│   │   └── validations/
│   └── types/
├── supabase/migrations/ seed/
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

**Conventions:**

- `features/<name>` owns actions, queries, and feature components for that domain.
- `lib/payments` must not leak Razorpay types into packs/inventory modules.
- `lib/validations` is the contract between forms and servers.
- No `service_role` or Razorpay secret in any `client.ts` or `NEXT_PUBLIC_*` except the **publishable** Razorpay key if the Checkout widget requires it.
- Database changes only via versioned SQL migrations (**not in this planning phase**).

## 4. Major modules

| Module | Responsibility | Must not |
| --- | --- | --- |
| Auth | Signup/login (email/mobile), session, `profiles` | Attach students on register |
| Platform | Schools, school admin assignment | Touch school operational data except via explicit platform tools |
| Academic | Years, classes | Cross-school reads |
| People | Students, CSV/Excel import, school-approved parent–student, staff | Let parents insert links by student ID |
| Catalog | Products, variants, type (book/uniform/other) | Become a public marketplace or delivery catalog |
| Requirements | Class-year required items and qty | Let parents mutate requirements |
| Packs | Types, items, **authoritative price**, `allows_repeat_purchase`, stock policy | Accept price from the client; reserve stock on “select” |
| Inventory | Balances + append-only transactions; reserve on paid; release on refund | Overwrite stock with no history; deduct on pack browse |
| Payments | Orders, **PaymentProvider**, Razorpay adapter, webhooks | Mark paid from the browser; hardcode keys |
| Refunds | Refund records, gateway sync, reservation release | Ignore inventory when refunding |
| Receipts | Receipt records, QR tokens, optional tax columns | Put PII in QR payload; require GST invoice for all schools in V1 |
| Distribution | Handover, partials, remaining qty | Distribute unpaid or fully refunded orders (policy detail if partial refund still open) |
| Notifications | Persist in-app; send email; event types in spec | Be the source of payment truth; send WhatsApp/SMS in V1 |
| Audit | Event log | Be skipped on money/stock/link writes |
| Reports | Aggregations for one school (or platform for super admin) | Leak other schools’ aggregates |

## 5. Payment provider architecture (V1 locked)

```
PaymentProvider
  createOrder(amount, currency, metadata) → { providerOrderId }
  parseAndVerifyWebhook(headers, rawBody) → NormalizedPaymentEvent
  fetchPayment(providerPaymentId) → NormalizedPayment
  refund(providerPaymentId, amount, reason) → { providerRefundId }
```

- Domain statuses (`pending`, `paid`, `failed`, `refunded`, `partially_refunded`, …) are **Acadexa** statuses.
- Gateway payloads stay in `payment_transactions` / `refund_transactions` raw columns.
- Swapping Razorpay for another Indian gateway later means a new adapter, not a rewrite of packs or receipts.

Development: Razorpay **test mode** keys only. No production success shortcut.

## 6. Notification architecture (V1 locked)

```
NotificationPublisher.publish({ userId, schoolId?, type, payload, channels })
```

V1 `channels`: `in_app`, `email`.  
Reserved (unimplemented): `sms`, `whatsapp`.

Events map to templates; email secrets (SMTP/provider) are env-only. Collection-reminder **schedule/cadence** is still open.

## 7. Frontend architecture notes

- **Server Components** for lists and dashboards (RLS-backed fetches).
- **Client Components** for QR scanner, Razorpay Checkout, forms, charts, import file picker.
- Layouts per route group enforce role gates **in addition to** RLS.
- Responsive: desk and parent flows **mobile-first**; admin tables usable on tablet/desktop with stacked cards on small screens.
- Pack UI must show availability/low-stock and disable purchase when oversell protection applies.

## 8. Environment and configuration

Typical variables (names illustrative; never commit values):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (secret server-only; publishable id only if Checkout requires public key)
- `RAZORPAY_WEBHOOK_SECRET` (server only)
- Email provider credentials (server only)
- `QR_TOKEN_SIGNING_SECRET` if tokens are signed (server only)

`.env.example` lists keys without values. **Do not hardcode payment credentials.**

## 9. What this phase does not include

No app routes, UI, migrations, or package installs are implemented yet.
