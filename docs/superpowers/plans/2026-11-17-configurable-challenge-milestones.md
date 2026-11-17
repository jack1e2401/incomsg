# Configurable Challenge Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implement task-by-task and keep the commits scoped to each completed milestone.

**Goal:** Let Merchants configure display-only challenge milestones, persist them through the backend, and render the configured mission journey on client screens.

**Architecture:** Add an ordered `ChallengeMilestone` child model and pure milestone default/validation helpers. Merchant APIs own persistence and validation; member progress states continue to derive from the existing campaign-level progress value. The editor's fourth step configures milestones and the fifth step reviews the final draft. Client detail adopts the reference hierarchy without adding leaderboard behavior or changing the existing one-time final reward.

**Tech Stack:** TypeScript, React, Vitest, Node test runner, Express, Prisma 7, MySQL.

**Spec:** `docs/superpowers/specs/2026-11-17-configurable-challenge-milestones-design.md`

## Global Constraints

- Keep one final `rewardPoints` value on `Challenge`; progress milestones never create wallet transactions.
- Each campaign has 1–10 positive integer milestone thresholds, strictly ascending, with the final threshold equal to `targetValue`.
- Once a challenge is activated or has progress, keep milestone count/order/thresholds fixed; allow title/description edits only.
- Keep old challenges readable through deterministic generated defaults; do not backfill existing rows.
- Preserve the member bottom navigation and existing reduced-motion behavior; do not add leaderboard data or fake rankings.
- Preserve unrelated dirty files, especially `AGENTS.md`, `apps/backend/prisma/schema.prisma` formatting changes, `package-lock.json`, and unrelated docs. Stage only feature hunks/files.
- Run unit and local MySQL integration tests plus affected app builds/typechecks. Do not run E2E or browser tests; the user will provide screenshots.

## Review Focus

- When a `milestones` array is supplied, empty, malformed or too many entries must be rejected at the backend boundary; an omitted create array still gets generated defaults for legacy callers. Test both behaviors with `readChallengeInput`.
- Existing challenges with no child rows must still display generated milestone DTOs; test a legacy challenge through public/member reads.
- An intermediate threshold must not issue points; test a member progress update below the campaign target and verify reward state/ledger remain unchanged.
- Activated/progressed challenges must reject structure changes while accepting same-structure copy edits; test both paths at the API boundary.
- Spend threshold rounding must remain unique and end at the exact VND target; test low targets that would otherwise generate duplicate rounded thresholds.

---

### Task 0: Compact member challenge status filters

**Files:**

- Modify: `apps/frontend/src/features/challenges/ChallengesPage.tsx`
- Test: `tests/frontend/unit/v4-challenges-member.test.tsx`

**Interfaces:** Existing `Tab` values and filter behavior remain unchanged.

- [x] Add a test that the three status tabs have compact, non-wrapping mobile styling while preserving `aria-selected` and filtering.
- [x] Run the member challenge unit file and confirm the styling assertion fails against the wrapping buttons.
- [x] Set a single-row, non-shrinking tab layout with compact mobile padding/type; retain a usable horizontal overflow fallback at narrow widths.
- [x] Re-run the member challenge unit file and confirm the filter test passes.
- [x] Commit as `style(member): compact challenge status tabs`.

### Task 1: Add milestone defaults and persistence model

**Files:**

- Create: `apps/backend/src/modules/challenges/challenges.milestones.ts`
- Modify: `apps/backend/prisma/schema.prisma` (stage only the `Challenge.milestones` relation and new child model hunks)
- Create: `apps/backend/prisma/migrations/20261117180000_configurable_challenge_milestones/migration.sql`
- Test: `tests/backend/unit/modules/challenges/challenges.milestones.test.ts`

**Interfaces:**

- Produce `ChallengeMilestoneInput = { thresholdValue: string; title: string; description: string }`.
- Produce `buildDefaultChallengeMilestones(type: ChallengeType, targetValue: string): ChallengeMilestoneInput[]` using integer `bigint` math.

- [x] Add tests for five-or-fewer evenly distributed count milestones, 25/50/75/100% spend defaults, deduplication for low spend targets, and exact final target.
- [x] Run the new backend unit file and confirm it fails because the helper/module does not exist.
- [x] Add the pure default helper and Prisma `ChallengeMilestone` model with `(challengeId, position)` and `(challengeId, thresholdValue)` uniqueness; cascade child cleanup when a progress-free campaign is deleted.
- [x] Add the MySQL migration for the child table and indexes without rewriting existing migration history.
- [x] Run the new backend unit file and `npm run db:generate --workspace apps/backend`; confirm both pass.
- [x] Commit as `feat(challenges): model configurable milestones`.

### Task 2: Validate and persist milestone configuration in challenge APIs

**Files:**

- Modify: `apps/backend/src/modules/challenges/challenges.validation.ts`
- Modify: `apps/backend/src/modules/challenges/challenges.service.ts`
- Modify: `apps/frontend/src/api/challenges-types.ts`
- Test: `tests/backend/unit/modules/challenges/challenges.validation.test.ts`
- Test: `tests/backend/integration/v4-challenges-and-refunds.integration.test.ts`

**Consumes:** `ChallengeMilestoneInput` and `buildDefaultChallengeMilestones` from Task 1.

**Produces:** Merchant/public/member challenge DTOs include `milestones` sorted by threshold. Create/patch inputs accept the optional array; omitted legacy create inputs receive generated defaults.

