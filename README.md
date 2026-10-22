# Dukaan Saathi

A mobile-first daily business manager for small businesses in India.

## Current status

**Phase 2 implementation:** Supabase SSR/browser clients, email/password sign-in and sign-up, one-business onboarding, owner-scoped business API, transaction create/list API, and a transaction-entry screen are now in the draft PR. The dashboard landing page still displays sample figures and must not be used as a live financial report.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your Supabase project URL and anon/public key to `.env.local`, then open http://localhost:3000.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_initial_schema.sql` in the SQL editor or via the Supabase CLI.
3. Copy the Project URL and anon/public key into `.env.local` and your deployment environment.
4. In Supabase Auth, configure the Site URL and allowed redirect URLs for local development and your deployed domain. Enable email/password sign-in and configure email confirmation as desired.
5. Start the app and visit `/login`. Create an account, confirm your email if confirmation is enabled, sign in, create your business, then record a test transaction at `/transactions`.
6. Test with a non-production project first. Never expose or commit a Supabase service-role key.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Implemented workflow and limits

- Email/password sign-up and sign-in through Supabase Auth.
- One business per owner, enforced by a unique database constraint and row-level security.
- Authenticated business creation and transaction listing endpoints.
- Atomic transaction creation plus payment allocations and an audit event via `create_business_transaction(jsonb)`.
- Client and server-side validation uses integer paise and prevents over-allocation.
- Idempotency keys protect retry requests from creating a second transaction.
- The transaction screen currently supports sales, expenses, purchases, customer receipts and supplier payments with one payment allocation per entry.

Still required before real use: test the SQL migration against a real Supabase test project; verify RLS and concurrent idempotency behaviour; implement line items, stock posting, reversal/correction workflow, robust multiple-payment entry, live dashboard calculations, account recovery and production operational safeguards.

## Financial integrity principles

1. Sales are not the same as collections.
2. Cash movements are not the same as profit.
3. Store money in integer paise or exact decimals, never floating point.
4. Post transactions atomically with related records.
5. Correct posted transactions with explicit reversal/correction records, not silent edits.
6. Scope all data to the authenticated business on the server.
7. Use idempotency keys to prevent duplicate submissions and offline-sync retries.
8. Keep an audit trail of financial changes.

Do not enter production financial records until the database migration and authorization rules have been tested, and backup/restore and correction workflows are implemented.
