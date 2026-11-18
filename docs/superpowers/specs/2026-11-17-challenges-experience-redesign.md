# Challenges experience redesign

**Date:** 2026-11-17  
**Status:** Proposed for user approval  
**Member direction:** Mission path with visible milestones and restrained animation  
**Merchant direction:** Dedicated challenge editor and responsive campaign workspace

## Intent

Replace the current plain progress bars and crowded Merchant challenge table with a coherent challenge experience. Members should understand what to do next and feel progress toward a final reward. Merchants should be able to create and manage campaigns through a clear, full-page workflow.

Use Duolingo as inspiration for milestone pacing and responsive feedback, and [Antavo's Challenges workflow](https://docs.antavo.com/docs/challenges) as a reference for separating the campaign list, configuration steps, and activation. Keep IncomSG's visual identity and the existing challenge rules.

## Goals

- Make member challenge progress feel like a visible journey, with milestone nodes and brief motion when confirmed progress changes.
- Make the final reward and current next action obvious without inventing rewards at intermediate milestones.
- Replace the create/edit modal with dedicated Merchant routes and a guided full-page editor.
- Redesign the Merchant list and detail surfaces shown in the supplied screenshot so they work at desktop and mobile widths without horizontal scrolling.
- Hide the visible document scrollbar while keeping normal mouse, trackpad, touch, and keyboard scrolling available.
- Keep all status, progress, reward and budget outcomes grounded in current API responses.

## Non-goals

- No challenge API, database, reward, budget, enrollment, refund or authorization changes.
- No new challenge types, repeat rules, segments, criteria builder, badge economy, streak currency or per-milestone rewards.
- No changes to the bottom navigation or the other Rewards Hub tabs.
- No challenge map that implies missions unlock one another; challenges remain independent campaigns.
- No modal for entering challenge fields. Small confirmation interactions may remain only where a destructive or consequential action needs an explicit check.

## Anti-goals

- Do not show a generic progress bar as the main member progress experience.
- Do not show raw backend enum names to members or merchants.
- Do not run celebration effects on initial page load, on stale cached values, on a refunded order, or when points are still waiting for budget.
- Do not hide content, disable scrolling, or constrain a long form to a fixed-height viewport to remove the scrollbar.
- Do not add illustrative copy, badges or decoration that obscures the next useful action.

## Current state

- `ChallengesPage` renders a two-column card list with repeated title/description/reward/date information and a simple progress bar.
- `ChallengeDetailPage` repeats the same simple progress bar and shows recent activity below the challenge summary.
- `ChallengeHeroCard` repeats progress on the storefront home card.
- `MerchantChallengesPage` uses a table with a 1,050px minimum width, raw challenge type/status values and several text actions packed into each row.
- `ChallengeFormDialog` handles both create and edit in a centered, internally scrollable modal.
- `MerchantChallengeDetailPage` uses raw enums and a horizontally scrollable participant table.
- The existing API already returns the progress, reward, date, budget, participant and grant fields needed for this UI. The existing approved business contract is [here](2026-11-17-v4-challenges-navigation-refund-design.md).

## Approaches

### 1. Mission path with milestone animation — selected

Members see an individual path for each challenge: a clear start, a small set of progress nodes and a final reward node. The detail page gives this path the visual focus; list and home cards show a compact path preview. Nodes represent progress thresholds, not separate prizes. Confirmed state changes animate along the path.

Merchants use a responsive campaign list and detail page. Create and edit open dedicated routes with a short stepper: campaign information, goal and final reward, schedule and budget, then review and save. This gives the member experience a distinct identity while keeping the management flow understandable.

**Trade-off:** This changes several related screens and requires careful progress-transition handling, but it directly addresses the flat member experience and avoids adding unsupported business rules.

### 2. Compact checkpoint cards

Keep the list as standard cards with a small row of linear checkpoints. The detail page uses the same restrained visual style. Merchant create/edit becomes a single long form page with grouped sections.

**Trade-off:** This is quicker and less visually expressive, but may still feel like a conventional loyalty dashboard rather than a mission journey.

### Decision

The user selected approach 1. The user also chose to hide the visible scrollbar while preserving normal scrolling, rejected modal-based challenge data entry, and supplied the Merchant challenge list screenshot as part of the requested scope.

## Member experience

### Home preview

- Retain the existing featured challenge and its shop-scoped links.
- Show its title, final reward, deadline and a compact preview of the milestone path.
- Show one contextual action: check in, continue shopping, or open the challenge, based on existing challenge type and state.
- Keep a clear route to all challenges.

### Challenge list

- Keep status filters for in progress, completed and ended challenges.
- Use a single-column mission feed on narrow screens and a balanced desktop grid where it helps comparison.
- Give each card one primary action and show goal, final reward, deadline and a compact progress path.
- Guests see goal/reward and the existing login CTA; they never see fabricated zero progress.

### Challenge detail and progress path

- Establish hierarchy: challenge name and context, final reward, current next action, milestone path, then recent activity.
- Use a vertical, lightly winding path on mobile. Use a contained path with aligned challenge information on wider screens; do not create a world map or imply dependency between different challenges.
- Use distinct visual states for passed nodes, the current node, future nodes and the final reward node. Each node also has an accessible text label.
- For `ORDER_COUNT` and `DAILY_CHECKIN`, use at most five milestones. For small goals, show no more nodes than the goal can support; for larger goals, distribute display-only checkpoints across the same goal.
- For `SPEND_TOTAL`, use percentage milestones ending at 100%. Do not label intermediate nodes as rewards.
- Display the existing `currentValue`, `targetValue`, `percent`, `remainingValue`, `rewardState`, completion and grant timestamps as the source of truth. Any checkpoint thresholds are visual summaries only.
- Show `WAITING_BUDGET` as goal complete and reward pending. Show `REWARDED` only when the backend reports it.
- Keep recent entries beneath the path and label purchase, check-in and refund entries in Vietnamese.

### Motion and state transitions

- A fresh page load renders the current state without playing a completion celebration.
- After check-in, use the accepted API response and/or refreshed challenge resource before animating to the new state.
- A progress increase may animate the path fill and newly reached node briefly.
- A reward celebration can run once when the current session observes a backend-confirmed transition into `REWARDED`.
- A refund-driven decrease moves the path back gently and never celebrates.
- `WAITING_BUDGET` never implies points have been credited.
- Motion is short and optional; `prefers-reduced-motion` gets an immediate static state. No audio is played by default.

## Merchant experience

### Campaign list

- Replace the wide table with a responsive list: a scannable desktop row/card and stacked mobile cards. Do not use a 1,050px minimum-width table or require horizontal scrolling.
- Keep search, server-side status/type filters and pagination.
- Translate `ORDER_COUNT`, `DAILY_CHECKIN`, `SPEND_TOTAL`, all effective statuses and reward states into clear Vietnamese labels.
- Prioritize title, goal, final points, date range, budget use, completion count and status.
- Keep a single obvious detail action; place less frequent controls (edit, pause/activate, archive, feature, delete) in a compact action menu or detail view.
- Do not add aggregate KPI cards unless the API provides correctly scoped totals; current list pagination only guarantees page items and total item count.
- Preserve empty/loading/error states and server-authoritative mutation results.

### Campaign detail

- Group campaign status, goal, schedule and budget usage into a compact overview.
- Explain active participants, completed members, waiting-budget completions and issued/reversed grants with existing API fields.
- Make member lists and grant history usable without horizontal scrolling; use mobile cards and readable desktop columns.
- Localize all types, statuses and reward states; preserve participant pagination.

### Create and edit

- Add `/merchant/challenges/new` and `/merchant/challenges/:challengeId/edit` routes and replace `ChallengeFormDialog` as the data-entry surface.
- Use a short, responsive stepper: **Thông tin** → **Mục tiêu & điểm thưởng** → **Thời hạn & ngân sách** → **Rà soát**.
- Only expose fields already supported: title, description, type, target, final reward points, total budget, start/end and featured flag.
- Explain the final reward once. Do not add fields for per-node prizes, segments, criteria, repetition or badge rules.
- Keep previous/next navigation and clear validation errors. New challenges save as drafts; activation remains a separate explicit action after saving, matching Antavo's save-then-activate workflow and the existing activate endpoint.
- Maintain current API validations and locked fields after activation/progress.
- Editing an active or progressed challenge clearly shows which fields are locked; editable fields remain available.
- Use normal document scrolling for small viewports. No nested scroll container for the whole editor.

## Scrollbar and responsive behavior

- Hide only the visual document scrollbar through a global style, while preserving native document scrolling and keyboard focus scrolling.
- Remove horizontal overflow from the challenge list/detail by changing their layouts, not by hiding content behind a clipped container.
- Ensure the stepper and path reflow at 320px and above, with comfortably tappable actions.
- Avoid fixed-height content regions that create a second scrollbar.

## Accessibility and visual direction

- Keep the current Plus Jakarta Sans / Fraunces pairing, spruce palette and warm light surface; add a restrained brighter milestone accent for the member journey.
- Use shapes, spacing and text labels as well as color to distinguish progress states.
- Keep focus indicators and keyboard operation on tabs, stepper, action menus and check-in controls.
- Expose milestone position and completion to assistive technology without announcing every animation frame.
- Preserve the existing mobile bottom navigation and shop context.

## Implementation boundaries

- Member UI consumes the existing public/member challenge endpoints. Merchant UI consumes the existing merchant challenge endpoints.
- No backend schema/API change is part of this design.
- Route and component changes are expected in `apps/frontend/src/app/App.tsx`, `apps/frontend/src/features/challenges/`, `apps/frontend/src/features/merchant/challenges/`, and `apps/frontend/src/styles.css`.
- Keep `ChallengeFormDialog` only if another caller still uses it; otherwise remove it after route-based create/edit is wired.
- Unit coverage should cover milestone state mapping, no guest progress, confirmed completion effects, locked edit fields, form validation and responsive action availability. Existing browser/E2E flows remain outside this milestone unless separately requested.

## Acceptance

- A member can see a meaningful mission path and next step on home, list and detail without mistaking checkpoints for separate rewards.
- Check-in, initial load, reward pending, reward granted and refund regression each show the correct backend-confirmed state and motion.
- A merchant can create/edit without an entry modal, manage every existing list action, and review details without horizontal scrolling.
- The mission screens remain usable at mobile and desktop widths; hidden scrollbars do not disable scrolling.
- No API, database or loyalty business policy is added by the UI redesign.
