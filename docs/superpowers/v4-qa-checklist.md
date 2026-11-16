# IncomSG V4 — QA Checklist & Verification Evidence

**Date:** 2026-11-16
**Integration Branch:** `feat/v4-merchant-self-service`
**Integration MySQL DB:** `incomsg_testdb_integration`

---

## 1. Automated Verification Matrix

| Check | Scope | Target / Env | Result |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | Frontend + Backend TypeScript | Workspace root | PASS (0 errors) |
| `npm run build` | Vite production bundle + Backend `tsc` | Workspace root | PASS |
| `npm test` | 19 FE Vitest files + BE Node unit tests | Workspace root | PASS (124 FE + 68 BE) |
| `npm run test:db` | M1–M8 + V4 Storefront/Catalog/Events/Customer360/Analytics | `incomsg_testdb_integration` (MySQL 8.0) | PASS (123 / 123) |
| `npm run test:e2e` | Existing Playwright browser suite | Chromium (Playwright) | PASS (12 / 12) |
| `npm run db:seed:v4 -w apps/backend` | 2 independent seeded Merchants (`ca-phe-moc`, `xuong-gom-an-nhien`) | `incomsg_testdb_integration` (MySQL 8.0) | PASS |
| Live Full-Stack Browser QA | Real Express (`:3000`) + Vite (`:5173`) + MySQL (`ca-phe-moc` & `xuong-gom-an-nhien`), Guest/Login `returnTo`/Events/Merchant V4 isolation, 0 console/500 errors | Chromium headless | PASS (5 / 5 flows) |

---

## 2. Functional & Security Acceptance Checklist

### Multi-Tenancy & Tenant Isolation
- [x] Merchant A cannot mutate or read Merchant B products/categories (`404` / `403`, `v4-catalog.integration.test.ts`)
- [x] Merchant A cannot mutate or preview Merchant B storefront/versions (`404`, `v4-storefront.integration.test.ts`)
- [x] Merchant A cannot mutate/publish/unpublish/delete Merchant B events (`404`, `v4-events.integration.test.ts`)
- [x] Merchant A cannot read Merchant B Customer 360° or Analytics (`404` / scoped `merchantId`, `v4-customer-analytics.integration.test.ts`)
- [x] Merchant admin routes derive `merchant` from authenticated owner JWT, ignoring forged `merchantId`

### Merchant Slug & Storefront (Workstream A)
- [x] Optional slug on Merchant registration + Vietnamese auto-slugify + `409 SLUG_TAKEN` on collision
- [x] Slug locked on `Merchant` after Admin approval; immutable thereafter
- [x] Default Published v1 initialized automatically on approval (and lazily for pre-existing merchants)
- [x] Draft independent of Published; Guest sees Published only; Owner Preview (`/s/:slug?preview=draft`) shows Draft to Owner only
- [x] Publish & Rollback append auditable `StorefrontConfigVersion` history
- [x] Multipart media upload (`/api/merchant/media/upload`) validates PNG/JPEG/WebP magic bytes & 5MB cap; static `/uploads` sets `X-Content-Type-Options: nosniff`
- [x] Safe link & plain-text branding validation (no arbitrary HTML/CSS/JS; `javascript:` / `//` rejected)
- [x] Login/Register `?returnTo=` validates internal relative paths and returns members to exact store context
- [x] Legacy `/member/:merchantId` routes preserved

### Product Catalog V2 (Workstream B)
- [x] Merchant-scoped `ProductCategory` CRUD; deleting category safely sets `Product.categoryId = null`
- [x] `sku` unique per merchant (`409 SKU_ALREADY_EXISTS`), nullable for backward compatibility
- [x] `ProductImage` gallery synced to `Product.imageUrl`
- [x] `lowStockThreshold` (default 5) + `isLowStock` flag reusing existing `InventoryBalance` / `InventoryMovement`
- [x] Unified `{ items, pagination }` across `/api/merchant/products`, `/api/merchants/:merchantId/products`, `/api/public/stores/:slug/products`
- [x] Public product detail `/s/:slug/products/:productId` with gallery, SKU, category, stock, and safe plain-text description
- [x] Historical `OrderItem` snapshots unaffected by product edits

### Event Content Management (Workstream C)
- [x] Merchant Event CRUD (`DRAFT` -> `PUBLISHED` -> `DRAFT`), delete restricted to `DRAFT` (`409 EVENT_NOT_DRAFT`)
- [x] Public `/s/:slug/events` & `/s/:slug/events/:eventSlug` show `PUBLISHED` events of active merchants only
- [x] Strictly informational (no registration, tickets, QR check-in, or loyalty points)

### Automatic Membership & Customer 360° (Workstream D)
- [x] Guest visiting `/s/:slug` does NOT create `MerchantMembership`
- [x] Authenticated `MEMBER` visiting `/s/:slug` or `/member/:merchantId` idempotently ensures `MerchantMembership` (`tierId: null` initial policy) + `LoyaltyWallet`
- [x] Concurrent membership requests create exactly 1 record (no duplicates, no 500s)
- [x] Visiting Merchant A never creates membership at Merchant B
- [x] Customer 360° shows 0-order members with 0 stats, exact `Decimal` spend/AOV, separated `REFUND_PENDING`, wallet, ledger, vouchers, and orders

### Merchant Analytics V1 (Workstream E)
- [x] `Asia/Ho_Chi_Minh` (`+07:00`) day/month boundaries and `Prisma.Decimal` exact revenue/AOV
- [x] Consistent `REFUND_PENDING` separation (`paidOnlyRevenueVnd`, `refundPendingRevenueVnd`, `refundedRevenueVnd`)
- [x] `REWARD` redemptions excluded from sales revenue; revenue never inferred from `PointTransaction`
- [x] Top-selling, slow-moving, 90-day no-sale, and low-stock product tables + total/new/returning member KPIs + empty states

---

## 3. Isolated Worktree Verification Log

| Workstream | Branch | Worktree DB | Unit + Build + Typecheck | MySQL `test:db` | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A — Storefront | `feat/v4-storefront` | `incomsg_testdb_feat01` | PASS (113 FE + 50 BE) | PASS (115/115) | `57cdb59` |
| B — Catalog V2 | `feat/v4-catalog` | `incomsg_testdb_feat02` | PASS (113 FE + 53 BE) | PASS (118/118) | `3b25a0f` |
| C — Events | `feat/v4-events` | `incomsg_testdb_feat03` | PASS (112 FE + 52 BE) | PASS (115/115) | `d3ab731` |
| D & E — Customer & Analytics | `feat/v4-customer-analytics` | `incomsg_testdb_feat04` | PASS (113 FE + 51 BE) | PASS (117/117) | `74b2c08` |
