# M1 Exact Loyalty Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Preserve exact paid-order earning and merchant-scoped fractional carry without breaking payment/redemption.

**Architecture:** Extend existing Prisma Serializable transactions. Store one exact signed wallet balance, exact lifetime and exact ledger; derive HTTP projections. Snapshot new VNPay earning terms and preserve documented legacy attempts.

**Tech Stack:** TypeScript, Express, Prisma 7, MySQL, React, Node test runner, Vitest, Orca/agy CLI.

**Spec:** `docs/superpowers/specs/2026-11-11-exact-loyalty-points-design.md`

## Global Constraints

- Work directly in this checkout; preserve the pre-existing AGENTS.md modification.
- No push, merge, production DB, db push, or reset. Tests use local `incomsg-test`.
- DECIMAL(38,12), HALF_UP at 12 places, 60-digit working precision; no Number core accounting.
- Existing 2147483647 capacity ceiling includes reservations. Integer DTOs are derived only.
- Frontend ownership belongs to agy via Orca; backend integration tests belong to QA agent.
- One verified coherent M1 commit because schema/backend/frontend must remain compatible.

## Review Focus

- Division yielding recurring decimals must round once, consistently across wallet/order/ledger.
- A policy threshold change must not use the membership's cached tier for a new credit.
- A nonzero fractional reservation must be released exactly on either VNPay outcome.
- Legacy wallets with mismatched ledgers must halt migration before column changes.
- Sub-point balances cannot redeem a 1-point voucher; redemption must preserve the fraction.

## Task 1: Decimal domain and migration

**Files:** loyalty.calculation.ts, new loyalty.balance.ts, schema.prisma, migration `20261111100000_exact_loyalty_points`, backend unit tests.

**Interfaces:** `calculateEarnedPoints(Decimal, number, Decimal): Decimal`; `selectTier(Decimal.Value, TierThreshold[]): TierLevel|null`; `describeBalance(Decimal)` returns exactBalance/string, availablePoints/number, fractionalCarry/string, pointDebt/string; `describeWallet` adds netLifetimeEarned/string and legacy lifetimeEarnedPoints/number.

- [ ] Write/run failing tests for .6+.6, multiplier .9, recurring precision, debt projection, threshold and invalid/overflow inputs. (Regression cases now pass; a separate red-phase run was not recorded.)
- [x] Implement Decimal math/projections and preserve existing safe capacity bound.
- [x] Rename wallet canonical columns, convert reservations/ledger to Decimal, add exact order credit and policy snapshots, backfill integer credits; guard legacy reconciliation before DDL.
- [x] Generate Prisma client and pass targeted unit tests.

## Task 2: Atomic earning, snapshots and redemption compatibility

**Files:** loyalty repository split into focused config/payment/read modules; points-reservation.ts; payments.repository.ts; orders.repository.ts/types; vouchers.repository.ts.

**Interfaces:** wallet API adds exactBalance/fractionalCarry/pointDebt/netLifetimeEarned strings; transactions delta/balanceAfter strings plus availablePointsAfter/fractionalCarryAfter/pointDebtAfter. Orders add earnedPointsExact/string|null. Existing numeric earnedPoints and integer wallet projections remain.

- [ ] Run new HTTP integration regressions RED on old implementation before migration. (A separate red-phase run was not recorded.)
- [x] Apply migration to test DB only; implement exact CAS balance updates and matching ledger/order credit in paid transaction.
- [x] Freeze actual tier/multiplier/policy at new VNPay initiation; recalculate current tier on read and before mock earning. Preserve old nullable-snapshot settlement.
- [x] Debit integer redemption cost against exact balance; preserve carry/lifetime and fulfillment.
- [x] Pass new/existing DB tests, including concurrency and migration preservation.

## Task 3: Safe DB command and frontend

**Files:** root package.json, scripts/test-backend-db.mjs, docs/backend README; frontend DTO/display/components/tests owned by agy worker.

- [x] Make root DB test command guard local `incomsg-test` and migrate checked-in schema before tests.
- [x] Dispatch agy CLI through Orca orchestration on current checkout, with exact approved HTTP contract and frontend-only ownership.
- [x] Display backend carry/debt/exact lifetime/ledger/paid credit without client earning formulas; preserve checkout and reward fulfillment.
- [x] Verify HTTP contract and UI loading/error paths, frontend unit/typecheck/build.

## Task 4: Verification, review and commit

- [x] Run root npm test, npm run test:db, npm run typecheck, npm run build and affected frontend format check. (The workspace-wide format check still reports three untouched files.)
- [x] Start actual apps using repository scripts and isolated DB; exercise .6+.6 wallet/order via Orca browser and an `ORDER_NOT_FOUND` error path; verify persisted ledger after refresh.
- [x] Fresh review of whole diff, fix material issues, inspect scope/secrets, selectively stage and commit `feat(loyalty): preserve exact earning and fractional carry`.
- [ ] Report Vietnamese results, actual counts/flows, migration/API details, deferred M2–M6 and commit hash.

## Execution record

- Baseline: HEAD efb772c; 55/55 DB tests passed on local incomsg-test with 11 migrations.
- Ruling: execute approved design without an additional approval round; the user's latest message explicitly authorizes coding M1 to completion.
- Ruling: use a feature branch in the existing checkout rather than another worktree, following repository operating mode.
- Final verification rerun: `npm test` passed (28 frontend + 35 backend unit tests); `npm run test:db` passed (70 tests; 12 migrations found, none pending); `npm run typecheck` and `npm run build` passed; targeted Prettier check and `git diff --check` passed. Workspace-wide frontend `format:check` reports only three untouched files.
- Browser smoke used HTTP mode with the local backend and `incomsg-test`: two 6,000 VND mock-paid orders produced exact wallet/ledger values of 1.2 total points (available 1, carry 0.2); refresh retained persisted values. An unknown order showed `ORDER_NOT_FOUND`. No merchant permission path was exercised.
