# Loyalty Commerce Frontend Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Responsive, API-ready React frontend for Admin, Merchant and Member, with a clearly marked mock demo adapter.

**Architecture:** Route groups share a design system but have role-specific layouts. Features consume an `CommerceApi` interface through one provider; the mock adapter owns demo data and returns authoritative mutation responses, while a future HTTP adapter can replace it. UI never computes confirmed payment, points, tier or fulfillment locally.

**Tech Stack:** React 19, TypeScript, Vite 8, React Router, Tailwind CSS, shadcn/ui-style local components, Radix primitives, Phosphor icons.

**Spec:** User request, supplied BRS v1.0, and `docs/superpowers/specs/2026-11-09-member-rive-design.md` for optional Member motion.

## Global Constraints

- Three roles, multi-merchant, wallets and tiers scoped to each Merchant.
- Member remains Unranked until first PAID order at that Merchant; Bronze multiplier applies to that first purchase.
- Tier depends on lifetime earned points; redemptions never lower tier.
- Vouchers cost points; no reverse conversion or refunds in MVP.
- Merchant activation requires Admin approval.
- Only backend responses can confirm payment, points and reward fulfillment.
- Member mobile-first; Merchant/Admin desktop-first; no Zalo or backend implementation.
- Rive is optional and Member-only with static fallback and reduced-motion handling.

## Screen inventory

- Public: role chooser and demo entry points.
- Admin: overview/monitoring, merchant applications with approve/reject, merchant directory.
- Merchant: overview, store profile, product list/editor, orders, loyalty configuration, voucher definitions, reward fulfillment.
- Member: merchant storefront, product detail/cart, checkout, order result/history, wallet/tier, voucher catalog and owned vouchers, rewards.

## Review Focus

- Merchant switch must never show another merchant's wallet or vouchers.
- PENDING order must never display PAID, earned points or success animation.
- Repeated redemption clicks must not spend points twice.
- Unapproved merchant must not access merchant management routes.
- Failed/empty responses must show recoverable UI, not blank pages.

## Tasks

### Task 1: Routing, dependencies and design system

**Files:** `apps/frontend/package.json`, `vite.config.ts`, `src/styles.css`, `src/app/App.tsx`, `src/components/ui/*`, `src/layouts/*`.

- [ ] Install router, Tailwind, Radix and icon packages; configure Tailwind Vite plugin.
- [ ] Define design tokens and shadcn-style Button, Card, Badge, Input, Select, Skeleton and status components.
- [ ] Build responsive Member and Console layouts with role switcher, navigation and route boundaries.
- [ ] Verify `npm run typecheck` and `npm run build`.

### Task 2: API contracts and mock adapter

**Files:** `src/api/types.ts`, `src/api/mock.ts`, `src/api/client.ts`, `src/api/ApiProvider.tsx`, `src/api/useResource.ts`.

- [ ] Define typed entities and `CommerceApi` methods for all screens.
- [ ] Seed two merchants, a pending application, products, orders, wallets, voucher definitions and rewards.
- [ ] Implement async mock reads/mutations returning server-shaped results and status codes; checkout creates PENDING only.
- [ ] Implement loading/error/retry hook and guard duplicate mutations.
- [ ] Verify domain tests for merchant scoping, Unranked/PENDING behavior and redemption.

### Task 3: Admin screens

**Files:** `src/features/admin/*`.

- [ ] Implement monitoring dashboard and merchant directory.
- [ ] Implement approval queue with details, approve/reject actions and pending/error states.
- [ ] Verify route render and mutation behavior.

### Task 4: Merchant screens

**Files:** `src/features/merchant/*`.

- [ ] Implement overview, store profile and product CRUD controls.
- [ ] Implement order list/detail with PENDING/PAID labels from API.
- [ ] Implement loyalty tier/rate editor, voucher definitions and reward fulfillment queue.
- [ ] Guard routes for unapproved merchants and show explicit pending approval UI.
- [ ] Verify form and route behavior.

### Task 5: Member screens

**Files:** `src/features/member/*`.

- [ ] Implement storefront, product cards, cart and checkout. Checkout result stays PENDING until backend confirms.
- [ ] Implement wallet with per-merchant tier, lifetime and available points, progress and history.
- [ ] Implement voucher/reward redemption and owned items, using response values only.
- [ ] Add optional Member-only Rive adapter slot with static fallback and reduced motion; avoid bundling unverified asset.
- [ ] Verify responsive routes, empty/loading/error/pending states and mock behavior.

### Task 6: Verification and handoff

- [ ] Run full test suite, typecheck and production build.
- [ ] Inspect desktop console and mobile Member layouts in a browser.
- [ ] Update README with demo mode, route inventory, API adapter contract and remaining backend integration points.
