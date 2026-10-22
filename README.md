# Dukaan Saathi

A mobile-first daily business manager for small businesses in India.

## MVP goal

Help one owner manage one business from one daily dashboard with a dependable transaction engine.

### MVP scope

- Single business and single owner
- Dashboard: sales, collections, expenses, cash position and outstanding dues
- Transactions: sales, purchases, expenses, customer receipts, supplier payments and refunds
- Parties: basic customer and supplier records
- Basic product catalogue and stock movements
- Daily and monthly summaries, CSV export and daily closing
- Responsive, installable Progressive Web App (PWA)
- Free core tier; paid features are deferred until usage is validated

### Out of scope for first release

Multi-user/staff access, multiple branches, automated GST returns, bank integrations, payroll, advanced analytics and complex wholesale workflows.

## Financial correctness principles

1. Keep sales, cash received, expenses, supplier payments and profit as separate concepts.
2. Store money as integer paise or an exact decimal type; never use floating-point values for money.
3. Save a financial transaction and all related records atomically.
4. Support partial payments and credit balances explicitly.
5. Never silently overwrite posted financial transactions; use reversal/correction records.
6. Enforce tenant/business authorization server-side.
7. Use idempotency keys to prevent duplicates on retries and offline synchronization.
8. Record audit events for financial mutations.
9. Test the accounting invariants and dashboard calculations automatically.

## Suggested initial technology direction

- TypeScript and a responsive React PWA
- API-backed application with server-side transaction validation
- PostgreSQL for durable relational data
- Automated unit, integration and end-to-end tests
- CI checks before changes are merged

The exact stack should be confirmed after reviewing deployment constraints, but the accounting domain rules should remain independent of UI framework.

## Product milestones

1. Repository foundation, product requirements and CI
2. Authentication and one-business onboarding
3. Parties, products and transaction engine
4. Daily dashboard and cash reconciliation
5. Reports, export, accessibility and PWA support
6. Pilot testing with real shopkeepers
7. Premium features only after core usage is validated

## Success criteria for pilot

- An owner can record a common transaction quickly on a phone.
- Sales, receipts and outstanding balances reconcile in tested scenarios.
- Duplicate submission attempts do not duplicate financial records.
- A user can export their own data.
- No cross-business data access is possible.
- Daily closing discrepancies are visible and explainable.

## Status

Initial repository setup. No production-ready application is implemented yet.