- [x] Add unit tests for valid arrays and rejection of empty, missing-title, non-integer, duplicate, descending, over-target, non-final-target, and over-10 milestone arrays.
- [x] Add integration tests proving merchant create persists custom milestones and merchant/public/member reads return the same ordered list.
- [x] Add integration tests proving a progress-only intermediate threshold does not create a reward grant, plus locked structure/copy-edit behavior after activation.
- [ ] Run those unit and integration tests and confirm the expected failures before implementation. Unit validation failures were observed; the integration database is unavailable at `localhost:3306`.
- [x] Validate milestone arrays in `readChallengeInput`; write parent and child rows atomically in merchant create/update; reject structural changes when `activatedAt` or progress exists while allowing copy-only edits on unchanged structure.
- [x] Include deterministic defaults for legacy rows with no milestone children in every campaign DTO; keep campaign reward, budget, progress, and refund accounting unchanged.
- [ ] Re-run the targeted backend unit and MySQL integration tests and confirm they pass. Backend unit suite passed; integration verification is blocked because no local MySQL server is listening on port 3306.
- [x] Commit as `feat(challenges): persist display milestones`.

### Task 3: Make Merchant editor step 4 configure milestones

**Files:**

- Create: `apps/frontend/src/features/merchant/challenges/ChallengeMilestoneEditor.tsx`
- Create: `apps/frontend/src/features/challenges/challenge-milestone-defaults.ts`
- Modify: `apps/frontend/src/features/merchant/challenges/MerchantChallengeEditorPage.tsx`
- Modify: `tests/frontend/unit/v4-challenges-merchant.test.tsx`

**Consumes:** API milestone types and locked-state behavior from Task 2.

- [x] Add tests for editing threshold/title/description, adding/removing intermediate milestones, final-threshold lock, validation messages, locked challenge structure, and save payloads.
- [x] Add default-input tests matching the backend's count/spend fixtures; keep this helper limited to the editor's initial form state, with backend validation as authority.
- [x] Run the merchant unit file and confirm the new step-4 assertions fail against the four-step review-only editor.
- [x] Move review to step 5 and implement step 4 with default stages, add/remove controls, inline preview, and UI validation matching backend invariants.
- [x] When type changes, reset to type-appropriate defaults with a notice; when the target changes, keep valid intermediate thresholds, update the final threshold, and explain any dropped out-of-range stage.
- [x] Initialize edit state from API milestones; disable structure controls for locked campaigns but allow copy edits; include milestones in create/update requests.
- [x] Re-run merchant tests and confirm create/edit and locked-field tests pass without opening a modal.
- [ ] Commit as `feat(merchant): configure challenge milestones`.

### Task 4: Render configured milestones in the client mission experience

**Files:**

- Modify: `apps/frontend/src/features/challenges/challenge-milestones.ts`
- Modify: `apps/frontend/src/features/challenges/ChallengeMilestonePath.tsx`
- Modify: `apps/frontend/src/features/challenges/ChallengeDetailPage.tsx`
- Modify: `apps/frontend/src/features/challenges/ChallengeHeroCard.tsx`
- Modify: `apps/frontend/src/features/challenges/ChallengesPage.tsx`
- Modify: `tests/frontend/unit/v4-challenge-milestones.test.ts`
- Modify: `tests/frontend/unit/v4-challenges-member.test.tsx`

**Consumes:** ordered configured milestone DTOs from Task 2.

- [ ] Add tests that custom thresholds drive reached/current/upcoming path state and render merchant titles/descriptions; retain the no-progress guest behavior and generated fallback behavior.
- [ ] Add member detail assertions for campaign summary, remaining-time text, available/accumulated store points, recent activity, and absence of leaderboard UI.
- [ ] Run milestone/member unit files and confirm the new assertions fail against generated-only path labels and the current detail layout.
- [ ] Map path states from configured thresholds against server-confirmed `currentValue` and final `rewardState`; keep animations transition-based and reduced-motion safe.
- [ ] Redesign member challenge detail using the supplied campaign-summary hierarchy, configured milestone path, existing store-wallet response and recent challenge activity; keep the store palette and bottom navigation.
- [ ] Re-run member milestone/navigation tests and confirm list, home preview, detail, and status filters remain functional.
- [ ] Commit as `feat(member): render configured challenge journey`.

### Task 5: Verify the complete milestone flow

**Files:**

- Verify: backend/frontend work from Tasks 0–4.

- [ ] Run backend unit tests and frontend unit tests; confirm no existing unit suite regresses.
- [ ] Run `npm run test:db` only against the configured local test MySQL database; confirm the milestone migration and integration cases pass. If the local DB is unavailable, report that blocker and retain unit/typecheck evidence without claiming integration passed.
- [ ] Run `npm run build --workspace apps/backend` and `npm run build --workspace apps/frontend`.
- [ ] Run `git diff --check`, inspect the staged diff, and ensure no E2E changes or unrelated dirty files enter commits.
- [ ] Record final verification and update all task checkboxes in this plan.

## Acceptance

- Merchants can edit an ordered set of display milestones in editor step 4 and preview the client path before the review/save step.
- Custom milestones persist and round-trip to merchant, public and authenticated member reads.
- Legacy campaigns remain readable with generated defaults; activated/progressed campaigns cannot change threshold structure.
- Member client screens render configured copy and progress states; only final campaign completion awards the existing points.
- The three mobile status filters fit a compact single row without wrapping their labels.
- No leaderboard, per-milestone reward or bottom-navigation change is introduced.
