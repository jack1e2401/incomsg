# IncomSG V4 — Challenges Engine, Navigation UX & Refund Workflow Design & Contract Spec

**Date:** 2026-11-17
**Integration Branch:** `feat/v4-challenges-nav`
**Status:** Approved via `/grill-me` before parallel Orca orchestration

---

## 1. Scope & Agreed Product Decisions

### Milestone 1 — Challenges Engine (P0)
- **3 MVP types:** `ORDER_COUNT`, `DAILY_CHECKIN`, `SPEND_TOTAL`.
- **Auto-enrollment & auto-reward:** No Join button, no Claim button. Valid behavior automatically creates/updates `ChallengeProgress` and credits `LoyaltyWallet` via `PointTransaction` (`type = EARN`, `source = CHALLENGE_REWARD`).
- **One active reward per ChallengeProgress (`(challengeId, membershipId)`):** A member can earn rewards across multiple different Challenges of the same Merchant, but each ChallengeProgress may have at most one `GRANTED` `ChallengeRewardGrant` at a time. Only after a `REVERSED` grant (due to refund) can the member re-earn in a new `rewardCycle`.
- **Activity window:** Only valid behaviors occurring in `[startsAt, endsAt]` count (`paidAt` for `ORDER_PAID`, server `Asia/Ho_Chi_Minh` timestamp for `DAILY_CHECKIN`).
- **Budget Control & `WAITING_BUDGET`:**
  - Activating a Challenge requires `targetValue > 0`, `rewardPoints > 0`, `endsAt > startsAt`, and `budgetTotal >= rewardPoints`.
  - If `budgetRemaining < rewardPoints` at completion, set `rewardState = WAITING_BUDGET` and `completedAt = now` without crediting points.
  - Increasing `budgetTotal` (or reactivating `PAUSED -> ACTIVE` when budget permits) **automatically replenishes `WAITING_BUDGET` progress records FIFO** (`completedAt ASC, id ASC`) inside the same Serializable transaction, idempotently.
  - Replenishment still pays out members who completed before `endsAt` even if `endsAt` has since passed; `PAUSED` or `ARCHIVED` suspends replenishment while preserving the queue.
- **Featured uniqueness:** At most one `isFeatured = true` Challenge per Merchant; setting `isFeatured = true` automatically unsets any existing featured Challenge for that Merchant in the same transaction.
- **Immutability after activation:** Once a Challenge has been activated (or has any `ChallengeProgress`), `type`, `targetValue`, `rewardPoints`, and `startsAt` are locked. Challenges with progress/grants cannot be hard-deleted (`ARCHIVED` instead).

### Milestone 2 — Navigation & UX Redesign (P0)
- **Mobile Bottom Navigation (max 5 items):** `Trang chủ` | `Sản phẩm` | `Săn thưởng` | `Ví điểm` | `Cá nhân`.
- **Rewards Hub (`Săn thưởng`):** Houses URL-reflected sub-navigation:
  - `Nhiệm vụ` (`/s/:slug/challenges`, `/s/:slug/challenges/:challengeId`)
  - `Ưu đãi` (`/s/:slug/vouchers`)
  - `Đổi quà` (`/s/:slug/rewards`)
  All 3 routes keep `Săn thưởng` highlighted in both Desktop Header Nav and Mobile Bottom Nav.
- **Ví điểm (`/s/:slug/wallet`):** Strictly member-owned loyalty assets (balance, tier, owned vouchers, ledger history).
- **Public Discovery + Login on Action:**
  - Guests can view Challenge Hero, Challenge List, Challenge Detail, and public Vouchers/Rewards catalog without hitting a login wall.
  - Guests do **not** see `0/target` progress; show the goal, reward points, and CTA `"Đăng nhập để bắt đầu"` linking to `/login?returnTo=<safeInternalPath>`.
  - No guest activity tracking or retroactive attribution after login. Public APIs never return member progress/wallet/PII.
  - Identity actions (Daily Check-in, Redeem, Cart/Checkout, Wallet, Orders) require `MEMBER` auth and preserve `returnTo`.
