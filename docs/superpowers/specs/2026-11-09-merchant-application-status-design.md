# Merchant Application Status Screen — Design

## Intent

After a Merchant submits an application, they need a reliable way to check whether it is still pending, approved, or rejected. The frontend currently shows the registration response once, but the user cannot refresh that state later.

## Current API constraint

Backend M2 has no applicant-owned status query. `GET /api/admin/merchants/pending` is Admin-only and stops returning an application after review. `GET /api/merchant/me` requires an active Merchant token; pending and rejected accounts cannot log in or obtain such a token. A frontend-only status indicator would become stale and could not confirm approval.

## Decision

Add `POST /api/auth/application-status` with `{ email, password }`. The service verifies the credentials using the existing scrypt verifier, requires the authenticated identity to be a Merchant applicant, and returns that applicant's `ApplicationDto`. No token or password is persisted by this flow. This supports PENDING, APPROVED, and REJECTED without exposing another applicant's status.

The FE adds a public `/application/status` screen with credential fields, loading/error state, and backend-confirmed status. Merchant registration success links to the screen; PENDING/REJECTED login errors link to it. Approved users can continue to login and reach `/api/merchant/me`.

## Scope

- In scope: one auth status endpoint, its validation/service/repository/controller route, UI screen and route, registration/login links, BE integration tests and HTTP-mode Playwright coverage.
- Out of scope: password reset, application edits/resubmission, email notifications, Admin history APIs, changes to commerce endpoints.
- Anti-goals: do not store the submitted password, infer approval from a local cache, or let a caller query by application ID alone.

## Other approaches considered

- Reuse login error codes and local registration state: smallest change, but approval cannot be refreshed after registration and is lost on a new device.
- Add an authenticated status route: inactive pending/rejected users cannot get the required token, so this does not solve the flow.
- Verify applicant credentials on a dedicated status route: chosen because the public caller proves account ownership while inactive accounts can still read only their own status.

## API contract

- `POST /api/auth/application-status`
- Request: `{ email: string, password: string }` using existing login validation limits.
- Success: `200 { application: ApplicationDto }`.
- Invalid credentials: `401 { error: "INVALID_CREDENTIALS" }`.
- Non-Merchant or missing application: `404 { error: "APPLICATION_NOT_FOUND" }`.
- The endpoint never accepts application ID, applicant ID, or role from the caller.

## UI states

- Form: email and password; password is kept only in component state and cleared after each lookup.
- Loading: disable submit and show progress.
- PENDING: show application name/ID and explain that Merchant access is unavailable until approval.
- APPROVED: show backend review time and direct the user to sign in.
- REJECTED: show backend review time and the available support path; do not claim resubmission is available.
- Error: translate known backend errors; keep the form usable for retry.
