# Storefront and Merchant UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the member storefront and merchant navigation to match the approved product-browsing and information architecture.

**Architecture:** Keep the existing storefront config-version JSON as the persisted source for shop image and weekly hours, adding backward-compatible validation/defaults. Reuse current product/catalog and merchant page modules, moving navigation into explicit React Router paths without changing commerce pricing behavior.

**Tech Stack:** React, TypeScript, React Router, Express, Prisma JSON-backed storefront config, existing Tailwind utility styles.

**Spec:** `docs/superpowers/specs/2026-11-16-storefront-merchant-ui-design.md`

## Global Constraints

- Featured products: maximum 6; fallback to up to 6 newest SALE products when no configured featured product is available.
- Public catalog: 8 products per page; homepage CTA is “Xem tất cả”.
- Inventory labels: >10 “Còn hàng”; 1–10 “Chỉ còn X sản phẩm”; 0 “Hết hàng”.
- Do not implement product promotions or discounted-price UI in this milestone.
- Preserve the member bottom navigation and Admin routes.
- Preserve pre-existing `AGENTS.md` and lockfile edits; stage only task-owned files.

## Review Focus

- Older storefront JSON without new fields must normalize and round-trip without losing published configuration.
- A featured selection containing stale/unavailable items must not leave the home page without fallback products.
- Catalog category/search/sort parameters must remain selected while changing pages.
- Out-of-stock buttons remain disabled, including detail views, while cart and checkout continue to rely on backend stock checks.
- Direct visits and old query-based Loyalty links must reach the correct merchant subpage.

---

### Task 1: Store image and opening-hours configuration

**Files:**
- Modify `apps/backend/src/modules/storefront/storefront.types.ts`
- Modify `apps/backend/src/modules/storefront/storefront.validation.ts`
- Modify `apps/frontend/src/api/storefront-types.ts`
- Modify `apps/frontend/src/features/storefront/MerchantStorefrontEditor.tsx`
- Modify `apps/frontend/src/features/storefront/StorefrontSections.tsx`

**Interfaces:** Add optional `storeImageUrl: string | null` and `openingHours: OpeningHoursDay[] | null` to storefront branding. `OpeningHoursDay` has `day: 1|2|3|4|5|6|7`, `closed: boolean`, `openTime: string | null`, `closeTime: string | null`.

- [ ] Normalize absent fields to null, validate image URLs and a complete unique 1–7 weekly schedule when provided.
- [ ] Add merchant editor controls for shop image and weekday hours; reuse storefront upload and draft/publish flow.
- [ ] Render compact shop information card with logo fallback, available contact data, maps query link when address exists, and weekly hours when configured.

### Task 2: Home page and product catalog

**Files:**
- Modify `apps/frontend/src/features/storefront/PublicStorefrontPage.tsx`
- Modify `apps/frontend/src/features/storefront/StorefrontSections.tsx`
- Modify `apps/frontend/src/features/storefront/StorefrontProductsPage.tsx`
- Modify `apps/frontend/src/features/storefront/StorefrontCatalogSection.tsx`
- Modify `apps/frontend/src/features/storefront/StorefrontProductCard.tsx`
- Modify `apps/frontend/src/features/member/PublicProductDetail.tsx`
- Modify `apps/frontend/src/features/storefront/MerchantStorefrontEditor.tsx`
- Modify `apps/backend/src/modules/storefront/storefront.validation.ts`

**Interfaces:** The catalog's default and storefront products route limit is 8; `StorefrontProductCard` displays stock by the approved thresholds.

- [ ] Limit curated featured products to six in editor and backend config validation.
- [ ] Use up to six configured products, or up to six newest SALE products when there are no available configured selections.
- [ ] Remove home catalog grid; connect horizontal category chips to catalog query URLs; keep “Xem tất cả” for the featured section.
- [ ] Set full catalog to eight items per page and retain its current explicit previous/next pagination.
- [ ] Apply stock labels and disabled add behavior to storefront cards and product detail.
- [ ] Stop rendering the long footer section; render the compact store information card once on home.

### Task 3: Merchant navigation and category route

**Files:**
- Modify `apps/frontend/src/layouts/BackendConsoleLayout.tsx`
- Modify `apps/frontend/src/app/App.tsx`
- Modify `apps/frontend/src/features/merchant/BackendMerchantPages.tsx`
- Modify `apps/frontend/src/features/merchant/MerchantProductsPage.tsx`
- Modify `apps/frontend/src/features/merchant/MerchantCategoriesPanel.tsx` or add a page wrapper in `apps/frontend/src/features/merchant/`

**Interfaces:** Expose merchant Loyalty views as direct child routes: `config`, `transactions`, `history`, `members`. Expose category management at `/merchant/categories`.

- [ ] Replace flat merchant links with active expandable groups in the existing left sidebar; preserve Admin links and mobile drawer.
- [ ] Add direct Loyalty subroutes and legacy query-tab redirect handling.
- [ ] Render category management on its own route and link to it from the Products page.
- [ ] Keep existing product inventory adjustments inside their current product flows.

### Task 4: Review and build verification

**Files:** All files above.

- [ ] Review the final diff and ensure only task-owned paths are staged.
- [ ] Run `npm run typecheck` and `npm run build` from the repository root.
- [ ] Do not run or add tests unless requested; report this limitation in the PR evidence.