- **Breadcrumbs, Back & Shop Context:**
  - Desktop uses clickable breadcrumbs; Mobile uses a clear Back button + current page title + Merchant context.
  - Maintain `/s/:slug/...` Shop Context across Home -> Challenges -> Products -> Checkout -> Orders. Audit all links (including VNPay return redirect) so users are never dropped into `/member` marketplace or legacy UI unintentionally.
- **Merchant & Admin Console Navigation:**
  - Separate `Sự kiện` (`/merchant/events`) and `Nhiệm vụ` (`/merchant/challenges`) in Merchant Sidebar (`Marketing`).
  - Add `Hoàn tiền` (`/merchant/refund-requests`) under Merchant `Vận hành` and `Duyệt hoàn tiền` (`/admin/refund-requests`) in Admin Sidebar.
  - Auto-expand the active sidebar group, highlight active links, show dynamic page title in header, and support refresh/deep-link/mobile drawer.

### Milestone 3 — Refund Approval & Challenge Reversal (P1 — Included in this release)
- **Mock Payment MVP:** Refund Approval supports Mock Payment orders only. Orders with `paymentAttempt.status === "SUCCEEDED"` (VNPay) are explicitly blocked from creating `RefundRequest` (`409 VNPAY_REFUND_NOT_SUPPORTED`), while keeping schema/workflow extensible for future VNPay refund settlement.
- **Single request per order (`unique(orderId)`):** Max 1 `RefundRequest` per Order. If `REJECTED`, store decision reason and do not allow re-submission in MVP.
- **Approval flow:**
  1. Member submits `RefundRequest` (`PENDING_MERCHANT`) with `reason`.
  2. Merchant reviews Order + read-only `RefundPreview` and either Approves (`PENDING_ADMIN`) or Rejects (`REJECTED`, reason required).
  3. Admin reviews `RefundPreview` and either Approves (atomically executes Mock Refund -> `COMPLETED`) or Rejects (`REJECTED`, reason required).
- **Disable bypass:** `POST /api/merchant/orders/:orderId/refund` returns `409 USE_REFUND_APPROVAL_WORKFLOW`.
- **Challenge Reversal Policy (Option B):**
  - On completed refund, record `MemberActivity(ORDER_REFUNDED)` and negative `ChallengeProgressEntry` rows **only** for Challenges that previously received a positive `ChallengeProgressEntry` from that `orderId`.
  - If `currentValue` remains `>= targetValue`, keep `GRANTED` reward & `budgetSpent`.
  - If `currentValue` drops `< targetValue`:
    - If `WAITING_BUDGET`, reset `rewardState = IN_PROGRESS`, `completedAt = null`.
    - If `GRANTED`, reverse `ChallengeRewardGrant` (`REVERSED`), create `PointTransaction` (`EARN_REVERSAL`, `CHALLENGE_REFUND`), decrement `Challenge.budgetSpent`, recalculate `LoyaltyWallet` (allowing `pointDebt`) and `Tier`, and reset `rewardState = IN_PROGRESS`, `completedAt = null`.
  - Reversal applies even after Challenge `endsAt` passes; post-expiry activities never re-grant rewards.

---

## 2. Authoritative Prisma Schema Additions (`apps/backend/prisma/schema.prisma`)

Add to existing `PointTransactionSource`:
- `CHALLENGE_REWARD`
- `CHALLENGE_REFUND`

