# Merchant Application Status — Implementation Plan

> **For agentic workers:** Implement each task in order. Keep the API response as the only source of review status.

**Goal:** Let a Merchant securely refresh their own PENDING, APPROVED, or REJECTED application status and verify the complete flow in the FE.

**Architecture:** A public credential-verified auth endpoint reads one application by the applicant ID resolved from the verified email/password. The React status page calls the endpoint directly, keeps credentials only during the request, and renders the returned DTO.

**Design:** [Merchant application status design](../specs/2026-11-09-merchant-application-status-design.md).

## File map

| File | Responsibility |
| --- | --- |
| `apps/backend/src/modules/auth/auth.controller.ts` | Validate and return status lookup response |
| `apps/backend/src/modules/auth/auth.routes.ts` | Publish the public POST endpoint |
| `apps/backend/src/modules/auth/auth.service.ts` | Verify credentials and restrict lookup to Merchant applicants |
| `apps/backend/src/modules/auth/auth.repository.ts` | Query DTO by trusted applicant ID |
| `tests/backend/integration/milestone-2.integration.test.ts` | Verify own-status access before/after review and reject invalid lookups |
| `docs/superpowers/specs/2026-11-09-backend-milestone-2-design.md` | Update M2 API contract and lifecycle |
| `apps/frontend/src/api/contracts/milestone2.ts` | Type the new endpoint response and path |
| `apps/frontend/src/api/milestone2-client.ts` | Send credentials to the status endpoint |
| `apps/frontend/src/features/auth/AuthPages.tsx` | Add the status lookup UI and recovery links |
| `apps/frontend/src/app/App.tsx` | Register `/application/status` in HTTP mode |
| `apps/frontend/src/components/ui/ConfirmActionDialog.tsx` | Provide accessible confirmation for Admin approval/rejection |
| `apps/frontend/src/features/auth/Milestone2Pages.tsx` | Add list refresh and confirmation before review mutations |
| `tests/frontend/e2e/milestone2.spec.ts` | Verify form, all response states, and registration link |
| `docs/frontend/milestone-2-interface-plan.md` | Keep the screen inventory and endpoint map current |

## Task 1 — Backend status endpoint (TDD)

- [x] Extend the HTTP integration suite with own-application lookup for a pending applicant, approved applicant, and rejected applicant; assert non-Merchant and wrong-password callers cannot read the status.
- [x] Run the focused integration test and confirm failure because the endpoint does not exist yet.
- [x] Add repository lookup by trusted applicant ID using the existing public application selection.
- [x] Add service method that verifies the existing password hash, requires role MERCHANT, and returns 404 for a missing application.
- [x] Add controller and `POST /api/auth/application-status`; do not use `authenticate`, because pending/rejected Merchant accounts are inactive.
- [x] Update the backend M2 contract docs; run `npm run test:milestone2`, `npm run typecheck`, and `npm run build`.

## Task 2 — Frontend status screen (TDD)

- [x] Add the path and typed client method; add client test for POST body and backend errors.
- [x] Add `/application/status` in HTTP mode with email/password fields, loading/error/retry, and API-backed state for all three application statuses.
- [x] Clear password state after each lookup; never put credentials in URL, local storage, or session storage.
- [x] Link Merchant registration success and PENDING/REJECTED login errors to the status screen; pass email through router state only.
- [x] Update the screen inventory and setup documentation.
- [x] Add Playwright tests for PENDING/APPROVED/REJECTED, invalid credentials, registration-to-status link, and review confirmation; run `npm test`, `npm run typecheck`, `npm run build`, `npm run format:check`, `npm run test:e2e:m2`, and `npm run test:e2e`.

## Task 3 — Surface audit and commit

- [x] Compare every implemented M2 API route against a screen or action, and every screen against a route; check loading, empty, failure, success, and pending states plus accessible modal/confirmation behavior.
- [x] Run `git diff --check`, review staged scope, and commit the completed BE/FE change after all verifiers pass.
