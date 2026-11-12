# Inventory and Loyalty Policy History Design

## Intent

Finish the Member lifetime-points chart and provide auditable, finite inventory for sellable products, discount-voucher issuance, and physical rewards. Record each published loyalty policy as an immutable version and expose the exact version used by an order. Keep demo payment mocked through the real backend so orders, reservations, points, and inventory persist in MySQL.

## User-approved behavior

- Use the active policy's tier thresholds and muted Bronze/Silver/Gold/Platinum color bands on the lifetime chart. The lifetime line remains the exact persisted ledger total and is never recalculated retroactively. Swipe horizontally on narrow screens.
- Publish immutable policy versions with the publisher, publication time, point rate, active flag, and complete tier configuration. Order detail in Member and Merchant views shows the policy snapshot actually used. Missing legacy snapshots are reported as unavailable, never replaced with the current policy.
- Use backend mock payment only for this demo; no VNPay work is in this scope.
- Reserve sellable product quantity when a pending order is created. The reservation expires after five minutes. Mock payment confirms through the backend, then reduces physical on-hand stock and releases the reservation. Cancel, payment failure, or expiry releases the reservation.
- Discount-voucher templates have finite issuance capacity. Issuing a MemberVoucher consumes one slot; applying an already-issued voucher to an order does not consume another. Existing issued vouchers remain usable when a template is inactive or out of issuance capacity.
- Reward stock belongs to the linked `Product(kind=REWARD)`, never to the reward VoucherDefinition. Redemption reserves one item; fulfillment consumes one on-hand and one reserved unit; cancellation releases the reservation and reverses points atomically.
- Manual adjustments require quantity, reason, merchant ownership, idempotency, and an append-only movement record. Returned goods can be stocked in during this demo, with a clear notice that a real deployment must inspect quality first.
- Existing records without trustworthy quantity start at zero. Existing issued MemberVouchers are preserved. Existing unlinked reward definitions stop accepting new redemptions until linked to a stocked reward product.

## Goals

- Prevent overselling, over-issuing, negative stock, double reservation, double fulfillment, and duplicate manual adjustments under concurrent requests.
- Keep stock balances reconcilable to immutable inventory movements.
- Keep point debit/reversal and stock reserve/release atomic for reward redemption and cancellation.
- Show backend-authoritative quantities and movement history in Merchant and Member HTTP-mode screens.
- Preserve existing payment, voucher, fulfillment, and authorization contracts where they do not conflict with these rules.

## Non-goals

- VNPay integration, provider reconciliation, real payment collection, or real provider refund changes.
- Partial refunds, automated fraud controls, warehouse/location management, batch/lot tracking, or a full returned-goods inspection workflow.
- A mock frontend adapter or fixture-driven product/stock results.
- Rewriting existing reward fulfillment or redesigning unrelated screens.

## Approaches considered

### Inventory

1. Put independent quantity counters on Product and VoucherDefinition, then separately modify MemberVoucher and fulfillment state. Rejected because reward product and reward voucher stock could diverge, and counters alone do not explain historical changes.
2. Derive every current balance by scanning the full movement ledger on each request. Rejected because last-item concurrency needs a guarded, indexed balance row.
3. **Use one guarded balance row per inventory owner plus an append-only movement ledger.** Selected by the user specification: Product owns SALE and REWARD stock; a DISCOUNT VoucherDefinition owns issuance capacity; reward VoucherDefinitions reference their Product and never carry a second stock counter. Every transition updates the balance and writes its movement in one serializable transaction.

### Loyalty policy history

1. Keep only mutable LoyaltyRule/LoyaltyTier and infer old policy from current settings. Rejected because order audits become inaccurate after a policy change.
2. Store an unversioned JSON snapshot only on an order. This helps order detail but cannot list published policy history or identify a policy release consistently.
3. **Append an immutable version for every published config and reference it from each paid order, while retaining an exact order snapshot.** Selected: Merchant history is auditable, order detail is stable, and the current tier chart can intentionally use the newest published thresholds without changing historical point totals.

## Data model and invariants

