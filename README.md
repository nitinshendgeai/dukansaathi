# Dukaan Saathi

A mobile-first daily business manager for small businesses in India.

## Current status

**Phase 2 in progress:** responsive dashboard preview, initial finance calculation utilities, transaction input validation, a Supabase PostgreSQL schema and an atomic transaction-creation RPC. The dashboard still uses sample figures; live authentication and database wiring are not yet configured.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Database setup

The initial schema targets Supabase PostgreSQL and uses Supabase Auth for owner identity.

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_initial_schema.sql` using the Supabase CLI or SQL editor.
3. Configure environment variables only after the database is created. Never commit real secrets.
4. Review RLS policies and run the migration against a non-production project before onboarding real users.

The `create_business_transaction(jsonb)` RPC atomically creates a transaction and its payment allocations, records an audit event, and uses an idempotency key. It is the first transaction-write path; line-item posting, stock movement posting, accounting ledger entries, reversals and live dashboard reads remain follow-up work.

## MVP scope

- One business and one owner
- Daily dashboard: sales, collections, expenses, cash position and outstanding dues
- Sales, purchases, expenses, customer receipts, supplier payments and refunds
- Customer/supplier records and basic products/stock movements
- Daily/monthly reports and data export
- Responsive, installable Progressive Web App
- Free core tier; premium features deferred until usage is validated

## Financial integrity principles

1. Sales are not the same as collections.
2. Cash movements are not the same as profit.
3. Store money in integer paise or exact decimals, never floating point.
4. Post transactions atomically with related records.
5. Correct posted transactions with reversals/correction records, not silent edits.
6. Scope all data to the authenticated business on the server.
7. Use idempotency keys to prevent duplicate submissions and offline-sync retries.
8. Keep an audit trail of financial changes.

No production data should be entered until authentication, authorization, backup/restore, reversal handling, stock posting and accounting ledger entries are fully validated.
