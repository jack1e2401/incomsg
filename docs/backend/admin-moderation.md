# Admin moderation HTTP contract

All routes below require an active Admin bearer token. Errors retain `{error:CODE}`.
Lists return `{items,nextCursor}`; `nextCursor` is a string or null. Pass it as
`cursor` to fetch the next page; `limit` defaults to 25 and is capped at 100.

| Method/path | Input | Response |
| --- | --- | --- |
| GET `/api/admin/users` | `search`, `status`, `role`, `cursor`, `limit` | Account items: `id,email,role,accountStatus,isActive,createdAt` |
| PATCH `/api/admin/users/:userId/status` | `{status:"ACTIVE"\|"SUSPENDED"\|"BANNED",reason}` | `{user}` |
| GET `/api/admin/email-blacklist` | `search`, `active=true/false`, `cursor`, `limit` | Blacklist items |
| POST `/api/admin/email-blacklist` | `{email,reason}` | 201 `{entry}` |
| POST `/api/admin/email-blacklist/:id/deactivate` | `{reason}` | `{entry}` |
| GET `/api/admin/audit-logs` | `actorId,action,targetType,targetId,from,to,cursor,limit` | Audit items |
| PATCH `/api/admin/merchants/:merchantId/status` | `{isActive:boolean,reason}` | `{merchant:{id,name,slug,isActive}}` |

Reasons are trimmed and must contain 1–255 characters. Email is normalized with
`trim().toLowerCase()`. Adding an already active blacklist entry or repeating a
state transition returns 409. Reactivating an inactive blacklist entry appends a
new audit event. Deactivation preserves the entry and all audit history.

`accountStatus` is one of `ACTIVE`, `PENDING_APPROVAL`, `REJECTED`, `SUSPENDED`,
`BANNED`. The compatibility `isActive` field is derived from `ACTIVE`. Setting
`ACTIVE` is an unban/unsuspend action and requires the current state to be
`SUSPENDED` or `BANNED`; merchant application state is restored to pending or
rejected where applicable, so unban never approves an application. Approval and
rejection preserve an existing suspension/ban.

Blacklist items contain `id,email,reason,isActive,lastActorId,lastActorEmail,
createdAt,updatedAt`. Audit items contain `id,actorId,actorEmail,action,targetType,
targetId,reason,before,after,createdAt`. Actions are `USER_STATUS_CHANGED`,
`EMAIL_BLACKLISTED`, `EMAIL_BLACKLIST_DEACTIVATED`, `MERCHANT_STATUS_CHANGED`.
Target types are `USER`, `EMAIL_BLACKLIST`, `MERCHANT`. Audit has read-only APIs.

Account and merchant changes append audit in the same Serializable transaction.
Suspension/ban blocks existing tokens without deleting commerce history.
Deactivated merchants are rejected immediately by protected HTTP routes. Active
blacklist entries block both registration flows and password login.

Relevant errors: 400 `INVALID_INPUT`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`,
`ACCOUNT_SUSPENDED`, `ACCOUNT_BANNED`, `EMAIL_BLACKLISTED`, `MERCHANT_NOT_ACTIVE`;
404 `USER_NOT_FOUND`, `MERCHANT_NOT_FOUND`, `BLACKLIST_ENTRY_NOT_FOUND`;
409 `INVALID_STATE_TRANSITION`, `EMAIL_BLACKLIST_ACTIVE`.

Migration `20261112110000_admin_moderation` backfills account states from existing
application status and the old active flag, then removes stored `User.isActive`.
Apply it with Prisma migrations before using this contract. Actor identity is
snapshotted in audit so the historical event remains readable independently of
later profile changes.

## Merchant abuse reports

`POST /api/merchant/abuse-reports` requires an active Merchant bearer token and
accepts `{memberId,orderId?,reason}`. The target member must have a membership
with the reporting Merchant. If an order is supplied, it must belong to both
that Merchant and member. IDs must be positive integers; reason is trimmed and
must contain 1–2,000 characters. Success returns 201 `{report}` with report,
merchant, reporter, member and optional order IDs plus `createdAt`.

`GET /api/admin/abuse-reports?merchantId=&memberId=&cursor=&limit=` is
Admin-only and returns `{items,nextCursor}`. Each item includes the persisted
report reason/time, Merchant name, reporter/member identity, and optional order
summary. Reports are append-only evidence: neither endpoint changes account
status, blacklist, points, wallet, or order state. There is no edit/delete or
Merchant enforcement API. Foreign member/order targets return 404; invalid
input returns 400; unauthenticated callers receive 401 and non-Merchant or
non-Admin roles receive 403.

Migration `20261112120000_merchant_abuse_reports` adds the report table and
restrictive foreign keys; it does not rewrite existing account or commerce data.
