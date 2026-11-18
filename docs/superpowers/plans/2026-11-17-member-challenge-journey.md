# Member Challenge Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn member challenge progress into an animated, accessible milestone path driven by confirmed challenge API state.

**Architecture:** A pure feature helper maps the existing challenge DTOs to visual milestones. A focused path component renders those milestones; the home card, list, and detail page reuse it. Existing challenge endpoints remain authoritative, and no intermediate milestone grants points.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, Vitest, Testing Library.

**Spec:** [Challenges experience redesign](../specs/2026-11-17-challenges-experience-redesign.md)

## Global Constraints

- Do not change the challenge API, database schema, enrollment, reward, budget, or refund rules.
- Guests see goal and final reward, never member progress.
- Member progress, completion and reward states come from the existing API responses.
- Milestone nodes are visual thresholds only; the final challenge goal remains the only reward threshold.
- Motion must respect `prefers-reduced-motion`; initial page load and refund regression never celebrate.
- Preserve shop-scoped routes and the existing bottom navigation.
- Hide the visible document scrollbar while keeping normal scrolling available.

## Review Focus

- Count targets 1–5 must render no more nodes than the target supports; test with goals 1 and 3.
- Large count targets must render five unique, ordered thresholds; test target 8 as 2, 4, 5, 7, 8.
- Spend goals must use 25/50/75/100% milestones without labeling intermediate nodes as rewards; test at 50%.
- Guest views must not leak `currentValue`, percent, or progress nodes; test public hero, list, and detail.
- Only an in-session, backend-confirmed transition to `REWARDED` can celebrate; test initial load, check-in refresh, and non-reward completion states.

## Tasks

### Task 1: Map API progress to milestone view data

**Files:**

- Create: `apps/frontend/src/features/challenges/challenge-milestones.ts`
- Test: `tests/frontend/unit/v4-challenge-milestones.test.ts`

**Interface:**

- `buildChallengeMilestones(challenge: PublicChallengeDto, progress: ChallengeProgressDto): ChallengeMilestone[]`
- `ChallengeMilestone`: `{ key: string; label: string; threshold: string; percent: number; state: "reached" | "current" | "upcoming" | "reward-pending" | "rewarded" }`

- [x] Write failing tests for one-node target 1, one-per-unit target 3, compressed target 8, spend thresholds, and `WAITING_BUDGET`/`REWARDED` final states.
- [x] Run `npm test --workspace apps/frontend -- tests/frontend/unit/v4-challenge-milestones.test.ts` and confirm failures name the missing mapper.
- [x] Implement the mapper with integer string/`BigInt` comparisons for count targets; use API `percent` for spend milestones.
- [x] Re-run the focused unit file and confirm every milestone mapping assertion passes.
- [x] Commit as `feat(challenges): map challenge progress to milestones`.

### Task 2: Render the member journey path

**Files:**

- Create: `apps/frontend/src/features/challenges/ChallengeMilestonePath.tsx`
- Modify: `apps/frontend/src/features/challenges/challenge-ui.tsx`
- Test: `tests/frontend/unit/v4-challenges-member.test.tsx`

**Consumes:** `buildChallengeMilestones` from Task 1.

**Produces:** `ChallengeMilestonePath({ challenge, progress, animateReached? })` renders an ordered, labeled path with reached/current/upcoming/final states.

- [x] Add member UI assertions for milestone labels, current node, final reward state, and the absence of a generic progress bar as the primary representation.
- [x] Run the focused member unit file and confirm the new path assertions fail against the old progress bar.
- [x] Implement a vertical, lightly winding mobile path with restrained desktop layout and visible labels; keep the component under 200 production lines.
- [x] Use CSS transitions for node/path changes and a static fallback for reduced motion.
- [x] Re-run the member unit file and confirm guest and member render assertions pass.
- [x] Commit as `feat(member): render challenge milestone paths`.

### Task 3: Integrate the path and confirmed state transitions

**Files:**

- Modify: `apps/frontend/src/features/challenges/ChallengeHeroCard.tsx`
- Modify: `apps/frontend/src/features/challenges/ChallengesPage.tsx`
- Modify: `apps/frontend/src/features/challenges/ChallengeDetailPage.tsx`
- Create: `apps/frontend/src/features/challenges/useChallengeProgressAnimation.ts`
- Test: `tests/frontend/unit/v4-challenges-member.test.tsx`

**Consumes:** `ChallengeMilestonePath` from Task 2.

**Produces:** `useChallengeProgressAnimation(challengeId: number, progress: ChallengeProgressDto | null | undefined): boolean` returns `true` briefly after an in-session, backend-confirmed progress increase or transition into `REWARDED`.

- [x] Add tests that guest home/list/detail render no progress; a member sees progress on all three surfaces; check-in refresh keeps the old path mounted until refreshed data arrives.
- [x] Add tests that a newly loaded `REWARDED` state does not celebrate and that a confirmed in-session transition to `REWARDED` does.
- [x] Run the member unit file and confirm the new state-transition assertions fail before implementation.
- [x] Replace the old progress-bar use in the home preview, list card and detail page with a compact or full path as specified.
- [x] Preserve challenge CTA, date, tabs, `WAITING_BUDGET`, shop slug, and recent activity behavior.
- [x] Keep previous data visible during refetch in detail so the new server response can animate from the real prior state.
- [x] Run the member unit file and confirm the path and confirmed-transition assertions pass.
- [x] Commit as `feat(member): connect challenge paths to confirmed progress`.

### Task 4: Hide the visual document scrollbar

**Files:**

- Modify: `apps/frontend/src/styles.css`

- [x] Add cross-browser scrollbar-hiding styles to the document root/body without changing overflow or scroll behavior.
- [x] Confirm with `git diff --check` and frontend build; do not add an inner fixed-height scroll region to compensate.
- [x] Commit as `style(frontend): hide document scrollbar while preserving scroll`.

### Task 5: Verify the member milestone

- [x] Run focused challenge and navigation unit suites; confirm all 29 tests pass.
- [x] Run `npm run build --workspace apps/frontend` (`tsc -b` and Vite pass; Vite reports the existing large-chunk advisory).
- [x] Review `git diff --check` and confirm no challenge API/schema or E2E changes were made for this UI work.

## Acceptance

- A member can understand current progress and next step from home, list, and detail.
- Intermediate milestones never imply separate points or rewards.
- Guest/member visibility, initial load, successful check-in, reward pending, reward granted, and reduced-motion behavior remain correct.
- Normal page scrolling remains available with the visual document scrollbar hidden.
