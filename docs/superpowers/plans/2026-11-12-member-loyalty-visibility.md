# Member Loyalty Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add an exact, reversible lifetime-points chart, make Admin report reasons easier to spot, and verify the existing locked-account notice on the requested main-integration checkout.

**Architecture:** Build a small pure ledger-to-timeline mapper and an SVG chart component using the existing WalletDto. Make the Admin reason label visible on compact report cards without changing the API. Keep the existing auth alert behavior and cover it with the existing login test.

**Tech Stack:** React, TypeScript, Vitest, existing uPlot dependency (not required by the selected SVG approach), Orca embedded browser.

**Spec:** docs/superpowers/specs/2026-11-12-member-loyalty-visibility-design.md

## Global Constraints

- Use persisted backend wallet and report responses; do not add fixture data to product flows.
- Use exact decimal strings for point accounting and reconciliation.
- Show only current policy thresholds and label that fact.
- Preserve role authorization and existing API contracts.
- Keep the existing suspended/banned login messages and accessible alert behavior.

## Review Focus

- Ledger returned newest-first: verify timeline sorting by timestamp and ID.
- Fractional points and reversals: verify exact running total without dropping decimals.
- Redemption rows: verify they do not move lifetime tier history.
- Incomplete or inconsistent ledger: verify the chart does not fabricate a line.
- Narrow Admin viewport: verify every report reason has a visible label.

---

### Task 1: Member lifetime history chart

**Files:**
- Create: apps/frontend/src/features/member/lifetime-tier-history.ts
- Create: apps/frontend/src/features/member/MemberLifetimeTierChart.tsx
- Modify: apps/frontend/src/features/member/BackendMemberPages.tsx
- Test: tests/frontend/unit/member-tier-history-chart.test.tsx

**Interfaces:**
- Consumes WalletDto.transactions, netLifetimeEarned, policy tiers, and current tier.
- Produces a timeline mapper returning chronological EARN/EARN_REVERSAL totals as exact decimal strings plus a consistency result.

- [ ] Write tests for EARN and EARN_REVERSAL movement, ignored redemption, descending API order, decimal carry, and a mismatched final total.
- [ ] Run the new test and confirm it fails for the missing mapper/chart behavior.
- [ ] Implement the exact decimal timeline mapper and compact responsive SVG chart; use numeric conversion only for SVG geometry.
- [ ] Render the chart in the backend-connected Member wallet and label thresholds as current policy.
- [ ] Run the targeted unit test and verify it passes.

### Task 2: Admin abuse report reason visibility

**Files:**
- Modify: apps/frontend/src/features/admin/AdminAbuseReportsTable.tsx
- Test: tests/frontend/unit/admin-abuse-reports.test.tsx

**Interfaces:**
- Consumes the existing AdminAbuseReportDto.reason and current list endpoint.
- Produces a visible compact-layout reason label without changing payloads or APIs.

- [ ] Add a test that confirms a report reason is associated with the visible Lý do label.
- [ ] Run the targeted test and confirm it fails because the compact layout lacks that label.
- [ ] Add the visible label to compact rows while keeping the desktop column heading.
- [ ] Run the targeted test and verify it passes.

### Task 3: Locked-account login notice

**Files:**
- Existing behavior and regression test: apps/frontend/src/features/auth/AuthPages.tsx and tests/frontend/unit/admin-moderation.test.tsx

**Interfaces:**
- Consumes the existing backend error codes ACCOUNT_SUSPENDED and ACCOUNT_BANNED.
- Keeps accessible inline role=alert copy; no API change.

- [ ] Run the existing suspended-login test and inspect its assertion; add a narrow banned-status assertion only if no existing test already covers distinct copy.

### Task 4: Verification and review

**Files:**
- Review the planned changes and repository status; do not touch the older D:/.Learn/IncomSG checkout.

- [ ] Run the targeted member, abuse-report, and auth tests.
- [ ] Run npm test at the repository root and the frontend production build.
- [ ] Inspect the diff and ensure no .env, credentials, or unrelated changes are included.
- [ ] Use Orca browser against the actual main-integration frontend and local backend if both are available; confirm wallet chart and Admin reason on desktop and narrow layout.
- [ ] Report the exact test and browser outcomes; do not claim unavailable checks passed.
