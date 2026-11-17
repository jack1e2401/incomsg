# Repository Module Refactor Design

## Goal

Make hand-written production source easier to navigate by grouping it by domain and giving modules responsibility-based names, without changing runtime behavior, API contracts, database schema, or test suite boundaries.

## Scope

- Refactor hand-written source under `apps/frontend/src` and `apps/backend/src`, plus import references needed by those moves.
- Include routes/screens, API contracts/clients/DTOs, and backend repositories where the current file has clear responsibility seams.
- Keep tests in their current paths and preserve milestone names in test filenames; update only imports that point to renamed production modules.
- Exclude generated code, dependencies, migrations, assets, and unrelated documentation/UI changes already present in the worktree.
- Do not remove other branches, worktrees, or checkouts. Do not push or merge.

## Design decisions

1. **Domain-first layout.** Put a capability under its owning domain (`member/orders`, `merchant/catalog`, `api/orders`, etc.). Nest only when the child is a clear part of its parent.
2. **Production names describe purpose.** Remove milestone labels from production source files and exported client names. Test files may retain milestone labels.
3. **Keep public seams stable.** Preserve existing route imports and `createCommerceClient` behavior through barrel/facade modules where that makes the split incremental. Preserve request paths, payloads, response types, role checks, and API semantics.
4. **Split oversized pages by route responsibility.** Member and merchant page files become focused screen modules, with their current entry modules re-exporting the same components as needed.
5. **Split API types and HTTP client by domain.** Product/catalog, orders/payments/refunds, vouchers/rewards, loyalty, finance, inventory, and admin contracts are owned by domain modules. Existing broad type/client entry points remain compatibility facades until call sites can move safely.
6. **Split repositories only at cohesive query/use-case seams.** Keep module-level repository entry points or equivalent exports stable. Do not split merely to satisfy a line count.
7. **Keep test structure stable.** No new test names or suite rearrangement is required for this behavior-preserving change. Run frontend/backend unit suites and backend integration tests; do not run E2E.
8. **Commit by coherent slice.** Make several focused commits, each limited to one completed module/domain slice. Never stage the pre-existing storefront UI edits or their docs in these commits.

## Approaches considered

- **Rename-only cleanup:** quickest and lowest risk, but the oversized member, merchant, DTO, HTTP, and repository modules would remain difficult to navigate.
- **Domain-first decomposition with compatibility facades (selected):** move responsibilities into focused domain/capability files while preserving current route/client entry points. It is a sequence of reviewable refactors, and the facade limits churn across the monorepo.
- **Whole-app architecture rewrite:** broad naming and routing redesign could produce a cleaner end state, but needlessly increases behavior and contract risk for a maintenance refactor.

The selected approach matches the user-approved scope: organize the full production source tree, preserve behavior, retain test boundaries, and commit each completed slice separately.

## Current structural hotspots

- Frontend `BackendMemberPages.tsx` combines store browsing, product detail, cart/checkout, order history, wallet, vouchers, and rewards.
- Frontend `MerchantPages.tsx` and `BackendMerchantPages.tsx` each combine multiple merchant capabilities and represent separate legacy/backend route sets.
- `commerce-types.ts` combines catalog, orders, loyalty, vouchers/rewards, inventory/refunds, finance, and admin DTOs.
- `commerce-http.ts` combines transport and requests for those same domains.
- Production auth modules use `milestone2` names (`milestone2-client.ts`, `contracts/milestone2.ts`, `Milestone2Pages.tsx`) even though they now represent auth, merchant applications, and session/merchant contracts.
- Backend repositories are already domain-scoped; split only where their current query groups have a cohesive boundary and callers can retain the same public functions.

## Non-goals

- No new product behavior, UI redesign, pricing/discount/voucher business rules, or loyalty policy changes.
- No schema/migration or endpoint changes.
- No rewriting test architecture or renaming milestone-named tests.
- No deletion of unrelated worktrees, branches, or local work.

## Acceptance

- No production source file or production API symbol remains named for a historical milestone.
- Large mixed-responsibility frontend/API modules are divided into domain/capability files with stable facades where needed.
- Backend repository splits preserve all existing call behavior and data ownership.
- Existing API and database contracts are unchanged.
- Frontend and backend unit tests pass; backend integration tests pass using the repository's safe migrated test-DB wrapper; E2E is not run.
- Each verified code slice is represented by a focused commit; pre-existing local UI edits remain outside those commits.
