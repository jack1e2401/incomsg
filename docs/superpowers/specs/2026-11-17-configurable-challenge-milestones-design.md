# Configurable Challenge Milestones Design

**Date:** 2026-11-17  
**Status:** Approved by user  
**Supersedes:** the no-API-change and generated-checkpoint constraints in `2026-11-17-challenges-experience-redesign.md` for challenge milestones only.

## Intent

Let merchants configure the progress stages members see in a challenge, and make the member challenge detail page feel closer to the supplied WinCommerce reference. The stages describe progress through one campaign; the campaign still awards its single configured point reward only when its final target is reached.

## Current state

- `Challenge` stores one target and one final `rewardPoints` value. No milestone configuration is persisted.
- `buildChallengeMilestones` generates equal count checkpoints or 25/50/75/100% spend checkpoints in the client.
- The merchant editor's fourth step is a review-only screen; the backend input parser does not accept milestone data.
- Public and member challenge DTOs have no milestone list. Member detail already includes current progress and recent challenge activity.
- The member wallet API exposes store-scoped accumulated and available points. No member leaderboard API or ranking data exists.

## Approaches

### 1. Persist display-only milestone configuration — selected

Add an ordered `ChallengeMilestone` child model with threshold, title and description. Keep progress and reward accounting at the campaign level; milestone states are derived from the existing `currentValue`. The merchant can edit a prefilled milestone sequence; member detail renders the saved sequence and adopts the reference's campaign-summary hierarchy.

**Trade-off:** requires a database migration, validation and DTO changes, but keeps reward and refund accounting unchanged while making the desired configuration real and reusable.

### 2. Reward each milestone

Give every milestone its own points reward and issue grants as each threshold is crossed.

**Trade-off:** this changes budget consumption, grant idempotency, refund reversal and member ledger semantics. The user chose display-only milestones, so this is out of scope.

### 3. Model each stage as a separate challenge

Reuse the existing campaign engine by creating one challenge per stage.

**Trade-off:** progress is split across campaigns and no longer reads as one continuous journey. This does not match the requested client experience.

## Goals

- Make merchant editor step 4 a working milestone configuration step with an inline member-path preview; move final review/save to step 5.
- Persist threshold, title and description per ordered milestone through merchant create/update APIs.
- Return configured milestones in merchant, public and member challenge DTOs.
- Render configured titles and descriptions on the member challenge journey, with reached/current/upcoming states based on server-confirmed progress.
- Use the supplied client screenshot for hierarchy: campaign heading, time remaining, overall progress and points summary, followed by the journey and program/activity details.
- Preserve the existing mobile bottom navigation and IncomSG storefront palette. Do not add leaderboard data or UI in this change.
- Keep exactly one final campaign reward. Milestones never issue separate points, vouchers or other rewards.

## Non-goals

- No per-milestone rewards or changes to `ChallengeProgress`, `ChallengeRewardGrant`, loyalty ledger or refund policy.
- No leaderboard endpoint, fake ranking, avatars, or seeded member data.
- No new challenge types, conditions, recurrence rules, enrollment workflow or event triggers.
- No storefront-wide navigation redesign.

## Data and API design

### Milestone model

Add a relational child model with:

- `id`, `challengeId`, `position`, `thresholdValue`, `title`, and `description`.
- A unique constraint on `(challengeId, position)` and a unique constraint on `(challengeId, thresholdValue)`.
- `thresholdValue` as an integer decimal using the same unit as the campaign target: orders, check-in days, or VND.
- `title` required (maximum 80 characters); `description` optional (maximum 240 characters).

Relational rows are preferred to opaque JSON because merchants add, remove and edit ordered records, and backend validation must enforce the campaign's threshold invariants.

### Invariants

- A saved campaign has 1–10 milestones.
- Thresholds are positive integers, strictly ascending, and no greater than `targetValue`.
- The final milestone threshold equals `targetValue`.
- The final point reward remains on `Challenge`; no milestone contains a reward field.
- Once the campaign is activated or has member progress, milestone count/order/thresholds are immutable. Titles and descriptions remain editable because they do not alter progress or accounting.
- Old campaigns without stored milestone rows return deterministic generated defaults. They remain readable without a data backfill; merchants can edit the display copy while preserving locked structure.

