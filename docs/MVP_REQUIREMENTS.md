# MVP Product Requirements — Dukaan Saathi

## 1. Product objective

Provide a very simple daily operations tool for owner-operated Indian small businesses. Version 1 prioritizes transaction correctness, ease of use on mobile and owner trust over feature breadth.

## 2. Primary user

An owner-operated shop or microbusiness currently using a notebook, calculator, messaging app or a basic ledger.

## 3. Core jobs to be done

- Record a sale, including whether it was paid now or on credit.
- Record expenses and purchases.
- Record customer collections and supplier payments without double-counting income or expenses.
- Know outstanding customer receivables and supplier payables.
- Maintain basic stock quantities when inventory tracking is enabled.
- Reconcile expected closing cash with counted cash.
- Review and export daily/monthly records.

## 4. Dashboard requirements

Show for the selected business date:
- Sales total (including credit sales)
- Money collected, separated by cash/UPI/bank/card/other
- Expenses recorded
- Supplier payments
- Expected cash position based on opening cash and cash movements
- Customer receivables and supplier payables as of the date
- Estimated gross profit only when reliable cost data exists
- Latest transactions and quick-add actions

The dashboard must label metrics clearly. Collections are not sales; paying an old supplier bill is not automatically a new expense; net cash movement is not profit.

## 5. Transaction types

- Sale/invoice
- Purchase
- Expense
- Customer receipt (against a receivable or as an explicitly classified advance)
- Supplier payment (against a payable or as an explicitly classified advance)
- Sales return/refund
- Purchase return
- Opening balances
- Cash adjustment with mandatory reason

Each transaction needs a business date, creation timestamp, status, reference/sequence, creator, notes and audit history. Payments must be separately represented to support partial settlement and multiple payment methods.

## 6. Data integrity

- Atomic writes for header, lines, payment allocations, ledger postings and stock movements.
- Exact monetary representation.
- Idempotency key scoped to the business and operation.
- Unique document numbering per business and document type.
- Posted transaction correction through reversal or credit/debit note patterns, never silent mutation.
- Server-side validation of amounts, quantities, dates and business ownership.
- Authorization tests that attempt cross-business access.
- Database backups and restore drill before production onboarding.

## 7. Inventory

Inventory is basic in the MVP:
- Product name, optional SKU, unit, selling price, cost price and track-stock flag.
- Stock movement records for purchase, sale, return and adjustment.
- Negative-stock behavior must be explicit and configured; default should warn/block rather than silently invent stock.
- Product quantities and stock values should be derived from movement history.

## 8. Reporting

- Daily and monthly summaries
- Transaction listing with date/type/payment filters
- Customer and supplier balances
- Basic stock-on-hand report
- CSV export

## 9. Security and privacy

- Authenticated owner access.
- Business-scoped access checks on every API operation.
- Least-privilege access and secure session handling.
- Rate limiting and input validation.
- Secrets only in environment/secret managers.
- Audit trail for sensitive financial changes.
- Clear user-controlled data export and account deletion policy, implemented safely.

## 10. Accessibility and localization

- Mobile-first layouts, readable type and sufficiently large touch targets.
- INR formatting and Asia/Kolkata business timezone by default, configurable when appropriate.
- Design strings for localization from the start; launch with English and add Marathi/Hindi based on pilot validation.
- Do not assume server UTC date equals the user's business date.

## 11. Acceptance gates

Before pilot:
- Unit tests for money calculations, payment allocation, balances and stock movement.
- Integration tests for atomic transaction posting and rollback.
- Tests for credit sale, partial payment, full settlement, refund, supplier payment, duplicate retries, timezone/day-boundary cases and cash closing.
- No open critical/high-severity security issue.
- Export and backup/restore verified.
- Cross-business access tests pass.
