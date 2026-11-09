# Frontend UI conventions

- Keep product screens visually quiet. Do not add decorative eyebrow labels, milestone badges, redundant captions, or implementation explanations to user-facing layouts.
- Keep only copy needed to identify an action, explain a business decision, or communicate loading, empty, error, pending, and success states.
- Prefer relevant `.riv` or image assets for visual storytelling over extra blocks of descriptive text. Reuse configured assets when available; do not invent remote asset URLs.
- Rive and other motion assets must remain optional, have a graceful static fallback, and respect `prefers-reduced-motion`.
- Keep Rive animation inside Member experiences; public, Admin, and Merchant screens use static artwork.
- Keep authentication forms focused on the form, validation feedback, and the next useful action.
- Do not add mock adapters, seeded browser accounts, or sample commerce data to product flows. Connect only endpoints that exist in the backend; hide or clearly disable actions when the matching endpoint is unavailable.
- Render order, payment, points, tier, voucher, and fulfillment outcomes from backend responses. Never infer or invent a confirmed transaction state.