### Defaults

- `ORDER_COUNT` and `DAILY_CHECKIN`: generate up to five evenly distributed integer thresholds, capped by the target.
- `SPEND_TOTAL`: generate thresholds at 25%, 50%, 75%, and 100% of the integer target, round upward, remove duplicate values, and always end at the target.
- Default titles are short (`Mốc 1`, `Mốc 2`, …); descriptions are empty. Merchants can replace both before activation.

### API contract

- Merchant create accepts a `milestones` array. If omitted by a legacy caller, the backend generates defaults.
- Merchant patch accepts milestone display configuration. Existing lock rules reject structural changes on activated/progressed campaigns, but permit title/description edits against the same structure.
- Merchant list/detail and public/member list/detail DTOs include milestones ordered by threshold.
- Backend validates the entire milestone list before writing it in the same transaction as its challenge mutation.
- Existing progress, final reward, budget, and refund APIs keep their current semantics.

## Merchant editor

- Steps become **Thông tin** → **Mục tiêu & điểm cuối** → **Thời hạn & ngân sách** → **Các mốc tiến độ** → **Rà soát**.
- Step 4 starts with generated defaults and lets the merchant edit title, description and intermediate thresholds; add/remove intermediate rows; and preview the resulting path.
- Final threshold is shown as the campaign target and cannot be removed or changed independently.
- Validate in the UI for immediate feedback and again in the backend for authority. Errors identify the stage and reason (duplicate, out of order, outside target, missing title, or count limit).
- On locked campaigns, disable structural controls but allow title/description editing; explain the lock beside the preview.
- New campaigns still save as drafts. Activation remains a separate list/detail action.

## Member experience

- Keep the member's shop header and bottom navigation.
- Rebuild challenge detail around a compact campaign hero: title/status/final reward, time remaining, overall progress percentage and progress bar.
- Keep the three challenge status filters compact and on one non-wrapping row on mobile.
- Follow with a configured milestone path. Each node shows its merchant-authored title, optional description, threshold and reached/current/upcoming state. The final node is the one campaign reward, not a separate checkpoint reward.
- Show available store points and accumulated points only for a signed-in member using the existing wallet response; keep the values clearly store-scoped. Do not invent a leaderboard.
- Keep recent challenge activity and put longer campaign terms/goal details in a secondary section below the path.
- Retain the current reduced-motion and backend-confirmed animation rules. Initial load, refunds and `WAITING_BUDGET` do not trigger a completion celebration.
- Use the screenshot's clean campaign-card rhythm, not its WinCommerce branding; retain the current storefront color identity and navigation.

## Backward compatibility and migration

- Add a Prisma migration that creates the child table and indexes; no rows need to be backfilled because the service generates defaults when a campaign has none.
- Existing client requests continue to receive usable milestones from the DTO. Existing API consumers may omit milestone data on create/update.
- The generated Prisma client is updated through the repository's normal migration/generation workflow.

## Acceptance

- A merchant can create a campaign, edit each milestone's threshold/title/description, add or remove intermediate stages, see a preview, and save it as a draft.
- Backend rejects missing/final-mismatch, duplicate, descending, non-integer, over-target or over-limit milestone configurations.
- Activated/progressed challenges reject threshold/order/count edits but allow copy edits.
- Member public and authenticated detail screens display the saved milestone copy and derive stage state from current progress.
- Completing an intermediate stage does not create a point transaction; reaching the campaign target uses the existing one-time reward and budget flow.
- Legacy campaigns without milestone rows still render and can be edited safely.
- Client detail follows the reference hierarchy without adding a leaderboard or changing bottom navigation.
- Unit and integration suites cover validator/domain mapping, CRUD persistence, legacy defaults, member/public DTOs, locked updates and one-time reward behavior; E2E is not required.
