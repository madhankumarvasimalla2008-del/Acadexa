# Acadexa

Multi-school platform for books, uniforms, parent payments, digital receipts, inventory, and **on-campus collection**. Not a delivery product.

## Phase 0 (complete)

Secure foundation only: Next.js App Router, TypeScript, Tailwind, shadcn-style UI primitives, Supabase Auth, tenant models, enrollments, parent invitations, RLS, protected routes.

Live School A/B isolation was **not** proven: the project has one school. That exit exception is accepted. Do not create test tenants for it.

Do not expect packs, payments, inventory, or distribution UIs yet. Do not start Phase 1 automatically.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in keys. Never commit secrets.
3. Run `supabase/migrations/20260814120000_phase0_foundation.sql` in the Supabase SQL editor (or `supabase db push` if you use the CLI).
4. Optional: set `SUPER_ADMIN_EMAIL` to your login email and keep `SUPABASE_SERVICE_ROLE_KEY` server-side so the first Super Admin role is granted on sign-in.
5. In Supabase Auth, enable email/password. Confirm-email can stay on for production; disable it locally if you want immediate login.
6. `npm install` then `npm run dev`.

## Scripts

- `npm run dev` — local app
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript
- `npm run build` — production build

## Isolation

Every school-owned row has `school_id`. Postgres RLS plus server actions that ignore client-supplied role/school claims. Parents see a child only after **accepting** a school invitation.
