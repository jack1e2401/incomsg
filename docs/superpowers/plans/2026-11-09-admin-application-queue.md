# Admin application queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Admin merchant approval screen as a compact, full-width, responsive queue with per-application actions.

**Architecture:** Keep the existing pending-applications API client, role guard, and confirmation dialog. Replace the master-detail split with aligned desktop rows and stacked mobile cards using the same backend DTO fields, and allow this page to use less compressed title tracking.

**Tech Stack:** React, TypeScript, Tailwind CSS, React Router, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-admin-application-queue-design.md`

## Global Constraints

- Do not add fields beyond the backend DTO or derive contact/merchant data not returned by the API.
- Do not change endpoints, approval rules, or other Admin screens.
- Keep the existing approve/reject confirmation dialog and role guard.
- Keep loading, empty, error, success, and pending states connected to the existing API.

## Review Focus

- Zero pending applications: keep the existing empty state and refresh action.
- Multiple applications with similar names: ensure row actions target the application ID on that row.
- Long store names and narrow viewports: wrap content without horizontal page overflow or clipped actions.
- Approval/rejection response: render its returned status and remove the completed item from the pending queue.
- API load or action failure: preserve retry and error feedback, and do not claim a decision succeeded.

---

### Task 1: Responsive Admin approval queue

**Files:**

- Modify: `src/features/auth/Milestone2Pages.tsx`
- Modify: `src/components/ui/index.tsx`
- Test: `playwright/milestone2.spec.ts`

**Interfaces:**

- Consumes: `BackendApplicationDto` fields `id`, `applicantId`, `storeName`, `status`, `reviewedById`, and `reviewedAt`.
- Produces: one pending item per row/card; approve/reject actions pass that item's `id` to the existing `decide` handler.
- Produces: optional `PageHeader.titleClassName?: string` so only this screen can relax title tracking.

- [x] **Step 1: Add a failing Playwright test**
  - Stub `GET /api/admin/merchants/pending` with two distinct application DTOs.
  - Assert each store name appears once, each application and applicant ID is visible, each item has its own approve/reject actions, and no separate detail pane repeats the selected store name.
  - Repeat at desktop and mobile widths; assert the page does not overflow horizontally.
- [x] **Step 2: Run the focused Playwright test and verify it fails**
  - Run: `node node_modules/@playwright/test/cli.js test --config playwright.m2.config.ts --grep "Admin approval queue"`
  - Expected: FAIL because the current screen renders the split master-detail layout.
- [x] **Step 3: Implement the queue layout**
  - Add optional `titleClassName` to `PageHeader` and pass a lighter tracking class from `AdminApplicationsM2`.
  - Replace `selectedId`, the detail panel, and the `Xem` control with aligned desktop rows and stacked mobile cards; include the API-backed store name, application ID, applicant ID, status, and per-item actions.
  - Keep the current count, refresh, loading, empty, error, action busy, response notice, and confirmation dialog behavior.
- [x] **Step 4: Run the focused Playwright test**
  - Run: `node node_modules/@playwright/test/cli.js test --config playwright.m2.config.ts --grep "Admin approval queue"`
  - Expected: PASS on desktop and mobile with no horizontal overflow.
- [x] **Step 5: Run full verification**
  - Run: `npm run typecheck`, `npm test`, `npm run test:e2e:m2`, `npm run build`, and `npm run format:check`.
  - Expected: all commands exit 0.
- [x] **Step 6: Commit**
  - Commit the screen, shared header prop, and Playwright test as `feat(frontend): streamline admin approval queue`.
