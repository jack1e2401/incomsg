# M8 Admin and Anti-Abuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Complete the approved Admin account moderation, email blacklist, merchant moderation, and audit flows.

**Architecture:** Keep the existing Admin router/service/repository. Use serializable MySQL transactions with conditional state updates and audit append. Replace persisted User.isActive with User.accountStatus and derive API isActive for compatibility.

**Tech Stack:** Node.js, TypeScript, Express, Prisma 7, MySQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-11-loyalty-commerce-completion.md`, API contract and Admin access/audit policy; the user's approved M8 scope.

## Global Constraints

- Preserve existing Admin dashboard/directory, merchant application, login, and response behavior.
- AccountStatus values: ACTIVE, PENDING_APPROVAL, REJECTED, SUSPENDED, BANNED.
- Do not treat pending merchant applicants as suspended during migration.
- Admin changes require a non-empty reason and atomically append actor/action/target/before/after/time.
- Registration uses trim().toLowerCase() for blacklist checks.
- Preserve wallets, orders, vouchers, rewards, and ledger when suspending/banning.
- Use only guarded local incomsg-test; no db push, destructive DB operation, push, or merge.
- Implement only the approved M8 scope.

## Review Focus

- Pending/rejected applicants retain their login outcomes — migration and auth integration tests.
- Concurrent duplicate state changes append at most one audit row — MySQL concurrency test.
- Blacklist blocks normalized member/merchant registrations and deactivation re-allows registration — integration tests.
- Existing merchant tokens are rejected after deactivation — middleware integration test.
- Account changes preserve wallet/ledger — integration test.

---

### Task 1: RED HTTP integration tests

**Files:** Create `tests/backend/integration/admin-moderation.integration.test.ts`.

- [ ] Cover Admin-only `GET /api/admin/users`, `PATCH /api/admin/users/:userId/status` with `{status,reason}`.
- [ ] Cover `GET/POST /api/admin/email-blacklist`, `POST /api/admin/email-blacklist/:id/deactivate`.
- [ ] Cover `GET /api/admin/audit-logs`, required reasons, invalid/duplicate transitions, 401/403 and concurrent duplicates.
- [ ] Cover `PATCH /api/admin/merchants/:merchantId/status` with `{isActive,reason}`, including current-token rejection.
- [ ] Cover normalized registration block/deactivation and wallet/ledger preservation.
- [ ] Run the targeted test against current code and observe expected missing-route failures.

### Task 2: Schema and auth lifecycle

**Files:** Modify Prisma schema/migration, auth types/repository/service, auth middleware, merchant application repository, seed, and fixtures affected by removal of User.isActive.

- [ ] Add AccountStatus, EmailBlacklistEntry, AdminAuditLog; migration backfills application PENDING/REJECTED, maps other inactive accounts to SUSPENDED, then drops stored isActive.
- [ ] Update member/merchant registration, application approval/rejection, login and bearer auth to use accountStatus; retain derived API isActive.
- [ ] Add transactional normalized blacklist enforcement to both registration paths.
- [ ] Run targeted auth integration tests and backend typecheck.

### Task 3: Admin moderation endpoints

**Files:** Extend admin routes/controller/service/repository; create admin validation; extend the integration test.

- [ ] Implement paginated user, blacklist, and audit reads; validate filters, IDs, normalized email, and 1–255 character reasons.
- [ ] Implement status and merchant active-state CAS updates plus audit append in one Serializable transaction.
- [ ] Implement blacklist add/reactivate/deactivate with audit; do not mutate prior audit events.
- [ ] Run all targeted MySQL tests, including concurrency, authorization, and history preservation.

### Task 4: Verify and commit

- [ ] Run guarded `npm run test:db`, root `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Review diff for unrelated files, secrets, or generated output.
- [ ] Commit one verified milestone: `feat(admin): add audited account moderation`.
- [ ] Report paths, migration, API, tests/results, commit, and limits.

## Execution evidence

- Base commit: `737125a`; implementation taken over after the stopped Orca worker left a clean worktree.
- RED: guarded MySQL integration reported 91 pass / 7 expected missing-route failures (98 total).
- A login DTO assertion then caught internal fields in an intermediate mapper; explicit DTO projection fixed it.
- GREEN: guarded `npm run test:db` reported 99/99, including the legacy account-state SQL migration fixture.
- Root `npm test`: 28 frontend + 40 backend unit tests passed.
- Root `npm run typecheck` and `npm run build`: exit 0.
- API handoff: `docs/backend/admin-moderation.md`. Admin frontend and real-browser verification remain the following tasks.
