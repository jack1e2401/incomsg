# IncomSG Merchant CMS Redesign

## Intent

Give merchants a consistent, compact, end-to-end operations UI inspired by Shopify Admin and Ant Design Pro. Make the existing features easier for non-technical users to understand and operate while preserving commerce rules, API calls, role boundaries, routes, and the Member Storefront/Zalo Mini App.

## Goals

- Apply Ant Design 6 components and a neutral Merchant-only token theme throughout both the authenticated Merchant console and the existing Merchant demo mode.
- Improve each Merchant shell with grouped navigation, page titles, breadcrumbs, and responsive behavior without changing Admin styling.
- Create reusable patterns: `CmsPageHeader`, `CmsDataTable`, `CmsFilterBar`, `CmsStatusTag`, `CmsDetailLayout`, `CmsFormDrawer`, `CmsConfirmAction`, and `CmsStatCard`.
- Migrate Orders and Refunds first. Use tables for lists, details for review, and read-only previews before consequential actions.
- Migrate all remaining Merchant areas in later vertical milestones: Products, Categories, Loyalty, Vouchers, Challenges, Store, Storefront Editor, Events, Customers, Analytics, Overview, and reward/inventory workflows.
- Split long forms and modals into guided steps; keep extensive editing on dedicated pages and short actions in focused drawers.
- Keep loading, error, empty, permission, keyboard, and narrow-screen behavior usable and accessible.
- Use only real API responses for operational and dashboard data. Keep endpoints and server business rules authoritative.
- Provide migration notes, test evidence, and screenshots of key CMS pages.

## Non-goals and anti-goals

- Do not redesign the Member Storefront, Zalo Mini App, public pages, or Admin CMS.
- This is a frontend-only change. Do not change backend code, APIs, authorization, database schema, migrations, or business rules.
- Do not alter order, refund, payment, inventory, voucher, loyalty, or challenge business rules or API contracts as part of this visual migration.
- Do not show optimistic financial/loyalty outcomes as confirmed or invent dashboard metrics, sample production data, or unsupported actions.
- Avoid oversized cards and forms, decorative gradients, redundant labels, and badge-heavy screens.

## Constraints

- Stack: React, TypeScript, Vite, Ant Design 6, and the existing Tailwind CSS.
- Work in the checked-out repository and preserve current local changes.
- Keep the Merchant theme/provider inside the Merchant branches of `BackendConsoleLayout` and `ConsoleLayout`; Admin, Member, public, and storefront routes remain outside it.
- Keep existing routes and query behavior usable. The Orders view currently uses `tab=fees`, `orderId`, and `voucherId`; retain them.
- Orders come from the existing merchant orders client. Refund requests use the existing paginated merchant endpoint and detail/decision endpoints.
- Refund approval must continue to show the backend impact preview, require a separate confirmation, and reject must require a reason.
- No schema or migration change is required for the first milestone.
- Keep hand-written production modules cohesive and generally below 250 lines where practical.

## Approaches

1. **Incremental Merchant-only Ant Design migration (specified approach).** Add one Merchant-scoped provider/theme and a small CMS component layer, migrate Orders and Refunds first, then move Products, Loyalty, Vouchers, and Challenges in independent milestones. This preserves the existing Admin shell and limits each migration's regression surface.
2. **Replace all Merchant screens at once.** This could make every screen visually consistent immediately, but would mix unrelated workflows and make the first review harder to validate. It conflicts with the requested incremental migration.
3. **Apply Ant Design to the shared Admin and Merchant console.** This could share more shell code, but it violates the Merchant-only theme requirement and could change Admin behavior.

The staged, Merchant-only approach is the one defined by the request and is the design baseline. The remaining component details are implementation choices within the constraints below.

## Design and behavior

### Merchant shell and theme

- Keep current route shells and auth/permission gates. Apply the theme to Merchant branches in `BackendConsoleLayout` and `ConsoleLayout` without changing Admin navigation or styling.
- Define theme tokens centrally: primary green, neutral page/surface/text colors, semantic success/warning/error colors, compact control heights, borders, and restrained radii/shadows.
- Render grouped navigation with clear active states, a responsive collapsible sidebar, page title/action area, and breadcrumbs derived from the current Merchant route. Detail/editor routes should have useful labels and a path back to their list.
- Keep existing Tailwind styles available during migration; new CMS primitives use Ant Design and may compose Tailwind for layout only.

### Reusable CMS patterns

