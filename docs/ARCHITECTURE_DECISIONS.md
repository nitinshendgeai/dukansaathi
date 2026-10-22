# Architecture Decisions — Initial

## ADR-001: Mobile-first PWA
Decision: The initial client is a responsive web application designed to be installable as a PWA. This keeps onboarding friction low and supports mobile and desktop browsers.

## ADR-002: Server-authoritative financial logic
Decision: Financial posting and authorization run on the server. The client can calculate previews but cannot be trusted as the source of balances.

## ADR-003: Exact money representation
Decision: Use integer minor units (paise) or a carefully chosen exact decimal database representation. Avoid IEEE floating point for money.

## ADR-004: Immutable posted history
Decision: Preserve transaction history. Correct posted financial transactions with explicit reversals/correction documents.

## ADR-005: Defer collaboration
Decision: Version 1 supports one owner for one business. Membership tables and staff permissions are deferred until owner-only workflows show consistent use.

## ADR-006: Offline mode must be explicit
Decision: Offline writes, if enabled, enter a durable local queue with idempotency keys and visible sync states. Never imply a transaction is synced until the server confirms it.
