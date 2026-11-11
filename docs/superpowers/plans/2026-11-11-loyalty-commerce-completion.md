# Loyalty Commerce Demo M0–M10 Implementation Plan

> **For agentic workers:** Use Orca orchestration with one implementation owner per file area; use TDD for behavior changes. Steps use checkbox syntax for tracking.

**Goal:** Complete the user's Loyalty Commerce Demo backlog while preserving working commerce routes and M1 exact point accounting.

**Architecture:** Extend existing Controller → Service → Repository modules and React role routes. Backend/DB stays authoritative. Schema and API contracts in the linked M0 spec are frozen before FE implementation. Isolated Orca child worktrees prevent overlapping edits; integrate and commit one verified milestone at a time.

**Tech Stack:** Node.js >=22.12, TypeScript, Express 5, Prisma 7, MySQL, React 19, Vite, Vitest, `node:test`, Orca Antigravity workers/browser.

**Spec:** [M0 Business and API Contract](../specs/2026-11-11-loyalty-commerce-completion.md) plus the user's 2026-11-11 M0–M10 request.

## Global Constraints

- Work on branch `feat/loyalty-exact-points`; preserve the pre-existing local `AGENTS.md` change and do not stage it.
- Keep M1's `DECIMAL(38,12)`/HALF_UP arithmetic and signed exact wallet balance. Use MySQL `incomsg-test` only for DB tests/migrations.
- Backend response and persisted MySQL state are authoritative. No FE mock success for new HTTP-mode flows.
- Preserve Member/Merchant/Admin authorization and merchant isolation. Admin alone can suspend, ban, unban or change blacklist.
- Refund scope is full only. VNPay refund cannot complete before provider confirmation. Stale payment attempts cannot be auto-failed/cancelled.
- Ledger is append-only and event-idempotent; all wallet changes and audit writes are atomic.
- Do not commit `.env`, secrets, generated Prisma output, or the user's `AGENTS.md`. No push/merge/PR.
- Existing working Member/Merchant/Admin screens are upgraded in place; no duplicate route set or broad redesign.

## Review Focus

- Late/duplicate payment callback racing cancel/refund must produce one order transition, one ledger effect, and no voucher loss.
- Two orders racing one discount voucher must have exactly one reservation; cancel/failure releases it for the next order.
- Refund after redemption must reverse only the exact earning credit, preserve unrelated carry and create debt rather than negative available points.
- Same idempotency key with a changed body must return conflict and never issue another voucher.
- Admin blacklist/status changes must not erase history or let Merchants enforce account sanctions.

## M0 — Business rules, screen inventory and contract

- [x] Audit current schema, API mounts, routes, existing tests, HTTP FE route inventory and local working tree.
- [x] Document lifecycle, API shapes, ownership, navigation and safe defaults in the M0 spec.
- [ ] Backend owner review of migration/API feasibility; reconcile any contract mismatch before FE implementation.
- [ ] Commit M0 contract as a docs-only commit.

## M2 — Ledger and redemption

**Owner:** Backend loyalty/voucher agent. **Files:** Prisma enum/ledger/idempotency migration; `loyalty` and `vouchers` modules; loyalty/voucher unit and integration tests. **Interface:** decimal string ledger, unique `eventRef`, redemption request keyed by `(memberId, route, Idempotency-Key)` with canonical request hash.

- [ ] Add RED integration tests for duplicate key, changed body, concurrent redemption and exact reconciliation.
- [ ] Remove one-transaction-per-order/voucher uniqueness that prevents reversals; preserve idempotency with unique event references.
- [ ] Implement exact ledger reconciliation and integer redemption against positive spendable balance; keep reward fulfillment behavior.
- [ ] Verify unit + `npm run test:db`, typecheck/build; commit `feat(loyalty): make ledger and redemption idempotent`.

## M3 — Order and payment lifecycle

**Owner:** Backend commerce agent. **Files:** Order/payment/voucher lifecycle modules, migration, order/payment tests. **Interface:** order states PENDING/PAID/FAILED/CANCELLED/REFUND_PENDING/REFUNDED; payment-attempt truth remains separate.

- [ ] Add RED tests for safe cancel, voucher reservation release/reuse, concurrent voucher reservation, failed IPN and stale CREATED handling.
- [ ] Model an exclusive active voucher reservation without losing prior order references; preserve voucher terms snapshot.
- [ ] Cancel only when no provider outcome can still succeed; release voucher and exact point-capacity reservation atomically.
- [ ] Keep unresolved CREATED attempts visible for reconciliation; no timer may invent FAILED. Late/duplicate IPN remains idempotent.
- [ ] Verify local MySQL race/state tests and typecheck/build; commit `feat(orders): support safe cancellation and payment lifecycle`.

## M4 — Full refund, point reversal and debt

