# M1 — Exact Earning + Carry

Approved in chat on 2026-11-11 after the HEAD audit and isolated MySQL setup.

## Outcome and scope

Credit paid orders using `(net VND * multiplier) / vndPerPoint`, without an
intermediate floor. Preserve fractional points per member/merchant across orders,
redemption and policy/tier changes. Keep the existing payment, voucher and reward
fulfillment flows. Refund/cancellation endpoints and redemption request keys belong
to M2–M4; this milestone prepares exact balances for them without adding those flows.

## Decisions

- Canonical wallet fields: `exactBalance`, `netLifetimeEarned`, `reservedPoints`,
  all `DECIMAL(38,12)`. Rename/backfill existing integer columns without inventing
  historical fractional credit. Do not persist available/carry/debt separately.
- Decimal calculations use 60 significant digits and HALF_UP once at 12 decimal
  places when creating a credit. Existing signed-INT capacity ceiling 2147483647
  remains enforced, including outstanding reservations, preserving numeric DTOs.
- Ledger `delta` and `balanceAfter` become exact decimals; JSON serializes them as
  strings. Add derived available/carry/debt after each entry. Keep existing unique
  order/voucher constraints until the reversal milestone.
- Orders persist `earnedPointsExact` and an auditable `loyaltySnapshot`. Existing
  paid credits are backfilled from EARN ledger entries; lost historical fractions
  cannot be reconstructed safely.
- New VNPay attempts freeze the selected tier, multiplier and full tier policy at
  initiation; mock payment freezes at PAID. Existing pre-migration attempts retain
  their documented legacy snapshot/reservation behavior.
- Determine current tier from exact lifetime and current thresholds, not cached
  membership tier. Spending never changes lifetime. New policy applies to new
  payments only; existing carry is already denominated in points.
- HTTP wallet retains integer `availablePoints` and `lifetimeEarnedPoints` for
  compatibility, and adds exact string fields. Order retains integer `earnedPoints`
  as a legacy projection and adds authoritative string `earnedPointsExact`.
- Redemption conditionally subtracts an integer cost from the exact balance and
  records the exact remaining balance; carry and lifetime are preserved.
- Root DB QA command must use local `incomsg-test`, apply checked-in migrations,
  and never silently use the application database.

## Approaches

The selected approach extends the existing Serializable transaction and Decimal
infrastructure. A second carry/debt balance would add competing sources of truth;
a commerce rewrite would discard working payment/fulfillment concurrency guards.

## Ownership and acceptance

Backend implementation and schema: coordinator. Backend integration tests: QA
agent. Frontend HTTP DTOs, exact display and regression tests: agy CLI through
Orca orchestration after the backend contract is available. All edit the actual
checkout with disjoint ownership; preserve the pre-existing AGENTS.md edit.

Acceptance includes .6 + .6 = 1 available/.2 carry; 6000 * 1.50 = .9; carry through
redemption/policy/tier changes; merchant isolation; inactive rule; duplicate and
concurrent payments; frozen payment policy; exact wallet/ledger reconciliation;
legacy migration preservation; unit/typecheck/build and MySQL integration checks;
and actual HTTP/Orca browser wallet/order verification.

## Migration safety

Preflight existing wallet/ledger sums before altering columns. If balance or
lifetime differs, stop migration for explicit reconciliation rather than silently
rewriting history. Test migrations on the isolated DB first. Do not migrate the
application database until its preflight and backup are verified. No push/merge.
