# Merchant refund autonomy

Implement one vertical milestone for full refunds of paid Mock orders. The customer opens the request. The owning merchant approves or rejects it. Admin can read refund requests and their recorded decisions. Shop onboarding and moderation are outside this milestone.

## Data and API

- Keep `RefundRequest` for the customer's request and the decision, and `OrderRefund` for the recorded settlement. Use one serializable transaction to claim the request and complete the Mock settlement, order update, ledger entries, voucher restoration, fee reversal and challenge reversals.
- Treat historical `PENDING_ADMIN` requests as part of the merchant's pending queue. Give the owner the same actions as for `PENDING_MERCHANT`. Terminal history and legacy Admin review fields remain available for audit. This approach requires no data migration.
- The existing merchant approve endpoint returns the completed request and refund result. An approval replay reads the result without repeating effects. Reject requires a reason. VNPay and other non-refundable orders are rejected before settlement. Direct order refunds remain blocked. Admin refund routes are GET-only.

## Implementation and verification

- [x] Update member, merchant and Admin component tests and the existing MySQL refund fixtures. Cover a legacy request, authorization, conflicting decisions, repeated approval, and challenge ledger and wallet consistency.
- [x] Update refund services, routes and order settlement using the existing Decimal arithmetic.
- [x] Update merchant confirmation, customer-facing statuses and the Admin history page. Show recorded decisions and settlement for terminal requests.
- [x] Run the root unit and MySQL suites and rerun the refund cases after adding review timestamps. The full frontend unit suite reported failures in catalog, loyalty and the concurrent challenge UI work. Browser testing was skipped at the user's request.
