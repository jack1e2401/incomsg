# Login UI and Refresh Session Implementation Plan

## Scope

1. Redesign the signed-out member card in the storefront profile page to match the supplied mobile reference while retaining the existing storefront header, route context, and bottom navigation.
2. Add opaque rotating refresh sessions stored as hashes, delivered in an HttpOnly cookie, with access-token refresh and authenticated request retry support.
3. Keep existing unrelated workspace changes untouched. Create the schema migration, but run integration migrations only against the guarded test database; do not migrate the local `incomsg` database.

## Implementation sequence

### A. Signed-out profile UI

- Add a focused component test for the guest profile card, its heading/copy, login and registration destinations, and retained profile navigation shell.
- Run the test and confirm it fails for the expected missing layout expectations.
- Refine spacing, icon block, typography, and full-width actions at mobile widths; maintain a balanced max-width card on desktop and use existing storefront accent color.
- Run the focused test and frontend unit suite.
- Commit only the UI component and its test as `style(storefront): refine signed-out profile entry`.

### B. Backend refresh sessions

- Add failing unit/integration coverage for login creating a refresh session, refresh rotation/replay rejection, logout revocation, and invalid/expired session handling.
- Add a `RefreshSession` Prisma model and migration with token hash uniqueness, user relation, expiry/revocation timestamps, and rotation lineage as needed by the repository's replay policy.
- Implement secure random opaque token generation, hashing, cookie options, refresh and logout routes, and active-user/account checks on refresh.
- Enable credentialed CORS for the configured frontend origin and ensure cookie clearing uses the same attributes as setting it.
- Run backend unit and guarded integration tests plus typecheck/build.

### C. Frontend session lifecycle

- Add failing tests for credentialed refresh, session restoration on provider startup, single-flight refresh, one retry after 401, and logout cleanup.
- Centralize authenticated JSON request behavior so all API clients can use the latest access token, refresh once on 401, and retry the original request at most once.
- Update auth contracts/client and `AuthSessionProvider`; refresh cookie stays inaccessible to JavaScript and only access token/user data enter sessionStorage.
- Run focused and full frontend unit tests plus production build. Do not run E2E tests.
- Commit frontend and backend auth changes separately as `feat(auth): add rotating refresh sessions` (including its migration).

## Verification

- Backend unit tests and integration tests via `scripts/test-backend-db.mjs` only.
- Frontend unit tests and build.
- No browser/E2E run.
- Confirm Git staging contains only files for the relevant commit and leave pre-existing dirty files untouched.
