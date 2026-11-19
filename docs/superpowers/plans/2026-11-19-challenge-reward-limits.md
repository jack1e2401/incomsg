# Challenge Reward Limits Implementation Plan

**Goal:** Limit the number of distinct recipients in a challenge, give the earliest eligible completions priority, and announce each live limit increase to all members in the app.

**Architecture:** A nullable limit keeps existing campaigns unlimited. The challenge row serializes changes to slots, budget and payout order. A persisted notice doubles as the history of a live increase and supplies a member feed that is independent of store membership.

**Contract:** `maxRewardRecipients` is a positive integer or `null`. A draft can set either. A live finite limit can only increase while the challenge is in its participation window. An initially unlimited live challenge stays unlimited. Rejected completions retain `completedAt` and `LIMIT_REACHED`. A limit increase reconsiders them in `completedAt, id` order. Budget and slots are distinct. A queued eligible completion holds a slot; a refund before any award releases it if eligibility is lost. A membership ever awarded retains its slot across reward cycles.

- [x] Add API validation and integration coverage for one slot, overflow, two consecutive increases, wait order, budget waiting, unlimited campaigns, authorization and the global member feed.
- [x] Add the Prisma migration and share reward allocation across payment, check-in, replay on an increase and refund release. Preserve the existing exact points ledger and reward-cycle uniqueness.
- [x] Add the Merchant editor fields, capacity and history on challenge detail, client-facing quota and progress labels, and the member broadcast component.
- [ ] Run unit suites, type checking, build, and the migrated local DB suite. Check Orca and use the existing browser fallback if needed. Review the diff and stage the scoped milestone.
