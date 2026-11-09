# Admin application queue redesign

## Intent

Make the Admin merchant approval screen easier to scan and act on. The current master-detail view repeats the store name and leaves an under-filled detail panel because the backend DTO contains only application ID, applicant ID, store name, status, reviewer ID, and review time.

## Approaches

1. **Compact full-width queue — selected.** Show one full-width row per pending application, with the store name, application ID, applicant ID, status, and approve/reject actions together. It removes duplicated detail content and keeps the desktop-first screen useful with the fields the API actually returns.
2. **Application cards.** Give each request a larger visual card with inline actions. This uses more vertical space without adding API data.
3. **Keep master-detail and polish it.** Improve typography and spacing while retaining the duplicate store name and sparse detail panel.

## Design

- Replace the table-plus-detail split with a single full-width approval queue.
- On desktop, align the API-backed fields and actions in compact table-like rows. On mobile, render the same fields in stacked cards with reachable actions.
- Keep pending count, refresh, loading, empty, error, success, and confirmation states connected to the existing API.
- Use the backend response after approval/rejection as the only source of the resulting status.
- Reduce the Admin page title's negative letter spacing so Vietnamese word gaps remain legible; scope the adjustment to this screen.

## Constraints and non-goals

- Do not add fields beyond the backend DTO or derive contact/merchant data not returned by the API.
- Do not change endpoints, approval rules, or other Admin screens.
- Keep the existing approve/reject confirmation dialog and role guard.

## Acceptance

- Each pending application appears once and can be approved or rejected from its row/card.
- The layout remains usable on desktop and mobile.
- Loading, empty, error, confirmation, and success behaviors remain intact.
- UI checks and production build pass.
