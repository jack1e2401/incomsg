# Merchant layout and product review fixes

Scope: the marked Orders, Categories and product editor layouts, plus the
product/challenge wizard submission bug in the supplied screenshots and follow-ups.
Keep existing API contracts, authorization, product data, and unrelated workspace edits.

- [x] Separate the Orders title, view switcher, and section headings with explicit layout gaps.
- [x] Give purchase table columns predictable widths and scrolling without an overlapping action column.
- [x] Center the product editor in a wider responsive content area; stack form labels above controls.
- [x] Enable step navigation with required-field validation and preserve entered data when navigating back.
- [x] Show descriptions, stock threshold, status, and images in review; save only after confirmation.
- [x] Fix category toolbar/table spacing, right-aligned responsive drawer sizing and footer actions.
- [x] Separate next/save button identities, prevent the next click's default submit, and guard early submits in both wizards.
- [x] Run the four related frontend test files: 26 tests passed, plus 2 MerchantOrders tests (9 unrelated cases skipped). Frontend typecheck and final build passed.

Acceptance: Orders and product editor remain usable on desktop and mobile; review opens by
clicking its step, invalid basics show an actionable error, and navigation never saves data.
No database or backend changes are needed. Before the user's instruction to stop browser
testing, the in-app browser reproduced the product's premature save on step 2, then
verified that the corrected flow remains on review with descriptions and its image.
No further browser checks are performed as requested; mobile/category/order visual
checks remain unverified. Build reports the existing large JavaScript chunk warning.

The native click/submit interaction reproduced in Chromium is not reproduced by
jsdom's click behavior alone. Unit tests also cover early form submission (Enter),
step validation, review data, and exactly one save after an explicit final action.

Product/category changes build on pre-existing uncommitted catalog files; keep those
changes in the working tree rather than committing another contributor's work.
