# IncomSG V4 — Challenges Engine, Navigation UX & Refund Approval Summary & Demo Runbook

**Date:** 2026-11-17
**Branch:** `feat/v4-challenges-nav` (merged to `main`)
**Design & API Contract:** `docs/superpowers/specs/2026-11-17-v4-challenges-navigation-refund-design.md`

## 1. Delivered Milestones

### Milestone 1 — Challenges Engine (P0)
- **Database (`apps/backend/prisma/schema.prisma`, `migrations/20261117000000_v4_challenges_and_refund_requests/migration.sql`):**
  - Added `Challenge` (`ORDER_COUNT`, `DAILY_CHECKIN`, `SPEND_TOTAL`), `MemberActivity` (`ORDER_PAID`, `DAILY_CHECKIN`, `ORDER_REFUNDED`), `ChallengeProgress`, `ChallengeProgressEntry`, `ChallengeRewardGrant`, and `PointTransactionSource` (`CHALLENGE_REWARD`, `CHALLENGE_REFUND`).
- **Backend (`apps/backend/src/modules/challenges/*`, `apps/backend/src/modules/loyalty/loyalty.earning.ts`):**
  - Auto-enrollment & auto-reward inside `completePaidOrder` transaction (no nested transactions).
  - Server-side `Asia/Ho_Chi_Minh` daily check-in (`POST /api/member/stores/:slug/check-in`), 1 check-in/merchant/day updating all active `DAILY_CHECKIN` challenges.
  - Budget control with conditional SQL `budgetTotal - budgetSpent >= rewardPoints` lock, `WAITING_BUDGET` queue, and automatic FIFO (`completedAt ASC`) replenishment on budget top-up or reactivation.
  - Locked fields (`type`, `targetValue`, `rewardPoints`, `startsAt`) after activation/progress; single `isFeatured` per merchant; soft archive vs hard-delete guard.
- **Frontend (`apps/frontend/src/features/challenges/*`, `apps/frontend/src/features/merchant/challenges/*`):**
  - `ChallengeHeroCard` on Shop Homepage (Guest Public Discovery without `0/target`; Member live progress & priority selection).
  - `ChallengesPage` (`Đang thực hiện` / `Đã hoàn thành` / `Hết hạn`) & `ChallengeDetailPage` (URL deep-link + Check-in + recent activity).
  - Merchant CMS (`MerchantChallengesPage`, `ChallengeFormDialog`, `MerchantChallengeDetailPage`).

### Milestone 2 — Navigation & UX Redesign (P0)
- **Storefront 5-Tab Bottom Nav & Rewards Hub (`StorefrontShellLayout.tsx`, `RewardsHubLayout.tsx`, `Breadcrumbs.tsx`, `App.tsx`):**
  - Unified 5-tab navigation: `Trang chủ` | `Sản phẩm` | `Săn thưởng` | `Ví điểm` | `Cá nhân`.
  - `Săn thưởng` (`RewardsHubLayout`) hosts `Nhiệm vụ` (`/s/:slug/challenges`), `Ưu đãi` (`/s/:slug/vouchers`), and `Đổi quà` (`/s/:slug/rewards`) with Public Discovery + Login on Action (`returnTo` preserved).
  - Desktop clickable breadcrumbs & Mobile Back + Page Title bar, Shop Context preserved across checkout & VNPay return (`payments.service.ts`).
- **Console Sidebars (`BackendConsoleLayout.tsx`):**
  - Separated Merchant `Sự kiện` (`/merchant/events`) and `Nhiệm vụ` (`/merchant/challenges`) under `Marketing`, added `Hoàn tiền` (`/merchant/refund-requests`) under `Vận hành`, added Admin `Duyệt hoàn tiền` (`/admin/refund-requests`), auto-expanded active groups, and fixed header page titles.

### Milestone 3 — Refund Approval & Challenge Reversal (P1)
- **Workflow (`apps/backend/src/modules/refunds/*`, `orders.repository.ts`):**
  - `RefundRequest` (`unique(orderId)`) supporting Mock Payment MVP (`409 VNPAY_REFUND_NOT_SUPPORTED` for VNPay orders).
  - Member submits request -> Merchant reviews Before/After Refund Preview & approves/rejects -> Admin reviews live Preview & approves/rejects.
  - Direct `POST /api/merchant/orders/:orderId/refund` blocked with `409 USE_REFUND_APPROVAL_WORKFLOW`.
  - Option B Challenge Reversal on `COMPLETED` refund: creates `ORDER_REFUNDED` + negative `ChallengeProgressEntry` for impacted challenges only; reverses `ChallengeRewardGrant`, `budgetSpent`, `LoyaltyWallet` (allowing point debt), and `Tier` only if progress drops below `targetValue`.
- **Frontend (`MemberOrderResult.tsx`, `MerchantRefundRequestsPage.tsx`, `MerchantRefundReviewDialog.tsx`, `AdminRefundApprovalsPage.tsx`):**
  - Member request dialog & status tracking, Merchant/Admin Before-After Refund Preview tables, and inline Admin approval confirmation.

## 2. Demo Runbook
1. Ensure local MySQL is running and `.env` files exist in `apps/backend/.env` & `apps/frontend/.env`.
2. Apply migrations & seed demo data:
   ```bash
   cd apps/backend
   npx prisma migrate deploy --config prisma7.config.ts
   npm run db:seed:v4
   ```
3. Start dev servers from repo root: `npm run dev` (Backend `:3000`, Frontend `:5173`).
4. Demo accounts (password `IncomSGV4Demo!2026`):
   - **Member:** `member.lan@incomsg.local` (has 2/3 orders on `ca-phe-moc`)
   - **Merchant (`ca-phe-moc`):** `owner.moc@incomsg.local`
   - **Admin:** `admin.v4@incomsg.local`
5. **E2E Demo Script:**
   - Open `/s/ca-phe-moc` as Guest -> inspect `Mộc thân quen: 3 đơn hàng` Hero & Rewards Hub (`Nhiệm vụ`, `Ưu đãi`, `Đổi quà`).
   - Sign in as `member.lan@incomsg.local` -> Hero updates to `2/3 đơn hàng` (`Chỉ còn 1 đơn nữa để nhận 15 điểm!`).
   - Open `Săn thưởng -> Check-in mỗi ngày` -> click `Điểm danh hôm nay` -> reload to confirm `1/5 ngày`.
   - Add a product, checkout, and Mock Pay -> Wallet receives order points + `+15 điểm` Challenge reward; `Mộc thân quen` moves to `Đã hoàn thành`.
   - On Order Detail, click `Yêu cầu hoàn tiền` and submit reason.
   - Sign in as `owner.moc@incomsg.local` -> `/merchant/challenges` (view stats & `15 / 1.500` budget) -> `/merchant/refund-requests` -> inspect Before/After Refund Preview & approve to Admin.
   - Sign in as `admin.v4@incomsg.local` -> `/admin/refund-requests` -> inspect Preview (`33.2 -> 13.3`, Challenge `3 -> 2`) -> approve & execute -> verify Member Wallet & Challenge reverted cleanly.