New enums & models:
- `ChallengeType`: `ORDER_COUNT`, `DAILY_CHECKIN`, `SPEND_TOTAL`
- `ChallengeStatus`: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`
- `MemberActivityType`: `ORDER_PAID`, `DAILY_CHECKIN`, `ORDER_REFUNDED`
- `ChallengeRewardState`: `IN_PROGRESS`, `WAITING_BUDGET`, `REWARDED`
- `ChallengeRewardGrantStatus`: `GRANTED`, `REVERSED`
- `RefundRequestStatus`: `PENDING_MERCHANT`, `PENDING_ADMIN`, `REJECTED`, `APPROVED`, `PROCESSING`, `COMPLETED`, `FAILED`

Models:
1. `Challenge`: `id`, `merchantId`, `title` (VarChar 191), `description` (Text), `type`, `status`, `targetValue` (Decimal(15,0)), `rewardPoints` (Decimal(38,12)), `budgetTotal` (Decimal(38,12)), `budgetSpent` (Decimal(38,12) default 0), `startsAt`, `endsAt`, `isFeatured` (Boolean default false), `activatedAt` (DateTime?), `createdAt`, `updatedAt`.
2. `MemberActivity`: `id`, `membershipId`, `type`, `eventKey` (@unique VarChar 191), `orderId` (Int?), `amountVnd` (Decimal(15,0)?), `occurredAt`, `createdAt`.
3. `ChallengeProgress`: `id`, `challengeId`, `membershipId`, `currentValue` (Decimal(15,0) default 0), `rewardState` (default IN_PROGRESS), `rewardCycle` (Int default 1), `completedAt` (DateTime?), `createdAt`, `updatedAt`. `@@unique([challengeId, membershipId])`.
4. `ChallengeProgressEntry`: `id`, `progressId`, `activityId`, `deltaValue` (Decimal(15,0)), `createdAt`. `@@unique([progressId, activityId])`.
5. `ChallengeRewardGrant`: `id`, `progressId`, `cycle`, `status` (default GRANTED), `pointsGranted` (Decimal(38,12)), `earnTransactionId` (@unique), `reversalTransactionId` (@unique?), `grantedAt` (default now), `reversedAt` (DateTime?). `@@unique([progressId, cycle])`.
6. `RefundRequest`: `id`, `orderId` (@unique), `memberId`, `merchantId`, `reason` (VarChar 255), `status` (default PENDING_MERCHANT), `requestedAt` (default now), `merchantReviewedById` (Int?), `merchantReviewedAt` (DateTime?), `merchantDecisionReason` (VarChar 255?), `adminReviewedById` (Int?), `adminReviewedAt` (DateTime?), `adminDecisionReason` (VarChar 255?), `createdAt`, `updatedAt`.

---

## 3. Authoritative HTTP API Contracts

### A. Merchant Challenges CMS (`/api/merchant/challenges`, `MERCHANT`)
- `GET /api/merchant/challenges?status=&type=&q=&page=1&limit=20`
  - Response `200`: `{ items: MerchantChallengeDto[], pagination: PaginationDto }`
  - `MerchantChallengeDto`: `{ id, merchantId, title, description, type, status, effectiveStatus, targetValue, rewardPoints, budgetTotal, budgetSpent, budgetRemaining, startsAt, endsAt, isFeatured, hasProgress, inProgressCount, completedCount, waitingBudgetCount, createdAt, updatedAt }`
  - `effectiveStatus`: `"DRAFT" | "ACTIVE" | "PAUSED" | "ENDED" | "ARCHIVED"` (`ENDED` when `status` is `ACTIVE`/`PAUSED` and `endsAt < now`).
- `POST /api/merchant/challenges`
  - Body: `{ title, description, type, targetValue, rewardPoints, budgetTotal, startsAt, endsAt, isFeatured?, status?: "DRAFT" | "ACTIVE" }`
  - Response `201`: `{ challenge: MerchantChallengeDto }`
- `GET /api/merchant/challenges/:challengeId?page=1&limit=20`
  - Response `200`: `{ challenge: MerchantChallengeDto, participants: { items: ChallengeParticipantDto[], pagination }, recentGrants: ChallengeGrantHistoryDto[] }`
- `PATCH /api/merchant/challenges/:challengeId`
  - Body: `{ title?, description?, type?, targetValue?, rewardPoints?, budgetTotal?, startsAt?, endsAt?, isFeatured? }`
  - Locks `type`, `targetValue`, `rewardPoints`, `startsAt` when `activatedAt !== null || hasProgress`.
  - Response `200`: `{ challenge: MerchantChallengeDto, replenishedCount: number }`
- `POST /api/merchant/challenges/:challengeId/activate` -> `200`: `{ challenge, replenishedCount }`
- `POST /api/merchant/challenges/:challengeId/pause` -> `200`: `{ challenge }`
- `POST /api/merchant/challenges/:challengeId/archive` -> `200`: `{ challenge }`
- `DELETE /api/merchant/challenges/:challengeId` -> `200`: `{ deleted: true }` if no progress/grants, else `409 CHALLENGE_HAS_PROGRESS`.

### B. Public & Member Storefront Challenges
- `GET /api/public/stores/:slug/challenges` (No auth, zero PII/progress)
  - Response `200`: `{ merchant: { id, name, slug }, heroChallenge: PublicChallengeDto | null, challenges: PublicChallengeDto[] }`
- `GET /api/public/stores/:slug/challenges/:challengeId` (No auth, zero PII/progress)
  - Response `200`: `{ merchant: { id, name, slug }, challenge: PublicChallengeDto }`
- `GET /api/member/stores/:slug/challenges` (`MEMBER`)
  - Response `200`: `{ merchant: { id, name, slug }, checkedInToday: boolean, todayDateKey: string, heroChallenge: MemberChallengeDto | null, challenges: MemberChallengeDto[] }`
  - `MemberChallengeDto` extends `PublicChallengeDto` with `progress: { currentValue: string, targetValue: string, remainingValue: string, percent: number, rewardState: ChallengeRewardState, rewardCycle: number, completedAt: string | null, grantedAt: string | null } | null`.
- `GET /api/member/stores/:slug/challenges/:challengeId` (`MEMBER`)
  - Response `200`: `{ merchant, checkedInToday, todayDateKey, challenge: MemberChallengeDto, recentEntries: Array<{ id, activityType, deltaValue, orderId, occurredAt }> }`
- `POST /api/member/stores/:slug/check-in` (`MEMBER`)
  - Response `200`: `{ checkedIn: true, alreadyCheckedInToday: boolean, dateKey: string, updatedChallenges: Array<{ challengeId, title, currentValue, targetValue, rewardState, pointsAwardedExact: string | null }> }`

### C. Refund Approval & Refund Preview (P1)
- **Extended `RefundPreviewDto` (`GET /api/merchant/orders/:orderId/refund-preview`, `GET /api/merchant/refund-requests/:requestId`, `GET /api/admin/refund-requests/:requestId`):**
  - Existing fields preserved + `challenges: ChallengeRefundImpactDto[]` where each item is `{ challengeId, title, type, targetValue, currentValueBefore, currentValueAfter, rewardStateBefore, rewardStateAfter, grantStatusBefore: "GRANTED" | null, grantStatusAfter: "REVERSED" | "GRANTED" | null, pointsToReverseExact: string, budgetSpentBefore: string, budgetSpentAfter: string }`.
- **Member:**
  - `POST /api/orders/:orderId/refund-request` (`MEMBER`, body: `{ reason }`) -> `201 { refundRequest: RefundRequestDto }`
  - `GET /api/member/orders/:orderId/refund-request` (`MEMBER`) -> `200 { refundRequest: RefundRequestDto | null }`
  - `OrderDto` includes optional `refundRequest?: RefundRequestSummaryDto | null` and `actions.canRequestRefund?: boolean`.
- **Merchant:**
  - `GET /api/merchant/refund-requests?status=&page=1&limit=20` (`MERCHANT`) -> `200 { items: RefundRequestListItemDto[], pagination }`
  - `GET /api/merchant/refund-requests/:requestId` (`MERCHANT`) -> `200 { refundRequest, order, preview: RefundPreviewDto }`
  - `POST /api/merchant/refund-requests/:requestId/approve` (`MERCHANT`, body: `{ note? }`) -> `200 { refundRequest }` (`PENDING_MERCHANT -> PENDING_ADMIN`)
  - `POST /api/merchant/refund-requests/:requestId/reject` (`MERCHANT`, body: `{ reason }`) -> `200 { refundRequest }` (`PENDING_MERCHANT -> REJECTED`)
  - `POST /api/merchant/orders/:orderId/refund` (`MERCHANT`) -> `409 { error: "USE_REFUND_APPROVAL_WORKFLOW" }`
- **Admin:**
  - `GET /api/admin/refund-requests?status=&page=1&limit=20` (`ADMIN`) -> `200 { items: RefundRequestListItemDto[], pagination }`
  - `GET /api/admin/refund-requests/:requestId` (`ADMIN`) -> `200 { refundRequest, order, merchant: { id, name, slug }, member: { id, email }, preview: RefundPreviewDto }`
  - `POST /api/admin/refund-requests/:requestId/approve` (`ADMIN`, body: `{ note? }`) -> `200 { refundRequest, refund, order, walletImpact, challengeReversals }`
  - `POST /api/admin/refund-requests/:requestId/reject` (`ADMIN`, body: `{ reason }`) -> `200 { refundRequest }`

---

## 4. Parallel Worker Ownership (Orca Worktrees)

1. **`v4-be-engine`** (Backend Challenges + P1 Refund Workflow + DB Seed + Backend Tests):
   - `apps/backend/prisma/*`, `apps/backend/src/modules/challenges/*`, `apps/backend/src/modules/refunds/*`, `apps/backend/src/modules/orders/*`, `apps/backend/src/modules/loyalty/loyalty.earning.ts`, `apps/backend/src/modules/payments/payments.service.ts`, `apps/backend/src/modules/admin/*`, `apps/backend/src/app.ts`, `tests/backend/*`.
2. **`v4-fe-member-challenges`** (Member Challenges FE + Member Refund Request UI + Challenge/Refund API Clients):
   - `apps/frontend/src/api/challenges-types.ts`, `apps/frontend/src/api/challenges-client.ts`, `apps/frontend/src/api/refunds-types.ts`, `apps/frontend/src/api/refunds-client.ts`, `apps/frontend/src/features/challenges/*`, `apps/frontend/src/features/storefront/PublicStorefrontPage.tsx`, `apps/frontend/src/features/member/{MemberOrderPages,MemberOrderResult,MemberLoyaltyPages}.tsx`, `tests/frontend/unit/v4-challenges-member.test.tsx`, `tests/frontend/unit/v4-refund-member.test.tsx`.
3. **`v4-fe-merchant-cms`** (Merchant Challenges CMS + Merchant Refund Requests UI):
   - `apps/frontend/src/features/merchant/challenges/*`, `apps/frontend/src/features/merchant/refunds/*`, `apps/frontend/src/features/merchant/backend/BackendMerchantOrdersPage.tsx`, `apps/frontend/src/features/merchant/MerchantRefundDialog.tsx`, `tests/frontend/unit/v4-challenges-merchant.test.tsx`, `tests/frontend/unit/v4-refund-merchant.test.tsx`.
4. **`v4-fe-nav-admin`** (Navigation UX, Rewards Hub, Breadcrumbs, Sidebars, Admin Refund Approvals, Route Wiring):
   - `apps/frontend/src/app/App.tsx`, `apps/frontend/src/layouts/BackendConsoleLayout.tsx`, `apps/frontend/src/components/ui/Breadcrumbs.tsx`, `apps/frontend/src/features/storefront/{StorefrontShellLayout,RewardsHubLayout,StorefrontProductsPage,StorefrontProfilePage}.tsx`, `apps/frontend/src/features/events/{PublicEventsPage,PublicEventDetailPage}.tsx`, `apps/frontend/src/features/member/PublicProductDetail.tsx`, `apps/frontend/src/features/admin/{AdminRefundApprovalsPage,BackendAdminPages}.tsx`, `tests/frontend/unit/v4-navigation-ux.test.tsx`, `tests/frontend/unit/v4-refund-admin.test.tsx`.
