# Member Tier History, Admin Report Reasons, and Locked Login Notice

## Intent

Make lifetime point movement and tier thresholds understandable to Members, make merchant report reasons unmistakable to Admins, and retain a clear immediate login notice for accounts that are suspended or banned.

## Findings from the current implementation

- The Orca tab that prompted the missing reason question belongs to D:/.Learn/IncomSG on feat/loyalty-exact-points. That checkout has no Admin abuse report route. The requested target, C:/Users/ACER/orca/workspaces/IncomSG/main-integration, is a separate clean checkout on main and contains the report page and reason field.
- In main-integration, GET /api/member/merchants/:merchantId/wallet returns the full ledger newest-first, exact netLifetimeEarned, and current tier thresholds.
- The backend's net lifetime is changed by EARN and EARN_REVERSAL. Redeems change spendable balance but do not change lifetime.
- The Member wallet currently displays total lifetime points and tier but has no point history chart.
- The main-integration Admin table renders report.reason in its final column. On narrow layouts it has no per-row label, which makes the field easy to overlook.
- Login already maps ACCOUNT_SUSPENDED and ACCOUNT_BANNED to distinct messages rendered as an accessible role=alert after a failed login attempt.

## Approaches

1. Keep a next-tier progress bar. It is small, but cannot show reversal history or the requested rise-and-fall timeline.
2. Use uPlot for a full event chart. The dependency already exists, but the chart needs custom tier threshold bands and exact ledger labels.
3. Use a responsive SVG timeline driven by ledger events. This needs no new package, supports threshold bands and event markers, and leaves exact decimal values in source data and accessible labels. This is the selected approach, matching the user's requested AtCoder-style up/down history.

## Decisions

- X is chronological earning/reversal events; Y is exact net lifetime points.
- Only EARN and EARN_REVERSAL affect the plotted lifetime line. Redemption events are excluded.
- Sort by createdAt then transaction ID because the API returns rows newest-first.
- Check the reconstructed final lifetime total against wallet.netLifetimeEarned. If it does not match, hide the chart and show a data-unavailable message rather than inventing a history.
- Render tier threshold bands from the current backend policy and label them as current thresholds; the wallet API does not include historical policy snapshots for every ledger event.
- Use SVG numeric coordinates only for drawing. Exact point deltas and totals remain decimal strings for comparisons, displayed values, and accessible event details.
- Show a visible Lý do báo cáo label on compact Admin report cards; keep the existing API and backend contract.
- Keep the existing inline login alert and its distinct suspended/banned messages. No new modal or backend behavior is needed.

## Goals

- Show an AtCoder-inspired lifetime history line that rises on earning and falls on reversal.
- Make tier thresholds legible against the same points axis.
- Make report reasons identifiable on desktop and compact screens.
- Preserve the current immediate, accessible login notice for suspended and banned accounts.

## Non-goals

- No backend schema or API changes.
- No change to earning, redemption, refund, tier, or account moderation rules.
- No historical tier reconstruction across old policy versions; the chart explicitly uses current thresholds.
- No new mock data, accounts, or dependencies.

## Acceptance

- A fixture with EARN +0.6, EARN +0.6, REDEEM -1, EARN_REVERSAL -0.6 yields lifetime points 0, 0.6, 1.2, 0.6 and ignores the redemption.
- A mismatched ledger history does not produce a misleading chart.
- Admin reason is visibly labeled in narrow layout and continues to render from the real report DTO.
- Suspended login shows the existing suspended message in role=alert; banned login remains distinct.
- Unit tests, frontend build, and the repository's required checks are run and reported honestly.