- [ ] Add RED tests for Mock completion, VNPay pending, foreign Merchant, duplicate refund race, exact fractional reversal, debt and tier recalculation.
- [ ] Add refund record/audit actor and idempotent full-refund state transition.
- [ ] Append `EARN_REVERSAL` using the exact original order credit; update exact balance, net lifetime and tier in one transaction.
- [ ] Allow negative exact wallet only as debt; future EARN offsets debt before available/carry projection.
- [ ] Restore the order's USED discount voucher once after completed full refund, without revoking other valid redemptions.
- [ ] Verify actual persisted ledger/wallet and pending VNPay behavior; commit `feat(refunds): record idempotent earning reversals`.

## M5 — Reward fulfillment

- [ ] Add RED tests for pending queue, fulfill-once, cancel-before-fulfill, no cancel after fulfilled, duplicate cancellation and redemption reversal.
- [ ] Preserve the existing fulfill endpoint; record pending/fulfilled/cancelled actor/time/reason history.
- [ ] Merchant cancellation of unfulfilled reward appends `REDEMPTION_REVERSAL`, refunds points once, and does not change lifetime tier.
- [ ] Verify isolation and local MySQL tests; commit `feat(rewards): add audited fulfillment cancellation`.

## M6 — Member experience

- [ ] Extend HTTP DTO/client for cancel, preview, payment/refund states and reversal history; no mocked success.
- [ ] Upgrade storefront/cart/checkout with backend estimate, voucher state and pending messaging.
- [ ] Upgrade wallet/tier, voucher/reward and order history/details with exact balances, reversal links and safe Cancel.
- [ ] Add FE unit tests for status/error/idempotency display; verify real HTTP browser happy/error flows at desktop and 360px.
- [ ] Commit `feat(frontend): complete member loyalty experience`.

## M7 — Merchant experience

- [ ] Upgrade loyalty config with backend formula preview, tier thresholds/multipliers and policy-change warning.
- [ ] Add ledger search/filter/pagination and refund preview/confirm/status/reversal audit in Orders/Loyalty tabs.
- [ ] Upgrade reward queue with pending/fulfilled/cancelled states and reasoned cancellation.
- [ ] Verify Merchant A cannot read/act on Merchant B data in MySQL tests and HTTP browser.
- [ ] Commit `feat(frontend): complete merchant loyalty operations`.

## M8 — Admin anti-abuse

- [ ] Add RED tests for Admin-only state changes, account inactive auth, normalized blacklist registration/login block, audit append-only and merchant isolation.
- [ ] Add user status, normalized email blacklist, abuse report and immutable audit records; keep wallets/ledger intact.
- [ ] Add Admin user/blacklist/audit routes using required reason and actor from auth context.
- [ ] Add Admin screens for users, blacklist and audit. Merchant report action must never change account state.
- [ ] Verify role matrix and MySQL tests; commit `feat(admin): add audited account moderation`.

## M9 — UX polish and responsive pass

- [ ] Review all three role routes for loading/empty/error/pending/confirmation/accessibility states and consistent status labels.
- [ ] Fix keyboard, focus, form validation, narrow viewport overflow, and reduced-motion issues without a broad redesign.
- [ ] Run affected frontend tests/build and real-browser checks; commit `fix(frontend): polish responsive loyalty states`.

## M10 — Integration QA and demo

- [ ] Run `npm test`, guarded `npm run test:db`, `npm run typecheck`, `npm run build`, relevant formatting and existing e2e suites.
- [ ] Seed demo entities through a checked-in repeatable test/demo seed command; no hardcoded browser fixture or mock outcome.
- [ ] Orca Browser: Member earn/redeem/refund/debt recovery; Merchant policy/ledger/refund/reward actions; Admin moderation/audit; verify DB after refresh.
- [ ] Record actual flows and unresolved VNPay provider limitations. Commit any final test/demo artifact separately; do not push or merge.

## Execution ledger

- Baseline HEAD: `e2439ae` (`feat(loyalty): preserve exact earning and fractional carry`). Existing local `AGENTS.md` is pre-existing and excluded.
- M0 audit found no nested `AGENTS.md`. Existing APIs/modules are retained; new routes extend current `orders`, `loyalty`, `vouchers`, `admin` modules.
- Use Orca Run `run_b0aeb94d45ad`; workers will use isolated child worktrees and exact file ownership. Do not run overlapping DB integration suites concurrently against `incomsg-test`.
- M2 implementation started in isolated child worktree `m2-ledger-redemption`, Dispatch `ctx_6b493e455fbc`; backend contract, schema feasibility, FE inventory and QA gap read-only audits remain active in the Run.
- Any policy not stated by the user is an explicit ruling in the M0 spec or remains pending; do not silently invent partial refund, fraud scoring, expiry or quota rules.
