# Merchant Challenge Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use (`- [ ]`) checkbox syntax for tracking.

**Goal:** Replace the crowded Merchant challenge table and modal editor with a responsive campaign workspace and guided full-page create/edit flow.

**Architecture:** Keep the existing challenge client and DTOs. Localized labels and reusable list/detail components present API data; a route-based editor owns create/edit form state and saves new campaigns as drafts. Existing activate/pause/archive/delete operations remain unchanged.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, Radix Dropdown Menu, Vitest, Testing Library.

**Spec:** [Challenges experience redesign](../specs/2026-11-17-challenges-experience-redesign.md)

## Global Constraints

- Do not change challenge API, schema, authorization, budget, reward, or refund rules.
- Use existing Merchant endpoints and render mutation results from their responses.
- Do not expose raw challenge type/status/reward enums in the Merchant UI.
- Do not use a modal for challenge field entry.
- New challenges save as draft; activation remains a separate existing action.
- Remove horizontal overflow by changing layout, not clipping content.
- Preserve search, filters, pagination, edit locks, and all existing actions.

## Review Focus

- All challenge types and statuses must have a Vietnamese label; test all enum cases and avoid falling back to raw values.
- A merchant cannot edit type/target/reward/start after activation or progress; test `lockedFields` behavior.
- A low budget or invalid date must block saving with an actionable error; test the existing validation cases.
- Create/edit routes must not render a dialog and must preserve the challenge list/detail route; test route destinations and page headings.
- Mobile cards and participant lists must not depend on min-width tables or horizontal scrolling; test responsive markup has no `min-w-[1050px]`/`overflow-x-auto` wrapper.

## Tasks

### Task 1: Localize challenge labels

**Files:**

- Create: `apps/frontend/src/features/merchant/challenges/challenge-labels.ts`
- Test: `tests/frontend/unit/v4-challenges-merchant.test.tsx`

**Interfaces:**

- `challengeTypeLabel(type: ChallengeType): string`
- `challengeStatusLabel(status: ChallengeEffectiveStatus): string`
- `challengeRewardStateLabel(state: ChallengeRewardState): string`

- [x] Add assertions for all type/status/reward enum labels and assert displayed copy contains no raw enum.
- [x] Run the merchant unit file and confirm localization assertions fail against the current raw-enum UI.
- [x] Implement typed lookup tables with explicit Vietnamese values; do not add a generic fallback for known enum unions.
- [x] Re-run the focused unit file and confirm label assertions pass.
- [x] Commit as `feat(merchant): localize challenge labels`.

### Task 2: Replace the campaign table with responsive cards

**Files:**

- Modify: `apps/frontend/src/features/merchant/challenges/MerchantChallengesPage.tsx`
- Create: `apps/frontend/src/features/merchant/challenges/MerchantChallengeCard.tsx`
- Create: `apps/frontend/src/features/merchant/challenges/MerchantChallengeActions.tsx`
- Test: `tests/frontend/unit/v4-challenges-merchant.test.tsx`

**Consumes:** label functions from Task 1.

- [x] Add tests for localized type/status, key fields, detail navigation, pagination, and each action menu item.
- [x] Run the merchant unit file and confirm the new responsive/action assertions fail against the current table.
- [x] Render campaign cards with title, status, goal, final reward, date range, budget use and completion count; use one primary detail link.
- [x] Move edit, activate/pause, archive, feature and delete into an accessible action menu; keep delete unavailable when `hasProgress`.
- [x] Keep server filters, pagination, loading/error/empty states, and existing mutation refresh behavior.
- [x] Remove the 1,050px minimum-width table and all horizontal overflow from this page.
- [x] Re-run the merchant unit file and confirm list/action assertions pass.
- [ ] Commit as `feat(merchant): redesign challenge campaign list`.

### Task 3: Replace the modal with a route-based editor

**Files:**

- Modify: `apps/frontend/src/app/App.tsx`
- Create: `apps/frontend/src/features/merchant/challenges/MerchantChallengeEditorPage.tsx`
- Create: `apps/frontend/src/features/merchant/challenges/ChallengeEditorStep.tsx`
- Delete: `apps/frontend/src/features/merchant/challenges/ChallengeFormDialog.tsx`
- Modify: `tests/frontend/unit/v4-challenges-merchant.test.tsx`

**Routes:** `/merchant/challenges/new` and `/merchant/challenges/:challengeId/edit`.

- [x] Add route tests for new/edit pages, sequential step navigation, no `role="dialog"`, and successful save navigation.
- [x] Add validation tests for title/target/reward, end date after start date, active-budget checks where applicable, and locked fields.
- [x] Run the merchant unit file and confirm new editor assertions fail before replacing the dialog.
- [x] Implement four steps: `Thông tin`, `Mục tiêu & điểm thưởng`, `Thời hạn & ngân sách`, `Rà soát`.
- [x] Save new challenges as DRAFT and navigate to the saved challenge detail; keep activate as a separate existing action.
- [x] Load existing challenge detail for edit; preserve lock behavior and only send editable fields to `updateMerchantChallenge`.
- [x] Connect list edit actions to the new route and remove the modal caller/file.
- [x] Re-run merchant tests and confirm create/edit, route, and validation assertions pass.
- [x] Commit as `feat(merchant): add full-page challenge editor`.

### Task 4: Redesign Merchant challenge detail

**Files:**

- Modify: `apps/frontend/src/features/merchant/challenges/MerchantChallengeDetailPage.tsx`
- Test: `tests/frontend/unit/v4-challenges-merchant.test.tsx`

**Consumes:** labels from Task 1 and editor route from Task 3.

- [x] Add tests for localized campaign/reward state, responsive participant display, edit navigation, pagination, and issued/reversed grant history.
- [x] Run the merchant unit file and confirm new detail assertions fail against the current raw-enum tables.
- [x] Group goal, dates, final points and budget data into a campaign summary; show progress counts from the detail DTO.
- [x] Replace the 700px participant table with desktop columns and mobile participant cards; keep pagination.
- [x] Add a clear route to edit and retain detail/back navigation.
- [x] Re-run merchant tests and confirm detail behavior passes.
- [x] Commit as `feat(merchant): redesign challenge detail workspace` (`6e6f0c2`).

### Task 5: Verify the Merchant milestone

- [x] Run focused challenge/navigation unit suites; confirm all 29 tests pass.
- [x] Run `npm run build --workspace apps/frontend` (`tsc -b` and Vite pass; Vite reports the existing large-chunk advisory).
- [x] Review `git diff --check`; confirm no API/schema or E2E changes were made for this UI work.
- [x] Commit detail workspace as `6e6f0c2 feat(merchant): redesign challenge detail workspace` and navigation/scrollbar polish separately as `54981fd style(merchant): hide nav scrollbar and reset route scroll`.

## Acceptance

- Merchant can browse, filter, paginate, inspect, create, edit, activate, pause, feature, archive and conditionally delete challenges.
- Campaign list/detail fit mobile and desktop without horizontal scrolling or raw enum labels.
- Create/edit uses dedicated routes and a guided page, never a form-entry modal.
- Existing validation, field locks, API response states and backend authority are preserved.
