# Merchant Abuse Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Merchants submit auditable anomaly reports and let Admin review them without granting Merchants enforcement powers.

**Architecture:** Add an append-only `MerchantAbuseReport` record and a Merchant-only create endpoint. Add a read-only Admin list endpoint; both use existing auth, validation, pagination, Prisma, and HTTP error conventions. Reports never change account status, blacklist, points, or commerce state.

**Implementation call:** The M0 spec defines report creation but no review endpoint. Add the read-only Admin list so a report has an explicit review surface; keep it free of status, enforcement, or delete actions because no such policy was approved.

**Tech Stack:** Express, TypeScript, Prisma, MySQL, Node integration tests.

**Spec:** `docs/superpowers/specs/2026-11-11-loyalty-commerce-completion.md`, API contract `POST /api/merchant/abuse-reports` `{memberId,orderId?,reason}`.

## Global Constraints

- Merchant reports are evidence for review, not enforcement.
- Enforce merchant ownership for reporter, target member, and optional order.
- Preserve prior reports; provide no update or delete endpoint.
- Use only local `incomsg-test` for migration and integration verification.
- Do not edit or run concurrent database tests while M10 QA is using the test database.

## Review Focus

- Member from another Merchant: reject without storing a report; assert 404.
- Order from another Merchant or another member: reject without storing a report; assert 404.
- Member or Admin attempts Merchant create endpoint: reject 403.
- Merchant attempts Admin list endpoint: reject 403.
- Invalid reason, ID, or unknown body field: reject 400 without persistence.

---

### Task 1: Persist and validate reports

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_merchant_abuse_reports/migration.sql`
- Create: `apps/backend/src/modules/abuse-reports/abuse-reports.validation.ts`
- Create: `apps/backend/src/modules/abuse-reports/abuse-reports.repository.ts`
- Test: `tests/backend/integration/merchant-abuse-reports.integration.test.ts`

**Interfaces:**
- `readCreateAbuseReport(value) -> { memberId: number; orderId?: number; reason: string }`
- Repository create receives authenticated owner user ID and validated input; it resolves the owned Merchant, verifies member membership and optional order ownership, and inserts one immutable row.

- [x] Add integration cases for valid persisted report, validation, role denial, foreign member/order denial, and no state change side effects.
- [x] Run targeted test to confirm the missing endpoint/model fails (3 failures matched the absent routes; read-only Admin POST returned 404 as expected).
- [x] Add schema and additive MySQL migration with report actor, merchant, member, optional order, reason, and creation time; preserve all existing rows.
- [x] Implement merchant-scoped validation and insert. Return 404 for a target outside the Merchant's scope.
- [x] Apply migration only to guarded local `incomsg-test`, generate Prisma client, run targeted test, typecheck and build.

### Task 2: Admin review API

**Files:**
- Modify: `apps/backend/src/modules/admin/admin.routes.ts`
- Modify: `apps/backend/src/modules/admin/admin.controller.ts`
- Modify: `apps/backend/src/modules/admin/admin.service.ts`
- Modify: `apps/backend/src/modules/admin/admin.repository.ts`
- Modify: `apps/backend/src/modules/admin/admin.validation.ts`
- Modify: `docs/backend/admin-moderation.md`
- Test: `tests/backend/integration/merchant-abuse-reports.integration.test.ts`

**Interfaces:**
- `GET /api/admin/abuse-reports?merchantId=&memberId=&cursor=&limit=` returns `{items,nextCursor}`; items include report IDs, merchant/reporter/member identity, optional order, reason, and `createdAt`.

- [x] Add tests for Admin list, merchant filter, and Merchant/Member 403.
- [x] Add validated filters and read-only repository query; no status mutation or delete route.
- [x] Re-run targeted MySQL test (4/4), full MySQL integration suite (104/104), backend unit tests (40/40), backend typecheck/build, and `git diff --check` after QA released DB access.
- [x] Commit the verified backend vertical slice; do not push or merge.
