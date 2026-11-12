# Inventory and Loyalty Policy History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the responsive lifetime tier chart, immutable loyalty policy history, and finite auditable inventory for sale products, discount-voucher issuance, and physical rewards.

**Architecture:** Preserve the existing Prisma/Express and React/TypeScript modules. Add one guarded inventory balance per Product or discount VoucherDefinition and an append-only movement ledger; perform balance changes and business transitions in existing serializable transactions. Publish immutable policy versions, attach the applied version and exact snapshot to orders, and use the latest version only for chart tier bands.

**Tech Stack:** Prisma, MySQL, Express, TypeScript, React, Vitest, existing backend integration test harness, Orca Browser.

**Spec:** `docs/superpowers/specs/2026-11-12-inventory-and-policy-history-design.md`

## Global Constraints

- Work in `C:\Users\ACER\orca\workspaces\IncomSG\main-integration`, preserving its existing uncommitted chart/Admin changes.
- Apply schema migrations and MySQL tests only to local `incomsg-test`; never write to `incomsg`.
- Keep mock payment backend-authoritative; do not add a frontend mock adapter or work on VNPay.
- Use integer quantities, guarded updates, Serializable transactions/retry, append-only movements, and idempotency.
- Keep Merchant inventory owner-isolated; public Member DTOs expose availability only.
- Existing records with unknown stock start at zero; preserve issued MemberVouchers.
- Every task ends with its named tests run and one scoped local commit; push only when explicitly requested.

## Review Focus

- Concurrent checkouts for the last unit cannot over-reserve or over-sell.
- A duplicate payment, reward fulfillment, redemption, or stock adjustment cannot duplicate inventory effects.
- Cancellation and the five-minute expiry release only the reservation held by that order.
- Issued discount vouchers remain usable after template exhaustion or deactivation.
- Legacy unlinked reward definitions cannot issue unlimited entitlements.
- Returned sale goods are not silently restored by a financial refund; stock-in records a reason and the quality-check notice.
- Current policy bands do not alter exact historical lifetime point totals or the order's applied-policy snapshot.
- Merchant policy and inventory reads/writes cannot cross merchant boundaries.

## Task 1: Responsive chart and current tier bands

**Files:** `MemberLifetimeTierChart.tsx`, `lifetime-tier-history.ts`, chart unit tests.

- [ ] Write failing tests for muted name-based tier bands, new-policy threshold use, exact ledger-only lifetime values, reversal dips, and mobile horizontal overflow behavior.
- [ ] Implement shaded Bronze/Silver/Gold/Platinum bands and readable axis labels without recalculating point totals.
- [ ] Run the chart unit tests and verify they pass.
- [ ] Commit `feat(member): style responsive lifetime tier chart`.

## Task 2: Immutable policy publication and order audit

**Files:** Prisma policy schema/migration, loyalty config/history modules, order snapshot/serialization modules, controllers/routes/types, API types, focused frontend components and tests.

- [ ] Add failing backend tests for policy-version append-only behavior, publisher/time/config capture, order version snapshot, and owner-scoped Member/Merchant detail responses.
- [ ] Add `LoyaltyPolicyVersion`, order version reference, and migration backfill as an explicitly unversioned legacy baseline.
- [ ] Publish one immutable version whenever the Merchant saves/publishes a changed active config; reject edits to previous versions.
- [ ] Capture the exact policy version, tier, multiplier, rate, and thresholds when mock payment succeeds; serialize the snapshot in Member and Merchant order detail.
- [ ] Add merchant policy-history API and UI; show snapshot or explicit unavailable state in both order detail views.
- [ ] Run focused unit and MySQL integration tests; commit `feat(loyalty): version published policies and expose order snapshots`.

## Task 3: Inventory schema and migration

**Files:** Prisma models/enums and a new migration.

- [ ] Write failing migration/integration tests for opening zero balances, unlinked legacy reward deactivation, preserving existing MemberVouchers, uniqueness, owner references, and nonnegative checks.
- [ ] Add `InventoryBalance` and append-only `InventoryMovement` with exactly one inventory owner, before/after state, actor/reason/reference, and unique event key.
- [ ] Backfill existing Products and discount definitions to zero; do not create a second stock balance for reward definitions linked to Products.
- [ ] Disable new redemptions of unlinked legacy reward definitions while preserving existing issued entitlements.
- [ ] Apply the migration to `incomsg-test`, inspect Prisma migration status and reconciliation, then commit `feat(inventory): add balances and movement ledger`.

## Task 4: Atomic inventory business flows

**Files:** product, order, voucher, loyalty/inventory services and integration tests.

- [ ] Add tests first for sale order reservation, payment consumption, cancellation/failure/expiry release, stock caps and concurrency.
- [ ] Add tests for finite discount-voucher issuance, stock-in/out, duplicate redeem, existing issued voucher application, and exhaustion.
- [ ] Add tests for reward reserve/fulfill/cancel, point reversal, duplicate fulfillment, reserved-stock protection, rollback, and merchant isolation.
- [ ] Implement shared quantity guards and movement writes inside existing Serializable transactions.
- [ ] Implement a restart-safe five-minute pending-order expiry sweep; expired mock orders cancel and release only their own reservation.
- [ ] Add merchant stock endpoints with `Idempotency-Key`, quantity validation, mandatory reason, and movement pagination.
- [ ] Run backend unit/integration suites against `incomsg-test`; commit `feat(inventory): enforce atomic stock lifecycle`.

## Task 5: Backend-authoritative inventory UI

**Files:** API DTO/client modules, Merchant inventory components, Member catalogs/cart, tests.

- [ ] Add tests for quantity display, out-of-stock disabling, HTTP error/pending states, stock adjustment dialog validation, and refresh after mutation.
- [ ] Add quantity fields for initial Product and discount-voucher stock.
- [ ] Add Merchant stock in/out, summaries, and movement history for sale/reward Products and discount definitions.
- [ ] Add Member available quantities to storefront/voucher/reward cards; preserve existing fulfillment flow and show the return-quality notice on stock-in.
- [ ] Run focused frontend unit tests, typecheck, and build; commit `feat(frontend): manage and display inventory`.

## Task 6: Integration QA and demo

- [ ] Run root unit tests, typecheck, build, and full backend integration tests with the migrated `incomsg-test` database.
- [ ] Run Orca Browser on real HTTP mode: stock in, sell/cancel/expire a pending order, pay a sale order, redeem an exhausted/available voucher, reserve/fulfill/cancel a reward, inspect movement history, publish policy, and inspect order snapshot/chart.
- [ ] Verify migration status and stock/ledger reconciliation in `incomsg-test`; ensure `.env` files and `incomsg` are unchanged.
- [ ] Commit `test(inventory): verify inventory and policy history flows` and report exact pass/fail counts and remaining risks.
