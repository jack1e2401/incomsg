# IncomSG — Agent Instructions

This file applies to the entire monorepo. Read it before planning, editing, testing, or committing. More specific instructions in a nested [`AGENTS.md`](http://AGENTS.md), if present, apply only to that subtree and must not contradict repository-wide safety and business-integrity rules.

## 1. Repository and environment

- **The Git root and npm workspace root are this directory.** Run `npm ci` here; do not install workspace dependencies independently unless the existing scripts require it.
- Frontend source: `apps/frontend`.
- Backend source and Prisma migrations: `apps/backend`.
- Each application loads its own `.env`. Follow the existing environment validation and `.env.example` conventions, if available. Never commit `.env`, credentials, secrets, or payment keys.
- Frontend Vitest tests: `tests/frontend/unit`.
- Frontend browser/E2E test source: `tests/frontend/e2e`.
- Backend Node unit tests: `tests/backend/unit`.
- Backend MySQL integration tests: `tests/backend/integration`.
- Plans, specifications, and implementation notes: `docs/superpowers`.
- App documentation: `docs/frontend` or `docs/backend`.
- Existing package scripts, tool configurations, and actual API contracts are authoritative; inspect them before adding new scripts or changing paths.

## 2. Operating mode: work in the actual repository

- Make changes **directly to the checked-out repository/worktree**, not an isolated demonstration project, throwaway scaffold, or copied prototype.
- Begin every task with `git status --short`, current branch, the relevant source files, and a quick inspection of existing tests and API contracts.
- Preserve unrelated and pre-existing local changes. Do not reset, clean, overwrite, or include another contributor's changes in a commit.
- Scope the work to the requested feature. Avoid unrelated rewrites, broad formatting sweeps, and speculative abstractions.
- Reuse working code. Refactor only where it improves the requested behavior, testability, correctness, or maintainability.
- When several agents work concurrently, assign explicit file/module ownership. Coordinate schema and API contract changes first. Do not edit the same file from multiple worktrees without synchronization.
- Do not change production/hosted infrastructure, run destructive database operations, push, merge, or open a PR unless explicitly requested.

## 3. Implementation quality: SOLID and small modules

- Apply SOLID pragmatically: one clear responsibility per component/service, explicit dependencies, narrow interfaces, and business rules independent of HTTP and UI details.
- Follow the repository's existing architecture and naming conventions. Prefer small, cohesive domain functions and modules over a large generic service, controller, or React page.
- Target **150–250 lines or fewer for a hand-written production file**, where practical. Treat **300+ lines as a refactor signal**, not an excuse to split one cohesive function arbitrarily. Generated code, migrations, and legitimately large test fixtures are exceptions.
- If a React screen grows, extract focused components, hooks, and API/data mapping helpers. If a backend module grows, separate validation, domain calculation, orchestration, persistence, and HTTP transport at sensible boundaries.
- Keep helpers near the feature that owns them; do not create generic shared abstractions for one use case.
- Use strict TypeScript types and validate untrusted inputs on the backend. Avoid `any`, silent catches, hidden mutations, and duplicated business formulas.
- Keep changes backwards-compatible where possible. For breaking database/API changes, document migration and coordinate frontend/backend updates in the same milestone.
- Add meaningful tests for behavioral changes and regressions; do not replace passing tests with weaker assertions.

## 4. Loyalty and commerce business integrity

These safeguards apply whenever touching orders, payments, points, tier, vouchers, redemptions, refunds, or fulfillment:

- The **backend and persisted database are authoritative** for all financial and loyalty outcomes. Never compute or display an unconfirmed transaction as completed in the frontend.
- Use exact `Decimal`/fixed-point arithmetic as appropriate for VND and fractional loyalty points; never rely on binary floating-point for authoritative monetary or points accounting.
- Maintain merchant isolation: wallets, policies, vouchers, orders, and ledger entries must belong to the correct merchant/member.
- Treat payment confirmation, point earning, redemption, reversals, and voucher state transitions as **atomic and idempotent**. Use database transactions, conditional updates, and unique event/request references when necessary.
- Record auditable ledger entries for balance-changing events. Do not silently rewrite history to reconcile balances.
- Model pending, successful, failed, cancelled, refunded, and fulfillment outcomes explicitly where the feature requires them. Do not infer payment success from a redirect or optimistic UI event.
- Refunds and reversals must account for points already spent and any fractional remainder; do not silently discard value or allow double reversal.
- Do not invent business policies. If a rule has not been approved, identify it as a proposal in the implementation plan and avoid silently baking it into the code.
- Preserve authorization and role boundaries. Merchant actions cannot affect another merchant; member operations cannot access another member's records.

## 5. Frontend UI conventions

- Keep product screens visually quiet. Do not add decorative eyebrow labels, milestone badges, redundant captions, or implementation explanations to user-facing layouts.
- Keep only copy needed to identify an action, explain a business decision, or communicate loading, empty, error, pending, and success states.
- Prefer relevant `.riv` or image assets for visual storytelling over extra descriptive blocks. Reuse configured assets; never invent remote asset URLs.
- Rive and other motion must be optional, have a graceful static fallback, and respect `prefers-reduced-motion`.
- Keep Rive animation inside **Member** experiences. Public, Admin, and Merchant screens use static artwork.
- Keep authentication forms focused on the form, validation feedback, and the next useful action.
- Do not add mock adapters, seeded browser accounts, or sample commerce data to product flows. Connect only endpoints that exist in the backend; hide or clearly disable actions when an endpoint is unavailable.
- Render order, payment, points, tier, voucher, refund, and fulfillment outcomes from backend responses. Never infer or invent a confirmed transaction state.
- Keep accessibility, keyboard navigation, responsiveness, and actionable errors intact.

## 6. Verification: prefer the Orca browser over Playwright

**Primary browser-testing approach:** use Orca's available browser automation/control capability to open and interact with the **actual running frontend connected to the local backend and migrated MySQL database**. Inspect the app as a real user would. Do not substitute mocked network responses for a successful integration test.

For each user-visible feature, when browser capability is available:

1. Start the relevant apps using **existing** repository scripts; verify the environment and API connectivity.
2. Use the Orca browser to navigate real routes and authenticate through supported application flows.
3. Exercise happy path and at least one relevant validation/error/permission path.
4. Verify the visible state **and**, where appropriate, persisted/backend state after refresh. For payment/loyalty flows verify the ledger and wallet, not only a success toast.
5. Check browser console/network failures where the tool supports them. Capture clear reproduction steps and screenshots only when useful.
6. Report the exact flows that were actually executed and their outcomes.

Do **not** invent an Orca CLI command, API, tool name, or successful browser session. Discover and use only browser capabilities that are genuinely available in the agent runtime. If Orca browser control is unavailable, say so clearly, perform API/integration/unit checks, and use `npm run test:e2e` (Playwright) only as a fallback when it is available and needed; explain the fallback. **Do not make Playwright the default verification method.**

Automated checks still matter:

- `npm test` from the repository root: both unit suites.
- `npm run test:db`: backend integration tests **only with a migrated local test MySQL database**.
- `npm run test:e2e`: existing default browser suite, secondary/fallback to Orca browser testing.
- Run available typecheck, lint, build, and targeted tests from existing scripts before committing affected code.
- Never run integration tests against production data; never claim a test passed unless its command or browser flow actually ran.
- When a required check cannot run, report the blocker and the remaining risk, rather than marking it passed.

## 7. Implementation and commit cadence

Use a **small, vertical, testable milestone loop**:

1. **Inspect:** understand the user request, current code, business rules, dependencies, and working-tree status.
2. **Plan:** list concrete outcomes, affected files, migration/API changes, and acceptance checks. Store non-trivial plans in `docs/superpowers`.
3. **Implement:** make the smallest cohesive change, keeping backend contracts and frontend consumption aligned.
4. **Verify:** run relevant automated checks and, for UI flows, test in the Orca browser when available.
5. **Review:** inspect `git diff`, remove debug code, and check for unrelated files/secrets.
6. **Commit:** create **one scoped commit per completed, coherent milestone**. Use selective staging (`git add <paths>`), not indiscriminate staging.
7. **Report:** summarize what changed, which tests really ran, the commit hash, remaining risks, and next milestone.

Suggested commit messages:

- `feat(loyalty): preserve fractional point carry`
- `feat(orders): support safe cancellation and voucher release`
- `feat(refunds): record idempotent earning reversals`
- `feat(frontend): show wallet carry and point debt`
- `test(loyalty): cover refunds and concurrent redemption`
- `refactor(merchant): split loyalty transaction components`

Rules:

- Commit incrementally **after** a coherent milestone is verified; do not create one enormous end-of-task commit.
- Avoid committing unfinished broken states as if they were complete. If blocked, preserve work without fabricating validation.
- Do not amend, rebase, squash, or reset other people's commits without explicit approval.
- Do not push or merge unless requested.
- When schema and API contracts need to change, agree on the shape before agents implement independently. If separate commits cannot remain functional alone, coordinate a single integration commit for that vertical slice.

## 8. End-of-milestone report

Give a short report in Vietnamese covering:

- **Implemented:** behavior and files/modules changed.
- **Validation:** commands and Orca browser flows actually run; pass/fail/blocker.
- **Commit:** commit hash and message (or reason no commit was made).
- **Risks:** known limitations, missing endpoints, migration steps, or unverified cases.
- **Next:** smallest safe next milestone.

Be direct and evidence-based. Prioritize working business behavior over decorative UI, unrequested features, or theoretical architecture.
