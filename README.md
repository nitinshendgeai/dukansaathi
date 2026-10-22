# Dukaan Saathi

A mobile-first daily business manager for small businesses in India.

## Current status

**Local application implementation:** Next.js application, PostgreSQL schema, email/password registration and login, signed HTTP-only sessions, owner-scoped business APIs, transaction entry/listing, and a database-backed dashboard for daily sales, collections, expenses, cash movement, recent activity, and estimated outstanding balances. Live database behavior has not yet been verified against a real PostgreSQL instance.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure `DATABASE_URL` to a PostgreSQL database and set `SESSION_SECRET` to a random secret of at least 32 characters. Do not commit real credentials.

## Railway setup

1. In Railway, create a project.
2. Add a PostgreSQL service using **+ New → Database → PostgreSQL**.
3. Deploy this GitHub repository as a web service.
4. In the web service Variables tab, add a reference to the PostgreSQL service's `DATABASE_URL`.
5. Add `SESSION_SECRET` with a cryptographically random value of at least 32 characters. Do not use the example value.
6. Apply `db/migrations/0001_initial_schema.sql` once to the new database using Railway's database query tooling or a trusted PostgreSQL client. Keep the database private.
7. Generate a public domain for the web service, then visit `/login`, register an account, create a business and enter test transactions.
8. Configure backups and verify restore before storing real financial data.

Railway's official guide: https://docs.railway.com/guides/nextjs

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Implemented workflow and limits

- Email/password account registration and sign-in; passwords are stored as bcrypt hashes.
- Signed, HTTP-only, SameSite session cookie.
- One business per owner, enforced by a unique database constraint and owner-scoped server queries.
- Authenticated business creation and transaction listing endpoints.
- Dashboard reads persisted records and computes daily/month-to-date metrics using the business timezone; it no longer uses illustrative financial figures.
- Dashboard quick-entry links open transaction entry with the selected transaction type preselected.
- Atomic transaction creation plus payment allocations and audit event via a PostgreSQL function.
- Integer-paise monetary inputs, payment allocation validation and idempotency keys.
- Entry screen for sales, expenses, stock purchases, customer receipts and supplier payments.

Still required before real use: test the migration against a Railway test database; verify authorization isolation and concurrent idempotency; implement invoice-linked payment allocation, transaction line items, stock posting, reversal/correction workflow, account recovery, rate limiting, and production backup/restore procedures. Dashboard receivables/payables are business-wide estimates until payments can be allocated to individual invoices.

## Financial integrity principles

1. Sales are not the same as collections.
2. Cash movements are not the same as profit.
3. Store money in integer paise or exact decimals, never floating point.
4. Post transactions atomically with related records.
5. Correct posted transactions with explicit reversal/correction records, not silent edits.
6. Scope all data to the authenticated business on the server.
7. Use idempotency keys to prevent duplicate submissions and retries.
8. Keep an audit trail of financial changes.

Do not enter production financial records until the database migration, authorization rules, backup/restore and correction workflows have been tested.