- `InventoryBalance`: exactly one owner, either `productId` or `voucherDefinitionId`; stores integer `onHandQuantity` and `reservedQuantity`. `availableQuantity = onHandQuantity - reservedQuantity`; discount-voucher `onHandQuantity` means remaining unissued slots and has no reservation.
- `InventoryMovement`: append-only, integer quantity delta, on-hand and reserved before/after, merchant/owner, movement kind, actor/source, reason, idempotency/event reference, and optional order/member-voucher references.
- One stock source exists per Product or discount VoucherDefinition. Reward stock is always looked up through its linked REWARD Product.
- For each balance, current on-hand and reserved values equal the ordered sum of movement effects, and `0 <= reserved <= onHand`. Voucher issuance capacity never becomes negative.
- `LoyaltyPolicyVersion`: merchant, monotonically increasing version, `vndPerPoint`, active flag, full tier snapshot, publisher, and publication timestamp. Versions are immutable.
- `Order`: optional policy-version foreign key and exact earning snapshot; stock reservation expiration is persisted. Existing orders without policy snapshots remain explicitly unversioned.
- `MemberVoucher`: snapshots its reward Product ID when issued so later definition edits cannot redirect an existing entitlement.
- Legacy inventory quantity is not inferred. Opening balances are zero. Existing issued vouchers/claims are preserved; unlinked legacy reward templates are disabled for new issuance.

## API contract

All paths below are authenticated and owner-scoped; all mutations use the existing Prisma serializable transaction/retry helper.

- `POST /api/merchant/products/:productId/stock/in|out` with `{ quantity, reason }` and `Idempotency-Key`; allowed for owned SALE or REWARD Products. Return updated balance and movement.
- `GET /api/merchant/products/:productId/stock/movements` with cursor pagination.
- `POST /api/merchant/vouchers` requires finite initial `quantity` for discount definitions. Reward definitions require a linked REWARD Product and do not accept a second stock quantity.
- `POST /api/merchant/vouchers/:definitionId/stock/in|out` and `GET .../stock/movements`; valid only for discount definitions.
- `InventoryBalanceDto = { ownerType, ownerId, onHandQuantity, reservedQuantity, availableQuantity }`. Product DTOs add this `inventory` object for Merchant and public Member catalog reads. Discount `DefinitionDto` adds `inventory = { remainingToIssue, totalIssued }`; reward definitions omit independent inventory because their linked Product owns it.
- `InventoryMovementDto = { id, movementType, quantityDelta, onHandBefore, onHandAfter, reservedBefore, reservedAfter, reason, actorId, orderId, memberVoucherId, createdAt }`. Merchant list responses include actor/reason; Member responses expose availability only.
- Existing member catalog DTOs add public `availableQuantity`; member responses do not expose adjustment actor/reason.
- Existing order create reserves sale Product quantities atomically. Existing `POST /api/orders/:orderId/pay` remains the demo payment action and persists PAID plus stock/points in one transaction.
- Existing reward redeem/fulfill/cancel paths reserve, consume, release, or reverse stock atomically.
- `GET /api/merchant/loyalty/history` returns `{ versions: LoyaltyPolicyVersionDto[] }` with `{ id, version, vndPerPoint, isActive, tiers, publishedAt, publishedById }`.
- Existing member `GET /api/member/orders/:orderId` includes `appliedLoyaltyPolicy: { policyVersionId, version, vndPerPoint, isActive, tierLevel, multiplier, tiers, capturedAt } | null`. Add owner-scoped `GET /api/merchant/orders/:orderId` with the same shape for the Merchant detail view.

## UI behavior

- Chart uses exact ledger-derived lifetime totals; shaded bands and threshold labels come from the newest published policy. Desktop fits its card; mobile preserves the plot width and supports horizontal touch scrolling.
- Member storefront/cards show available quantities and disable stock-based redemptions/orders when unavailable; the backend remains final authority.
- Merchant product, reward, and discount-voucher forms show initial quantities. Stock adjustment dialogs require quantity and reason, display current values/history, and refresh from backend after success.
- The stock-in dialog displays the returned-goods quality-check note. Demo stock-in remains available without an inspection workflow.
- Member and Merchant order details display the applied policy version, VND-per-point, tier/multiplier, and policy tier thresholds. Orders with no snapshot show a clear legacy-data message.
- Merchant loyalty settings include append-only publication history.

## Verification

- Unit tests cover band mapping, exact ledger totals, inventory quantity transitions, balance guards, and policy snapshot serialization.
- MySQL integration tests cover order reservations/expiry/mock payment, discount issuance capacity, reward reserve/fulfill/cancel, manual adjustments, idempotency, merchant isolation, rollback, movement reconciliation, and policy version snapshots.
- Run migrations and integration tests only against local `incomsg-test`. Do not migrate or write to `incomsg`.
- Use Orca Browser against the actual HTTP frontend/backend and test database for Member and Merchant inventory and policy-history flows.
