# Repository Module Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize mixed-responsibility production modules into domain-oriented files while preserving UI behavior, backend behavior, API/schema contracts, and current test suite boundaries.

**Architecture:** Keep route and client entry points as facades while moving implementation to capability-specific modules. Group API contracts and clients by domain, split large member/merchant route modules by screen responsibility, and split backend persistence only at cohesive repository seams. Commit each independently verified slice.

**Tech Stack:** TypeScript, React, Vite, Express, Prisma, Vitest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-17-repo-module-refactor-design.md`

## Global Constraints

- Preserve runtime behavior, route paths, API payloads/responses, authorization, and database schema.
- Organize production files by domain/capability; production source must not use historical milestone names.
- Preserve test paths and milestone-named test files; update their imports only when needed.
- Keep existing public client and route entry points as facades where useful.
- Do not touch generated code, dependencies, migrations, assets, or pre-existing storefront UI edits/docs.
- Run frontend/backend unit suites and safe backend integration tests; do not run E2E.
- Create one scoped commit for each completed code task; do not push or merge.

## Review Focus

- Existing named imports from the large page modules must continue resolving through facades — TypeScript typecheck and frontend unit suite.
- DTO types referenced by multiple domains must retain one canonical exported definition — frontend typecheck and backend build/typecheck.
- Auth/application path constants and HTTP methods must remain byte-for-byte equivalent — existing frontend auth client unit tests.
- Order, refund, voucher, and inventory repository transaction boundaries must remain unchanged — backend unit and integration suites.
- Pre-existing dirty changes must remain outside every refactor commit — inspect staged paths and `git show --stat` per commit.

---

### Task 1: Rename production auth modules away from milestone labels

**Files:**
- Rename `apps/frontend/src/api/contracts/milestone2.ts` to `apps/frontend/src/api/contracts/auth.ts` (split application-only contracts to `merchant-applications.ts` only if an import boundary is clear).
- Rename `apps/frontend/src/api/milestone2-client.ts` to `apps/frontend/src/api/auth-client.ts`.
- Rename `apps/frontend/src/features/auth/Milestone2Pages.tsx` to `apps/frontend/src/features/auth/AdminApplicationsPage.tsx`.
- Modify production imports in `auth-session.tsx`, `AuthPages.tsx`, `MerchantStoreDetails.tsx`, `commerce-types.ts`, `App.tsx`.
- Test: existing `tests/frontend/unit/api/milestone2-client.test.ts` (keep filename; update imports), frontend unit suite.

**Interfaces:**
- Consumes: existing `createMilestone2Client`, `milestone2Paths`, contract exports, and page exports.
- Produces: `createAuthClient` from `api/auth-client.ts`, `authPaths` from `api/contracts/auth.ts`, and `AdminApplicationsPage`/`RequireRole` from `features/auth/AdminApplicationsPage.tsx`; the request paths and object methods stay unchanged.

- [ ] Rename the modules and symbols, update production/test imports, and preserve every endpoint path and request option.
- [ ] Run `npm test --workspace apps/frontend` and `npm run typecheck --workspace apps/frontend`; expected: pass.
- [ ] Confirm `rg -n -i 'milestone[ _-]?[0-9]+' apps/frontend/src` returns no production matches.
- [ ] Commit only the auth source and directly affected test import paths as `refactor(frontend-auth): replace milestone module names`.

### Task 2: Split commerce DTO contracts by domain behind a compatibility barrel

**Files:**
- Create domain files under `apps/frontend/src/api/contracts/`: `catalog.ts`, `orders.ts`, `loyalty.ts`, `vouchers.ts`, `inventory.ts`, `finance.ts`, and `admin.ts`.
- Modify `apps/frontend/src/api/commerce-types.ts` to re-export the domain contracts for compatibility.
- Modify direct production imports only where a consumer clearly belongs to one domain.
- Test: frontend unit suite and frontend typecheck.

**Interfaces:**
- Consumes: all current type and value exports in `commerce-types.ts`.
- Produces: unchanged named exports from `commerce-types.ts`; domain files own their DTOs, inputs, and response wrappers. Shared types are imported from their canonical owning domain rather than copied.

- [ ] Move each existing declaration exactly once to its owning domain file, including dependent response wrappers.
- [ ] Keep `commerce-types.ts` as a type-only barrel; ensure its exported symbol set matches the pre-refactor set.
- [ ] Run `npm test --workspace apps/frontend` and `npm run typecheck --workspace apps/frontend`; expected: pass.
- [ ] Commit the DTO slice as `refactor(frontend-api): group commerce contracts by domain`.

### Task 3: Split backend member route screens into capability modules

**Files:**
- Create `apps/frontend/src/features/member/MemberLayout.tsx`, `MemberStorePages.tsx`, `MemberCartPages.tsx`, `MemberOrderPages.tsx`, and `MemberLoyaltyPages.tsx` by moving the corresponding exports from `BackendMemberPages.tsx`.
- Keep `BackendMemberPages.tsx` as a compatibility facade exporting the exact same names.
- Modify only imports affected by the move.
- Test: frontend unit suite and frontend typecheck.

**Interfaces:**
- Consumes: existing named exports `BackendMemberLayout`, `MemberStoreLayout`, `MemberStorefront`, `MemberProduct`, `MemberCart`, `MemberCheckout`, `MemberOrders`, `MemberWallet`, `MemberVouchers`, and `MemberRewards`.
- Produces: same named exports via the facade; each route module owns only its layout/store/catalog, cart/checkout, orders, or wallet/voucher/reward screens.

- [ ] Move screen implementations and their private helpers/imports to the owning capability modules; preserve route-facing exports.
- [ ] Run `npm test --workspace apps/frontend` and `npm run typecheck --workspace apps/frontend`; expected: pass.
- [ ] Commit as `refactor(frontend-member): split route screens by capability`.

### Task 4: Split merchant route screens by capability

**Files:**
- Create focused modules under `apps/frontend/src/features/merchant/` for overview/store, catalog, orders, and loyalty/vouchers/rewards from `MerchantPages.tsx` and `BackendMerchantPages.tsx`.
- Keep both existing files as compatibility facades because they serve distinct legacy and backend route sets and export overlapping names.
- Modify only direct imports affected by moves.
- Test: frontend unit suite and frontend typecheck.

**Interfaces:**
- Consumes: current exports and route assignments in `apps/frontend/src/app/App.tsx`.
- Produces: exact same export names from each facade; no route switches between legacy and backend page implementations.

- [ ] Move page implementations without changing either route tree's module ownership or behavior.
- [ ] Run `npm test --workspace apps/frontend` and `npm run typecheck --workspace apps/frontend`; expected: pass.
- [ ] Commit as `refactor(frontend-merchant): split merchant screens by capability`.

### Task 5: Split commerce HTTP implementation behind the current client facade

**Files:**
- Create focused request modules under `apps/frontend/src/api/commerce/` for catalog/storefront, orders/payments/refunds, vouchers/rewards, loyalty/inventory, and admin/finance.
- Keep `apps/frontend/src/api/commerce-http.ts` exporting `createCommerceClient` and `translateApiError` with its current client method set.
- Test: existing frontend API unit tests (retain their paths/names), frontend unit suite, frontend typecheck.

**Interfaces:**
- Consumes: `createCommerceClient(baseUrl?, fetcher?)` and all existing method names/argument types.
- Produces: same facade API, composed from domain request modules and shared HTTP/error helpers; URLs, headers, methods, bodies, and response types stay unchanged.

- [ ] Extract shared request/error handling once and move cohesive endpoint groups into domain modules.
- [ ] Compose the existing facade without changing its returned method names or behavior.
- [ ] Run `npm test --workspace apps/frontend` and `npm run typecheck --workspace apps/frontend`; expected: pass.
- [ ] Commit as `refactor(frontend-api): split commerce requests by domain`.

### Task 6: Split backend repository files only at cohesive query seams

**Files:**
- Review `apps/backend/src/modules/storefront/storefront.repository.ts`, `vouchers/vouchers.repository.ts`, `orders/orders.repository.ts`, and `products/products.repository.ts`.
- Add focused repository implementation files in the same domain directories; preserve imported repository objects/functions at all existing call sites.
- Tests remain in current paths; no new test suite or renamed milestone test.
- Test: backend unit suite, backend integration suite via `npm run test:db`, backend typecheck/build.

**Interfaces:**
- Consumes: current repository exports and transaction semantics.
- Produces: stable repository facade/exports; cohesive query groups (such as order read/create/cancel/refund, voucher definition/owned voucher/reward fulfillment, storefront version/draft/public data, and product catalog/category/sellable lookup) may be separated only where dependencies remain acyclic and transactions stay in their current boundary.

- [ ] Move cohesive functions without changing Prisma queries, transaction scope, locking, ownership checks, result mapping, or error outcomes.
- [ ] Run `npm test --workspace apps/backend`, `npm run typecheck --workspace apps/backend`, and `npm run test:db`; expected: pass using the repository's test-DB safety wrapper.
- [ ] Commit as `refactor(backend): split repository responsibilities by capability`.

### Task 7: Final repository-wide contract verification

**Files:**
- No source changes unless a prior task's focused verification found an issue.
- Inspect staged/committed paths and final working tree.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified refactor commit series with pre-existing UI changes still unstaged/uncommitted.

- [ ] Run `npm test`, `npm run typecheck`, and `npm run test:db`; expected: all pass. Do not run E2E.
- [ ] Search production source for milestone labels and confirm none remain.
- [ ] Review every refactor commit with `git show --stat` and check unrelated dirty paths were excluded.
- [ ] Record commit hashes and any known review findings; do not push or merge.
