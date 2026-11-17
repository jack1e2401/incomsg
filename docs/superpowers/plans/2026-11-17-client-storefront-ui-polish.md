# Client Storefront UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the client storefront product cards and detail page for mobile-first browsing without changing commerce behavior.

**Architecture:** Keep the existing storefront routes and reusable stock display helper. Make presentation changes in the product card, home/catalog grids, and public product detail; the existing shell navigation remains the owner of bottom navigation.

**Tech Stack:** React, TypeScript, Tailwind utility classes, React Router, `@phosphor-icons/react`.

**Spec:** `docs/superpowers/specs/2026-11-17-client-storefront-ui-polish-design.md`

## Global Constraints

- Keep two product columns on mobile, three on tablet, and four on desktop.
- Keep stock copy and semantic colors: `Còn hàng` (muted green) above 10, `Chỉ còn X sản phẩm` (orange) for 1–10, and `Hết hàng` (red) at zero.
- No Merchant, API, backend, schema, checkout, payment, fulfillment, Loyalty, voucher, news, or profile changes.
- No sale price, crossed-out price, discount badge, or new promotion behavior.
- Preserve all bottom navigation destinations and cart behavior.

## Review Focus

- Quantity 0: sold-out text stays red and the add action is disabled.
- Quantities 1–10: exact remaining-count copy stays orange and does not wrap into a pill.
- Quantities above 10: `Còn hàng` remains visible in muted green.
- Cart action: icon-only control remains named for assistive technology and keeps its existing add callback.
- Small screens and safe-area insets: sticky detail CTA does not cover content or the complete bottom navigation.

---

### Task 1: Product Card and Stock Presentation

**Files:**
- Modify: `apps/frontend/src/features/storefront/storefront-stock.ts`
- Modify: `apps/frontend/src/features/storefront/StorefrontProductCard.tsx`

**Interfaces:**
- Keep `productStockDisplay(availableQuantity)` as the shared source for label and semantic status.
- Extend its returned presentation fields with inline text classes while retaining `badgeClass` for existing consumers outside this storefront.
- Keep the product card `onAdd(product)` callback and `canAdd` contract unchanged.

- [x] Add the text-only status class for the three existing inventory states without changing their copy or thresholds.
- [x] Replace the card's visible `Thêm` label and bare plus with a circular cart/add icon treatment composed from existing Phosphor vector icons; retain an `aria-label` with the product name and an adequate touch area.
- [x] Render the stock line directly beneath price without pill background, and preserve disabled styling at zero stock.
- [x] Run `npm run typecheck` from the repository root and confirm it passes.

### Task 2: Responsive Home and Catalog Cards

**Files:**
- Modify if needed: `apps/frontend/src/features/storefront/StorefrontSections.tsx`
- Modify if needed: `apps/frontend/src/features/storefront/StorefrontCatalogSection.tsx`
- Reuse: `apps/frontend/src/features/storefront/StorefrontProductCard.tsx`

**Interfaces:**
- Keep existing product data, add handlers, category selection, search, sorting, URL state, and pagination unchanged.
- Home featured products remain limited to six; catalog remains eight products per page.

- [x] Keep a two-column product grid on mobile, three columns at tablet width, and four columns at desktop width for both featured products and catalog (already present; verified in source).
- [x] Refine card image framing, gaps, and text density using the supplied screenshot as reference while retaining the current light storefront surfaces and merchant accent color.
- [x] Confirm category chips, search/sort controls, product links, and card add actions remain in place.

### Task 3: Mobile Product Detail Purchase Action

**Files:**
- Modify: `apps/frontend/src/features/member/PublicProductDetail.tsx`
- Reference without changing destinations: `apps/frontend/src/features/storefront/StorefrontShellLayout.tsx`

**Interfaces:**
- Keep `handleAddToCart`, the selected quantity, sold-out behavior, and cart confirmation notice semantics unchanged.
- Keep the five existing bottom-navigation destinations intact.

- [x] Render stock status as small inline text with the same semantic colors and no pill background.
- [x] On mobile inside the storefront shell, pin the add-to-cart CTA immediately above the existing bottom navigation and safe-area inset; keep quantity selection in the product details.
- [x] On desktop and standalone detail rendering, keep the CTA in the product information area.
- [x] Reserve enough scroll space so the fixed mobile CTA does not obscure the final product content; keep the CTA disabled at zero stock.

### Task 4: Final Review and Build

**Files:**
- Review the scoped diff for the files above and the design/plan documents.

- [x] Confirm the diff changes presentation only and does not touch the previously dirty `AGENTS.md` or `package-lock.json`.
- [x] Run `npm run typecheck` and `npm run build` from the repository root; both pass. Build retains its existing >500 kB chunk warning.
- [x] Do not add or run test suites unless the user requests testing.