- `CmsPageHeader`: title, optional description/breadcrumbs, and one concise action area.
- `CmsDataTable`: typed Ant Design table wrapper with row identity, horizontal overflow handling, and consistent empty/loading states.
- `CmsFilterBar`: compact, labelled filters and search controls that work at narrow widths.
- `CmsStatusTag`: shared semantic colors and existing Vietnamese business-status labels; never derive a status from frontend inference.
- `CmsDetailLayout`: responsive title/metadata/content/action structure for selected records.
- `CmsFormDrawer`: focused form container for short edits; long creation/editing flows remain dedicated pages.
- `CmsConfirmAction`: keyboard-accessible confirmation for consequential actions, with pending/error handling owned by the caller.
- `CmsStatCard`: compact display for backend-provided values only; omit a statistic when the API does not provide it.

### First milestone: Orders and Refunds

- Keep `/merchant/orders` and the existing `tab=fees`, `orderId`, and `voucherId` parameters. Replace purchase-order cards with a compact table; retain reward fulfillment as its own section and keep the fee ledger view intact.
- Show purchase details through the existing `orderId` selection, rendered as a detail view with a return path to the list. Preserve member/item/totals/payment/points/status fields, applied-policy inspection, abuse reporting, and backend-controlled refund eligibility.
- Keep `/merchant/refund-requests`. Replace request cards with a paginated table and compact status filter. Open the selected request as a detail view addressable by a query parameter so the detail can be refreshed/shared without adding a new API route.
- In the refund detail, display the request, order/member context, and the backend-provided read-only impact preview (wallet/carry/debt, tier, voucher, challenge reversals). Keep approve/reject endpoints unchanged. Approval always needs a distinct confirmation after preview review; rejection remains disabled until a reason is provided.
- Do not add order search/pagination API parameters or client-side outcome calculations in this milestone. Use the data and paging behavior supported by current endpoints.
- Preserve real loading, error, and empty states; refresh the affected resource after a successful decision.

### Later milestones

1. **Products, Categories, Vouchers, Inventory, and Rewards:** standardize product/category/voucher/reward tables, filters and status actions. Move detailed product editing to a dedicated route and make voucher creation a short guided flow for discount versus reward-product choices.
2. **Loyalty and Customers:** migrate policy configuration, members, transaction/history tables, customer list and profile details. Split loyalty configuration into short guided sections while preserving exact fractional point display and policy preview behavior.
3. **Store, Storefront Editor, Events, Overview, and Analytics:** migrate the store profile and storefront management, make event creation/editing step-based, and retain real API-backed reports without adding metrics.
4. **Challenges and route-wide consistency:** migrate list/detail/editor presentation to shared table/status/detail patterns, preserve its existing step workflow, and audit page headers, navigation, loading/error/empty states across every Merchant route.

Apply the same shared components to the existing Merchant demo mode while preserving its routes and current data source. Do not add demo fixtures or expose demo data in the production console.

Each later milestone will be checked against its existing frontend tests and API contract before being committed independently.

## Acceptance checks

- Ant Design 6 is installed in the frontend workspace and its Merchant theme is active only inside Merchant route branches in both current shells.
- Admin, Member, public storefront, and Zalo Mini App remain unaffected.
- CMS components cover all eight named patterns and have typed, accessible interfaces; every existing Merchant screen uses the shared Ant Design foundation.
- Orders and Refunds use tables and detail views while preserving routes, query-based order selection, fee/reward views, current filters/pagination, action eligibility, and confirmation safeguards.
- No frontend-calculated order/refund/loyalty outcome or mock metric is introduced.
- Existing affected frontend tests pass; root typecheck, build, and unit suites pass. Run the real local Orca browser flow when available; if unavailable, use the repository's browser suite as a secondary fallback and report which exact checks ran.
- Long product, voucher, event, challenge, loyalty, and storefront workflows are divided into clear steps/sections; concise actions remain focused and keyboard-accessible.
- Capture screenshots for key migrated pages and record their route/data source. Use actual local data or empty states, never fixture metrics presented as production data.
- Review the final diff and commit only the completed milestone's paths, leaving pre-existing work unstaged.

## Open implementation calls

- The first refund detail can use `?requestId=<id>` on the existing `/merchant/refund-requests` route. The URL parameter should be the single source of selection state, matching the existing `orderId` approach.
- Keep confirmation UI separate from the read-only impact preview. The preview itself never submits or computes a financial change.
- If a real backend/local database or browser session is unavailable, capture and report only the checks that can be run; do not seed application data to make screenshots appear populated.
