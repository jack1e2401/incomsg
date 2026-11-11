# IncomSG agent instructions

- The Git root and npm workspace root are this directory. Run `npm ci` here.
- Frontend source is in `apps/frontend` and backend source and Prisma migrations are in `apps/backend`. Each app loads its own `.env`.
- Put Vitest and Playwright tests in `tests/frontend/unit` and `tests/frontend/e2e`. Put Node unit and MySQL integration tests in `tests/backend/unit` and `tests/backend/integration`.
- Run `npm test` from the root for both unit suites. Use `npm run test:db` with a migrated local MySQL database and `npm run test:e2e` for the default browser suite. See the [setup and test commands](README.md).
- Keep plans and specs under `docs/superpowers` and app documentation under `docs/frontend` or `docs/backend`.

## Frontend UI conventions

- Keep product screens visually quiet. Do not add decorative eyebrow labels, milestone badges, redundant captions, or implementation explanations to user-facing layouts.
- Keep only copy needed to identify an action, explain a business decision, or communicate loading, empty, error, pending, and success states.
- Prefer relevant `.riv` or image assets for visual storytelling over extra blocks of descriptive text. Reuse configured assets when available; do not invent remote asset URLs.
- Rive and other motion assets must remain optional, have a graceful static fallback, and respect `prefers-reduced-motion`.
- Keep Rive animation inside Member experiences; public, Admin, and Merchant screens use static artwork.
- Keep authentication forms focused on the form, validation feedback, and the next useful action.
- Do not add mock adapters, seeded browser accounts, or sample commerce data to product flows. Connect only endpoints that exist in the backend; hide or clearly disable actions when the matching endpoint is unavailable.
- Render order, payment, points, tier, voucher, and fulfillment outcomes from backend responses. Never infer or invent a confirmed transaction state.
