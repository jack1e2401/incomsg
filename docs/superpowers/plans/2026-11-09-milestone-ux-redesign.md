# Milestone UX redesign implementation plan

**Spec:** [Milestone UX flows and screen design](../specs/2026-11-09-milestone-ux-flows-design.md)

**Execution:** Inline on `main`, as requested. Preserve unrelated working-tree edits.

## Goal

Implement the approved M2–M6 journeys and visual direction in the existing React app, using real imagery instead of decorative badges or filler copy. Keep API ownership/status rules and the existing separate HTTP/demo modes intact. M1 receives no user-facing UI.

## Global constraints

- Do not change backend contracts or invent API-backed outcomes.
- Keep changes scoped to public/auth, Admin, Merchant, Member UI, local image assets/credits, and Playwright UI coverage.
- Do not modify existing user edits in `tests/frontend/e2e/commerce-http.spec.ts` or `tests/frontend/e2e/vnpay.spec.ts`.
- Use local optimized images from the Pexels URLs recorded in `public/images/credits.md`; do not hotlink production UI images.
- Keep missing product imagery visually neutral; never display unrelated stock photography as if it were that product.
- Keep `.riv` optional and Member-only; use existing static fallback and reduced-motion handling.
- Status remains concise text. Remove decorative demo/mode badges and repeated implementation copy from customer-facing layouts.

## Tasks

### Task 1 — Visual acceptance checks and imagery

- Add Playwright UI coverage for the public landing's real local image, desktop/mobile overflow, and absence of milestone/demo implementation labels.
- Run the new checks first and observe the expected failure.
- Add compressed, local Pexels photography and record source/license in `public/images/credits.md`.
- Keep production product cards tied to API `imageUrl`; stock photos are used only as editorial/ambient imagery.

**Expected:** the new browser checks fail before the new landing asset/layout exists and pass after it is added.

### Task 2 — Public, authentication, and M2 screens

- Redesign landing and AuthFrame with the approved editorial photo composition and concise copy.
- Keep register role selection, application status, and Admin approval outcomes API-backed and accessible.
- Restyle Admin application review with clear information hierarchy and a focused decision surface; do not invent fields missing from application DTOs.

**Expected:** login, registration, application status, and approval Playwright flows retain current navigation and assertions while the new visual acceptance checks pass.

### Task 3 — M3 marketplace, catalog, and order screens

- Restyle both HTTP and demo Member discovery/storefront/product/cart/checkout/order-result pages with shared visual primitives.
- Keep M3 checkout to one product line and one Merchant; never combine merchant carts into one order.
- Restyle Merchant product and order workspaces with desktop-first operational hierarchy.

**Expected:** existing commerce Playwright flows pass; image loading and 390px/desktop layout checks pass.

### Task 4 — M4 loyalty and tier screens

- Restyle Merchant loyalty configuration and Member wallet/tier/history in both modes.
- Clearly distinguish Unranked, available points, and lifetime points; show progress only from API/model configuration.
- Preserve first-paid-purchase Bronze calculation and lifetime tier behavior without client-side transaction success guesses.

**Expected:** M4/commerce checks verify merchant-scoped wallet state and correct status presentation.

### Task 5 — M5 voucher and fulfillment screens

- Restyle voucher template management, Member voucher catalog/wallet, discount selection, and Merchant reward fulfillment.
- Use type and state as plain contextual text, not ornamental pills.
- Keep redeem/fulfill success dependent on backend responses; keep pending/reserved/insufficient states explicit and short.

**Expected:** existing redeem, discount, and fulfillment Playwright flows pass without premature success UI.

### Task 6 — M6 payment screens

- Restyle checkout-to-payment handoff and order result states for pending, paid, failed, and polling timeout.
- Keep VNPay return separate from signed-IPN confirmation; only status API `PAID` renders success.
- Keep local mock payment behavior isolated to explicit demo configuration.

**Expected:** VNPay Playwright status transition and timeout checks pass with no false success state.

### Task 7 — Final verification and commit

- Run targeted demo, HTTP-commerce, and VNPay Playwright CLI suites, typecheck, build, and `git diff --check`.
- Inspect desktop and mobile screenshots of landing, Member wallet/vouchers, Merchant, and Admin.
- Run a fresh whole-change review and address Critical/Important findings.
- Commit only this plan's UI, assets, tests, and docs; leave unrelated user changes unstaged.

**Expected:** clean targeted checks, review findings resolved or recorded, and commits limited to the UX redesign.

## Review focus

1. No demo/mock/payment status copy is left as a decorative banner in customer-facing views, while real pending/failed/success states remain clear.
2. No sample product photo is presented as a real Merchant product.
3. Member context changes do not show wallet/order data from another Merchant.
4. Payment success requires backend status `PAID`; Rive never triggers success independently.
5. Responsive pages have no horizontal overflow and remain usable with reduced motion or missing imagery.

## Acceptance

- One cohesive visual language spans all milestones while Member remains mobile-first and consoles desktop-first.
- Photography or optional Rive art carries visual weight instead of badges or filler text.
- Each API-backed flow stays modular and response-driven.
- Playwright CLI evidence, build/typecheck output, and commit hashes are reported at completion.
