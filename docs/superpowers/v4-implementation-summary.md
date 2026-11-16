# IncomSG V4 — Implementation Summary

**Date:** 2026-11-16
**Integration Branch:** `feat/v4-merchant-self-service` (branched from `jack1e2401/version-02`)

## 1. Delivered Architecture & Modules

### Database & Migration
- `apps/backend/prisma/schema.prisma` & `apps/backend/prisma/migrations/20261116000000_v4_self_service_foundation/migration.sql`
  - Added `MerchantApplication.slug`, `StorefrontDraft`, `StorefrontConfigVersion`, `ProductCategory`, `ProductImage`, `Product` V2 columns (`sku`, `categoryId`, `lowStockThreshold`, `richDescription`), `MerchantEvent`, and analytics read indexes (`Order_merchantId_memberId_status_idx`, `OrderItem_productId_idx`).
  - Migration safely backfills existing `Product.imageUrl` values into `ProductImage` without breaking legacy data or `OrderItem` snapshots.

### Workstream A — Merchant Slug, Media & Storefront (`feat/v4-storefront`)
- **Backend:** `modules/auth/*`, `modules/merchant-applications/application.repository.ts`, `modules/media/*`, `modules/storefront/*`.
- **Frontend:** `api/storefront-types.ts`, `api/storefront-client.ts`, `features/auth/AuthPages.tsx`, `features/storefront/{MerchantStorefrontEditor,PublicStorefrontPage,StorefrontCatalogSection,StorefrontSections,StorefrontImageField,StorefrontVersionHistory,SlugMemberLayout}.tsx`.

### Workstream B — Product Catalog V2 (`feat/v4-catalog`)
- **Backend:** `modules/products/categories.*`, `modules/products/products.*`.
- **Frontend:** `api/commerce-types.ts`, `api/commerce-http.ts`, `features/merchant/{MerchantProductsPage,MerchantCategoriesPanel,MerchantProductFiltersBar,MerchantProductFormDialog,MerchantProductGalleryEditor,MerchantProductTableRow}.tsx`, `features/member/PublicProductDetail.tsx`.

### Workstream C — Event Content Management (`feat/v4-events`)
- **Backend:** `modules/events/*`.
- **Frontend:** `api/events-types.ts`, `api/events-client.ts`, `features/events/{MerchantEventsPage,MerchantEventCard,MerchantEventFilters,EventFormDialog,PublicEventsPage,PublicEventDetailPage,event-format}.tsx`.

### Workstreams D & E — Auto-Membership, Customer 360°, Analytics V1 (`feat/v4-customer-analytics`)
- **Backend:** `modules/loyalty/loyalty.membership.ts`, `modules/customers/*`, `modules/analytics/*`.
- **Frontend:** `api/analytics-types.ts`, `api/analytics-client.ts`, `features/customers/{MerchantCustomersPage,MerchantCustomerDetailPage,useEnsureMembership}.tsx`, `features/analytics/MerchantAnalyticsPage.tsx`.

### Demo Seed & Environment Tooling
- `apps/backend/prisma/v4-demo-seed.ts` (`npm run db:seed:v4 -w apps/backend`) seeds 2 independent merchants (`ca-phe-moc` and `xuong-gom-an-nhien`) with distinct branding, categories, products, low-stock items, events (published + draft), members (0-order, returning, and `REFUND_PENDING`), and loyalty ledgers.
- `scripts/setup-worktree-env.mjs` & `scripts/test-database-config.mjs` automate isolated MySQL test environments (`incomsg_testdb_*`).

---

## 2. Known Remaining Risks & Operational Notes

1. **Local Disk Uploads:** `POST /api/merchant/media/upload` stores uploaded images on local disk (`UPLOAD_DIR`, default `apps/backend/uploads`). For multi-instance production deployment, swap storage behind `media.service.ts` to object storage (S3/R2/GCS).
2. **Legacy `DemoRoutes` (`VITE_API_MODE=mock`):** Preserved compiling and passing existing `mock.test.ts` / `demo-mode.spec.ts`; V4 self-service features run exclusively against the real Express + MySQL backend (`BackendRoutes`).
3. **Browser Verification Tooling:** Orca browser control was unavailable in this agent runtime; verification used Playwright (`npm run test:e2e`) and live local HTTP+UI smoke checks against `incomsg_testdb_integration`.
4. **Pre-existing Local Changes:** Deleted files in `docs/qa/` present in the workspace before M0 were left untouched and excluded from all commits.
