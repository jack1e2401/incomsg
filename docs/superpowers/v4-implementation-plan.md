# IncomSG V4 — Parallel Implementation Plan & Ownership Matrix

**Date:** 2026-11-16
**Base Branch:** `jack1e2401/version-02`
**Integration Branch:** `feat/v4-merchant-self-service`

---

## 1. Milestone & Dependency Map

```text
M0 (Lead Agent — on feat/v4-merchant-self-service)
 ├── Unified Prisma Schema + Migration (20261116000000_v4_self_service_foundation)
 ├── Gap Analysis, Architecture & API Contracts
 ├── Isolated MySQL worktree tooling (test-database-config.mjs, setup-worktree-env.mjs)
 └── Baseline verified (npm test, npm run typecheck)
        │
        ├──► Worktree 1: feat/v4-storefront (DB: incomsg_testdb_feat01, Agent 01)
        │      Workstream A: Merchant Slug + Media Upload + Branding + Draft/Preview/Publish/Rollback + /s/:slug Storefront + Login returnTo
        │
        ├──► Worktree 2: feat/v4-catalog (DB: incomsg_testdb_feat02, Agent 02)
        │      Workstream B: Categories + SKU + Gallery + Low-stock Threshold + Pagination `{ items, pagination }` + `/s/:slug/products/:productId`
        │
        ├──► Worktree 3: feat/v4-events (DB: incomsg_testdb_feat03, Agent 03)
        │      Workstream C: Event CRUD + Draft/Publish/Unpublish/Delete + `/s/:slug/events` & `/s/:slug/events/:eventSlug`
        │
        └──► Worktree 4: feat/v4-customer-analytics (DB: incomsg_testdb_feat04, Agent 04)
               Workstream D & E: Auto-Membership + Customer 360° + Merchant Analytics V1
        │
        ▼
M6 (Lead Agent — on feat/v4-merchant-self-service + DB: incomsg_testdb_integration)
 ├── Sequential merge & conflict-free integration of feat/v4-storefront, feat/v4-catalog, feat/v4-events, feat/v4-customer-analytics
 ├── Wire cross-workstream storefront sections (Storefront Home renders Featured Products & Categories from Catalog V2 + Upcoming Events from Event CMS + Auto-Membership on Member visit)
 ├── V4 Demo Seed Data (>= 2 independent Merchants with distinct branding, categories, products, events, customers, orders)
 ├── Full Regression Suite (unit + MySQL integration + build + typecheck + Playwright/Orca browser QA)
 └── Final QA Checklist & Implementation Summary
```

---

## 2. Strict File Ownership Matrix

To prevent merge conflicts and agent collisions, **shared routing/wiring files** (`app.ts`, `App.tsx`, `BackendConsoleLayout.tsx`, `commerce-http.ts`, `commerce-types.ts`, `schema.prisma`) follow strict rules:
- **No agent modifies `apps/backend/prisma/schema.prisma` or adds migrations.** (Lead Agent already finalized M0 schema & migration.)
- Each agent creates **isolated module files** for backend/frontend and **isolated route fragments/client helpers**; only the owning agent touches existing files assigned to it below, and **Lead Agent performs final integration wiring** in `app.ts`, `App.tsx`, `BackendConsoleLayout.tsx`, `commerce-http.ts`, and `commerce-types.ts` if multiple branches need to touch them — OR even cleaner:
  - Agent 01 owns: `auth/*` (slug), `merchant-applications/*` (slug + default storefront init), `modules/media/*`, `modules/storefront/*`, `features/auth/AuthPages.tsx`, `features/storefront/*`, `api/storefront-client.ts`, `api/storefront-types.ts`
  - Agent 02 owns: `modules/products/*`, `modules/categories/*` (or inside `products/`), `features/merchant/MerchantProducts*`, `features/merchant/MerchantCategories*`, `features/member/ProductDetailPage.tsx`, and updates existing `/products` callers (`commerce-http.ts`, `commerce-types.ts`, `BackendMemberPages.tsx`, `BackendMerchantPages.tsx`, `MerchantStoreDetails.tsx`, and existing product test fixtures)
  - Agent 03 owns: `modules/events/*`, `features/events/*`, `api/events-client.ts`, `api/events-types.ts`
  - Agent 04 owns: `modules/customers/*`, `modules/analytics/*`, `modules/loyalty/loyalty.membership.ts` (auto-membership route/service), `features/customers/*`, `features/analytics/*`, `api/analytics-client.ts`, `api/analytics-types.ts`
- **Important integration rule for `app.ts`, `App.tsx`, `BackendConsoleLayout.tsx`:**
  - Agents may mount their own routes in `app.ts`, `App.tsx`, `BackendConsoleLayout.tsx` in their branch for independent testing on their own isolated DB/ports, and Lead Agent cleanly merges those mounts during M6 integration! Because each agent keeps its own domain types/clients in separate files (`storefront-client.ts`, `events-client.ts`, `analytics-client.ts`), merge conflicts are minimal and trivial to resolve.

---

## 3. Isolated Worktree & MySQL Environment Plan

| Agent / Role | Worktree Path | Git Branch | MySQL Test DB | Backend Port | Frontend Port |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Lead (M0/M6)** | `C:/Users/ACER/orca/workspaces/IncomSG/version-02` | `feat/v4-merchant-self-service` | `incomsg_testdb_integration` | `3000` | `5173` |
| **Agent 01 (Storefront)** | `C:/Users/ACER/orca/workspaces/IncomSG/v4-storefront` | `feat/v4-storefront` | `incomsg_testdb_feat01` | `3001` | `5174` |
| **Agent 02 (Catalog V2)** | `C:/Users/ACER/orca/workspaces/IncomSG/v4-catalog` | `feat/v4-catalog` | `incomsg_testdb_feat02` | `3002` | `5175` |
| **Agent 03 (Events)** | `C:/Users/ACER/orca/workspaces/IncomSG/v4-events` | `feat/v4-events` | `incomsg_testdb_feat03` | `3003` | `5176` |
| **Agent 04 (Customer & Analytics)** | `C:/Users/ACER/orca/workspaces/IncomSG/v4-customer-analytics` | `feat/v4-customer-analytics` | `incomsg_testdb_feat04` | `3004` | `5177` |

Each worktree receives untracked `apps/backend/.env` and `apps/frontend/.env` via `scripts/setup-worktree-env.mjs`, applies committed migrations via `prisma migrate deploy`, and runs tests against its own MySQL database.

---

## 4. Test & Verification Plan

1. **Unit Tests (`npm test`):**
   - Frontend Vitest: Storefront editor/renderer, Product V2 filters/gallery/SKU, Event CRUD & public views, Customer 360° & Analytics KPI/charts.
   - Backend Node test: Slug normalization/allowlist, Branding/Section/Link validation, Product V2 validation, Event lifecycle rules, Customer 360° & Analytics `Decimal` / `Asia/Ho_Chi_Minh` / `REFUND_PENDING` calculations.
2. **MySQL Integration Tests (`npm run test:db`):**
   - Cross-merchant isolation for Storefront, Media, Categories, Products, Events, Customers, Analytics.
   - Draft vs Published visibility, Preview owner-only, Publish & Rollback history.
   - Concurrent `POST /api/member/stores/:slug/membership` race-condition test (no duplicate `MerchantMembership`).
   - Legacy commerce/loyalty/inventory/refund regression suite passing 100%.
3. **Live Browser Verification (Orca / Playwright):**
   - Two seeded Merchants with independent `/s/:slug` storefronts, branding, products, events, and customers verified end-to-end against real backend + MySQL.
