# Merchant CMS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every existing Merchant frontend surface with a Merchant-only Ant Design 6 system and clear, accessible workflows, without changing backend code or contracts.

**Architecture:** Add a shared Ant Design theme, Merchant shell integration for both current app modes, and eight small CMS patterns. Migrate screens in vertical groups, keeping existing routes, data clients, permissions, and business actions while using guided steps for lengthy forms.

**Tech Stack:** React 19, TypeScript, Vite, Ant Design 6, Tailwind CSS, React Router 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-merchant-cms-redesign-design.md`

## Global Constraints

- Stack: React, TypeScript, Vite, Ant Design 6, and the existing Tailwind CSS.
- This is a frontend-only change. Do not change backend code, APIs, authorization, database schema, migrations, or business rules.
- Keep the Merchant theme/provider inside the Merchant branches of `BackendConsoleLayout` and `ConsoleLayout`; Admin, Member, public, and storefront routes remain outside it.
- Keep existing routes and query behavior usable. The Orders view currently uses `tab=fees`, `orderId`, and `voucherId`; retain them.
- Use only real API responses for operational and dashboard data. Keep endpoints and server business rules authoritative.
- Refund approval must continue to show the backend impact preview, require a separate confirmation, and reject must require a reason.
- Do not redesign the Member Storefront, Zalo Mini App, public pages, or Admin CMS.
- Keep hand-written production modules cohesive and generally below 250 lines where practical.
- Preserve unrelated local changes; stage and commit only the paths in the completed milestone.

## Review Focus

- Merchant theme or navigation leaking into Admin/Member/public routes — pin with role-isolation tests in Task 1.
- Direct links and refresh losing order, refund, fee-ledger, reward-queue, or customer detail selection — pin URL-state tests in Tasks 1 and 3.
- Missing/unknown backend status being shown as a successful outcome or enabling an action — pin status/action eligibility tests in Tasks 1, 2, and 5.
- Long forms skipping step validation or losing edits when moving backward — pin wizard tests in Tasks 2, 3, and 4.
- Empty/error responses being replaced by fabricated metrics or data — pin resource-state tests in Tasks 1 and 3; verify actual data/empty states in browser screenshots in Task 5.

---

## File Structure

- `apps/frontend/src/features/merchant/cms/merchantCmsTheme.tsx`: theme tokens and Merchant-only `ConfigProvider` wrapper.
- `apps/frontend/src/features/merchant/cms/Cms*.tsx`: the eight typed shared patterns; `index.ts` exports the public surface.
- `apps/frontend/src/layouts/BackendConsoleLayout.tsx`: authenticated Merchant shell only; Admin branch remains visually and behaviorally unchanged.
- `apps/frontend/src/layouts/ConsoleLayout.tsx`: demo Merchant shell only; demo Admin branch remains unchanged.
- Existing feature modules under `features/merchant`, `features/customers`, `features/events`, `features/analytics`, and `features/storefront`: keep data loading and domain actions near their owners; extract focused view/form modules where a screen exceeds the repository size guideline.
- `apps/frontend/src/app/App.tsx`: only additive product editor routes; preserve current list and deep-link routes.
- `tests/frontend/unit/merchant-cms.test.tsx`: shared pattern, provider isolation, responsive/navigation and state behavior.
- Existing feature tests: extend the suites that already cover Merchant APIs and workflows.
- `docs/frontend/merchant-cms-migration.md`: shipped screen map, route/API preservation notes, and verification record.
- `docs/qa/assets/merchant-cms/`: screenshots from actual local responses or true empty states.

## Execution Method

Implement natively in this session, one vertical milestone at a time. The shared CMS interfaces are used by each later group, so build and verify the foundation first; keep each commit limited to its own frontend, test, documentation, and screenshot paths.

### Task 1: Merchant foundation, Orders, and Refunds

**Files:**
- Modify: `apps/frontend/package.json`, root `package-lock.json` (Ant Design 6 dependency only; preserve existing unrelated lockfile edits)
- Create: `apps/frontend/src/features/merchant/cms/merchantCmsTheme.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsPageHeader.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsDataTable.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsFilterBar.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsStatusTag.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsDetailLayout.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsFormDrawer.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsConfirmAction.tsx`
- Create: `apps/frontend/src/features/merchant/cms/CmsStatCard.tsx`
- Create: `apps/frontend/src/features/merchant/cms/index.ts`
- Modify: `apps/frontend/src/layouts/BackendConsoleLayout.tsx`, `apps/frontend/src/layouts/ConsoleLayout.tsx`
- Modify: `apps/frontend/src/features/merchant/backend/BackendMerchantOrdersPage.tsx`
- Modify: `apps/frontend/src/features/merchant/refunds/MerchantRefundRequestsPage.tsx`, `MerchantRefundReviewDialog.tsx`
- Modify: demo `apps/frontend/src/features/merchant/legacy/MerchantOrdersPage.tsx`
- Create/modify tests: `tests/frontend/unit/merchant-cms.test.tsx`, `v4-navigation-ux.test.tsx`, `v4-refund-merchant.test.tsx`, `m7-merchant-experience.test.tsx`, `merchant-abuse-report.test.tsx`

**Interfaces:**
- Produces a `MerchantCmsProvider({ children: ReactNode })` that applies Ant Design tokens only to Merchant branches.
- `CmsPageHeader` accepts `title`, optional `description`, `breadcrumbs`, and `action`.
- `CmsDataTable<T>` accepts typed columns/rows, `rowKey`, loading state, and Ant Design pagination settings; it keeps horizontal overflow and empty state consistent.
- `CmsFilterBar` composes labelled filter controls without owning filter state.
- `CmsStatusTag` accepts a business label and semantic tone; callers map actual backend statuses.
- `CmsDetailLayout` accepts title, breadcrumb/list link, metadata, actions, and detail content.
- `CmsFormDrawer` accepts open/title/close/width/footer and focused form content.
- `CmsConfirmAction` accepts trigger/description/pending/disabled/confirm callback and never performs the action itself.
- `CmsStatCard` accepts label and backend-provided value/description only.
- `/merchant/orders?tab=fees`, `orderId`, and `voucherId` remain selection state; refunds use `?requestId=<id>` on the existing route.

- [ ] **Step 1: Add regression tests first.** In `merchant-cms.test.tsx`, assert Merchant theme presence and Admin theme absence for both shells, table loading/empty state, label/action keyboard access, and a narrow-screen filter layout. Update refund tests to assert detail by `requestId`, visible read-only preview, required approval confirmation, required rejection reason, and URL restoration on refresh. Keep fractional point and refund eligibility tests in `m7-merchant-experience.test.tsx`.
- [ ] **Step 2: Run the targeted tests and verify the new assertions fail** for the missing CMS components/provider and the current card/dialog flows.
- [ ] **Step 3: Add `antd@^6` to the frontend workspace, define compact neutral theme tokens, and implement the eight patterns in the files listed above.** Keep wrappers typed and narrow; do not put business logic in them.
- [ ] **Step 4: Integrate the provider into only each shell's Merchant branch.** Add grouped navigation labels, page title/action header, breadcrumbs for deep pages, responsive menu close behavior, and Admin role regression coverage.
- [ ] **Step 5: Migrate Orders to a table/detail view.** Keep purchase orders separate from reward fulfillment and fee ledger; use existing API data, preserve query parameters and existing abuse/policy actions, and render refund actions only when `order.actions.canRefund` confirms eligibility.
- [ ] **Step 6: Migrate Refunds to a paginated table and URL-addressable detail.** Keep status filter/page API parameters. Show the fetched impact preview read-only. Approval remains a second explicit confirmation after review; rejection remains disabled until a nonblank reason; reload after the backend response.
- [ ] **Step 7: Migrate demo Orders with shared CMS patterns while retaining its existing demo routes/data source.** Do not add fixtures.
- [ ] **Step 8: Run `npx vitest run --config tests/frontend/vitest.config.ts tests/frontend/unit/merchant-cms.test.tsx tests/frontend/unit/v4-navigation-ux.test.tsx tests/frontend/unit/v4-refund-merchant.test.tsx tests/frontend/unit/m7-merchant-experience.test.tsx tests/frontend/unit/merchant-abuse-report.test.tsx`; then root typecheck/build.** Expected: all pass.
- [ ] **Step 9: Review the scoped diff and commit** `feat(merchant): add CMS foundation and migrate orders and refunds`.

### Task 2: Products, Categories, Vouchers, Inventory, and Rewards

**Files:**
- Modify: `apps/frontend/src/app/App.tsx`, `features/merchant/MerchantProductsPage.tsx`, `MerchantProductTableRow.tsx`, `MerchantProductFiltersBar.tsx`, `MerchantProductGalleryEditor.tsx`, `MerchantCategoriesPage.tsx`, `MerchantCategoriesPanel.tsx`, `InventoryPanel.tsx`
- Create: `features/merchant/MerchantProductEditorPage.tsx`, `MerchantProductWizard.tsx`, `MerchantVoucherWizard.tsx`
- Modify: `features/merchant/MerchantVoucherTableRow.tsx`, `MerchantRewardQueue.tsx`, `backend/BackendMerchantVouchersPage.tsx`
- Modify demo: `features/merchant/legacy/MerchantProductsPage.tsx`, `MerchantVouchersPage.tsx`, `MerchantRewardsPage.tsx`
- Modify/create tests: `tests/frontend/unit/v4-catalog.test.tsx`, `m7-merchant-experience.test.tsx`, `merchant-cms.test.tsx`

**Interfaces:** consumes Task 1 CMS component exports. New product routes are `/merchant/products/new` and `/merchant/products/:productId/edit`; the existing `/merchant/products` list route remains.

- [ ] **Step 1: Add tests** for existing product filters/status/inventory actions, dedicated editor URL, back/forward wizard state, validation per step, voucher type dependent fields, reward-product loading/error/empty states, and existing voucher/reward actions.
- [ ] **Step 2: Run `v4-catalog.test.tsx`, `m7-merchant-experience.test.tsx`, and the new cases to confirm the route/editor/table expectations fail.**
- [ ] **Step 3: Migrate product and category lists to `CmsDataTable`, `CmsFilterBar`, and `CmsStatusTag`.** Keep existing catalog query contracts and status/stock endpoints.
- [ ] **Step 4: Replace the oversized product dialog with a focused dedicated editor.** Use Ant Design `Steps` for basics, description/gallery, and inventory/review; validate each step; submit only through existing create/update calls; keep initial stock create-only and preserve gallery ordering.
- [ ] **Step 5: Migrate inventory adjustment and movement history to focused Ant Design drawers.** Keep adjustment reason and quantity rules and preserve existing APIs.
- [ ] **Step 6: Migrate Voucher definitions/reward queues to tables.** Make voucher creation a short guided flow: type and points; discount terms or existing active reward product; final summary and submit. Keep `discountAmount` exact string and only submit the selected backend-valid reward product.
- [ ] **Step 7: Replace high-detail voucher stock/history dialogs with focused drawers and wrap destructive or fulfill/cancel actions in `CmsConfirmAction` where the existing flow requires confirmation.** Preserve backend status responses and reason requirements.
- [ ] **Step 8: Apply the shared patterns to the demo catalog/voucher/reward screens without changing demo data behavior.**
- [ ] **Step 9: Run the targeted tests, `npm run typecheck`, and `npm run build`; review and commit** `feat(merchant): migrate catalog and voucher workflows`.

### Task 3: Loyalty, Customers, Overview, and Analytics

**Files:**
- Modify: `features/merchant/backend/BackendMerchantLoyaltyPage.tsx`, `MerchantLoyaltyTransactions.tsx`, `MerchantLoyaltyMembers.tsx`, `MerchantLoyaltyHistory.tsx`, `backend/BackendMerchantOverviewPage.tsx`
- Modify: `features/customers/MerchantCustomersPage.tsx`, `MerchantCustomerDetailPage.tsx`, `features/analytics/MerchantAnalyticsPage.tsx`, `AnalyticsProductTables.tsx`
- Modify demo: `features/merchant/legacy/MerchantLoyaltyPage.tsx`, `MerchantOverviewPage.tsx`
- Modify/create tests: `tests/frontend/unit/m7-merchant-experience.test.tsx`, `loyalty-policy-history-ui.test.tsx`, `v4-customer-analytics.test.tsx`, `merchant-cms.test.tsx`

**Interfaces:** consumes Task 1 CMS component exports; keeps loyalty/customer/analytics clients and route paths unchanged.

- [ ] **Step 1: Add tests** for loyalty step validation/back navigation and preview, exact fractional point rendering, ledger filter/query state, history/member tables, customer filter/detail deep links, real empty/error analytics state, and values absent from API being omitted rather than fabricated.
- [ ] **Step 2: Run those targeted tests and confirm the new screen expectations fail.**
- [ ] **Step 3: Migrate loyalty configuration to grouped, guided Ant Design steps.** Keep the existing draft, preview, policy warning, and single save API; validate before advancing and preserve exact decimal strings.
- [ ] **Step 4: Migrate loyalty members, ledger, and policy history to shared tables/filters/status tags.** Preserve current tabs/routes and fractional point formatting.
- [ ] **Step 5: Migrate customer list and details to table/detail layouts.** Keep customer search/filter/API paging and order/refund/wallet/voucher records from backend responses.
- [ ] **Step 6: Migrate overview statistics and analytics to Ant Design layout and `CmsStatCard`.** Show only values returned by current API responses; retain the existing revenue chart and date-range behavior.
- [ ] **Step 7: Migrate demo loyalty/overview with shared CMS patterns and keep the current demo provider/data behavior.**
- [ ] **Step 8: Run the targeted suites, `npm run typecheck`, and `npm run build`; review and commit** `feat(merchant): migrate loyalty and customer insights`.

### Task 4: Store, Storefront Editor, and Events

**Files:**
- Modify: `features/merchant/backend/BackendMerchantStorePage.tsx`, `MerchantStoreDetails.tsx`, `features/storefront/MerchantStorefrontEditor.tsx`, `StorefrontImageField.tsx`, `StorefrontOpeningHoursEditor.tsx`, `StorefrontVersionHistory.tsx`, and only other Merchant editor-owned children needed for this migration
- Modify: `features/events/MerchantEventsPage.tsx`, `MerchantEventFilters.tsx`, `MerchantEventCard.tsx`, `EventFormDialog.tsx`
- Modify demo: `features/merchant/legacy/MerchantStorePage.tsx`
- Modify/create tests: `tests/frontend/unit/v4-storefront.test.tsx`, `v4-events.test.tsx`, `merchant-cms.test.tsx`

**Interfaces:** consumes Task 1 CMS patterns; leaves public storefront pages and their member-facing components unchanged.

- [ ] **Step 1: Add tests** for editor section navigation, save draft/publish/rollback states, event step validation and retained values when moving backward, event status/search filters, and publish/unpublish/delete action eligibility.
- [ ] **Step 2: Run the targeted tests and confirm the new step/table expectations fail.**
- [ ] **Step 3: Migrate store profile display and Merchant storefront editor controls to Ant Design.** Keep the existing draft, preview, publish, version, rollback, media upload, and hours APIs; divide editor sections into clear navigation groups instead of one long form.
- [ ] **Step 4: Split `MerchantEventsPage` into a compact table/filter view and focused form state.** Replace the full event modal with a multi-step create/edit flow for essential details, schedule/media, and review; preserve event endpoints and validation.
- [ ] **Step 5: Apply `CmsConfirmAction` to destructive event operations with the existing explicit copy and error states.** Keep public event pages outside the Merchant theme.
- [ ] **Step 6: Run storefront/event tests, `npm run typecheck`, and `npm run build`; review and commit** `feat(merchant): migrate store and event management`.

### Task 5: Challenges, route-wide UX, migration notes, and evidence

**Files:**
- Modify: `features/merchant/challenges/MerchantChallengesPage.tsx`, `MerchantChallengeCard.tsx`, `MerchantChallengeActions.tsx`, `MerchantChallengeDetailPage.tsx`, `MerchantChallengeEditorPage.tsx`, `ChallengeEditorStep.tsx`, `ChallengeMilestoneEditor.tsx`
- Modify: all Merchant shell/page components still using legacy page headers, card-only data lists, high-detail modals, or inconsistent loading/error/empty states
- Create/update: `docs/frontend/merchant-cms-migration.md`, `docs/qa/assets/merchant-cms/*.png`
- Modify tests: `tests/frontend/unit/v4-challenges-merchant.test.tsx`, `v4-navigation-ux.test.tsx`, feature suites touched by final audit

**Interfaces:** consumes Task 1 CMS patterns and prior screen migrations. Challenge endpoints, permission gates, route names, and five-step business workflow are unchanged.

- [ ] **Step 1: Add/update challenge tests** for status filters, role-controlled actions, status/empty states, step navigation, locked fields, milestone validation, and detail/member-table paging.
- [ ] **Step 2: Run `v4-challenges-merchant.test.tsx` and `v4-navigation-ux.test.tsx` to verify the new table/step expectations fail before migration.**
- [ ] **Step 3: Migrate challenge list and participant views to shared filters/tables/status tags; keep detail pages and current five-step form, changing only presentation and help text needed for non-technical users.**
- [ ] **Step 4: Audit every Merchant route in both shells for active navigation, breadcrumbs, page actions, error/empty/loading states, responsive overflow, keyboard action access, and unintentional mock metrics.** Keep Admin, Member, public, and storefront routes unchanged.
- [ ] **Step 5: Discover whether Orca browser automation is genuinely available.** If it is unavailable, run the existing Playwright E2E suite only as a documented fallback when local services/env allow it. Do not invent accounts or seed production-like data.
- [ ] **Step 6: Run root `npm run typecheck`, `npm run build`, and `npm test`; capture screenshots of key Merchant pages using actual local API responses or true empty states.** Record the actual route, data source, and state for each image.
- [ ] **Step 7: Write `docs/frontend/merchant-cms-migration.md` with the screens/components migrated, preserved API/route map, commands and browser flows actually run, screenshots, limitations, and any unverified conditions.**
- [ ] **Step 8: Inspect `git diff`, verify no backend paths or unrelated existing edits are staged, then commit** `feat(merchant): complete Ant Design CMS migration`.

## Coverage Self-Review

- Requirement 1: Task 1 provides the Merchant-only theme and component audit foundation.
- Requirement 2: Task 1 migrates both Merchant shell variants with grouped navigation, breadcrumbs, responsive behavior, and page headers.
- Requirement 3: Task 1 defines all eight requested reusable patterns.
- Requirement 4: Task 1 migrates Orders and Refunds to tables/details and keeps the refund impact preview read-only.
- Requirement 5: Tasks 2–5 migrate Products, Loyalty, Vouchers, and Challenges with guided workflows; Task 4 also migrates Store, Storefront Editor, and Events; Task 3 covers Customers, Overview, and Analytics.
- Requirement 6: Existing frontend API clients, authentication, permission gates, routes, and business logic stay in place; only additive product editor routes are introduced.
- Requirement 7: Admin, Member Storefront, public pages, and Zalo Mini App remain outside the Merchant theme and visual migration.
- Requirement 8: Existing API-backed values only; tests and screenshot audit catch absent values.
- Requirement 9: Accessibility, keyboard, responsive, and resource states are tested and reviewed across all Merchant routes.
- Requirement 10: Five scoped, verifiable commits; root typecheck/build/unit tests and available browser checks are recorded.
- Deliverables: migrated screens/patterns in Tasks 1–5; migration notes and screenshots in Task 5; test results in each milestone report.

No backend integration/database check is part of this frontend-only change. Root unit command runs the repository's existing unit suites; it does not authorize modifying backend code.
