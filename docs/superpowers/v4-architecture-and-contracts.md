# IncomSG V4 — Architecture & API Contracts

**Status:** Approved Baseline (M0)
**Target Database:** MySQL 8.0 via Prisma 7 (`@prisma/adapter-mariadb`)

---

## 1. Cross-Cutting Architectural Rules

1. **Tenant Isolation:**
   - Every Merchant admin route (`/api/merchant/...`) derives `merchant` exclusively from `response.locals.user.id` via `merchantService.getOwnStore(ownerId)`. Any `merchantId` in request body/query/params is rejected or ignored for ownership.
   - Public storefront & event & catalog routes resolve active merchant by `slug` (`/api/public/stores/:slug...`, `isActive: true`) or `merchantId` (`/api/merchants/:merchantId/...`). Inactive merchants return `404 MERCHANT_NOT_FOUND` (or `403 MERCHANT_NOT_ACTIVE` on `/api/merchants/:merchantId/products` where existing tests expect it — preserved).
   - Cross-merchant mutations or reads by another merchant return `404` or `403`.
2. **Timezone & Arithmetic:**
   - All Analytics & Customer 360° day/month aggregations use **`Asia/Ho_Chi_Minh` (`+07:00`)** matching `merchant.finance.ts`.
   - All VND sums/AOV use `Prisma.Decimal` (integer VND `ROUND_HALF_UP` for AOV display), never JS binary floats.
3. **`REFUND_PENDING` Consistency Rule:**
   - Consistent with `merchant.finance.ts`:
     - **`PAID` + `REFUND_PENDING`** orders are counted as **current net revenue / spend** (since refund provider confirmation has not completed), while **`REFUND_PENDING`** count and VND amount are always surfaced separately in Customer 360° and Analytics V1 so merchants see pending exposure clearly.
     - **`REFUNDED`, `FAILED`, `CANCELLED`, `PENDING`** orders are excluded from net revenue, paid order count, AOV, and product sales quantities.
     - Reward redemptions (`MemberVoucher` of type `REWARD`) never contribute to sales revenue.
4. **Sanitization & Asset Safety:**
   - No arbitrary HTML/CSS/JS anywhere in Storefront Branding, Product richDescription, or Event description. All text fields are rendered as safe React text/paragraphs (`whitespace-pre-line`).
   - Allowed image URLs: `https://...`, `http://...`, `/images/...`, or `/uploads/...`.
   - Allowed CTA / Storefront links: relative storefront paths (`/s/:slug` or `/s/:slug/...`) or `https://...` URLs (reject `javascript:`, `data:`, `vbscript:`, protocol-relative `//`).
   - Brand `primaryColor`: strict hex `^#[0-9a-fA-F]{6}$`.
5. **Multipart Image Upload (`/api/merchant/media/upload`):**
   - Authenticated `MERCHANT` only (`requireRole("MERCHANT")`).
   - Accepts `multipart/form-data` with field `file` (max 5 MB; PNG, JPEG, WebP verified by magic bytes + MIME).
   - Stored under `<UPLOAD_DIR>/merchant-<merchantId>/<uuid>.<ext>` (configurable `process.env.UPLOAD_DIR`, default `apps/backend/uploads`).
   - Served statically at `/uploads/...` with `X-Content-Type-Options: nosniff`.

---

## 2. Storefront Config JSON Schema (`StorefrontConfigDto`)

```ts
export type StorefrontSectionKey =
  | "hero"
  | "featured_products"
  | "categories"
  | "upcoming_events"
  | "store_info"
  | "footer";

export interface StorefrontSectionConfig {
  key: StorefrontSectionKey;
  enabled: boolean;
  order: number; // 0..5 unique across the 6 fixed sections
  title?: string | null;
  subtitle?: string | null;
}

export interface StorefrontAllowedLink {
  label: string; // 1..60 chars
  url: string;   // relative /s/:slug... or https://...
}

export interface StorefrontBrandingConfig {
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string; // default "#335e3d"
  heroTitle: string;
  heroDescription: string | null;
  heroImageUrl: string | null;
  heroCtaText: string | null;
  heroCtaLink: string | null;
  footerDescription: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  allowedLinks: StorefrontAllowedLink[];
}

export interface StorefrontConfig {
  branding: StorefrontBrandingConfig;
  sections: StorefrontSectionConfig[]; // always all 6 keys
  featuredProductIds: number[];        // validated to belong to this merchant (SALE, ACTIVE)
}
```

When a `Merchant` is approved (or first accessed if pre-existing), a default `StorefrontConfigVersion` (`version: 1, isPublished: true, source: "DEFAULT_INIT"`) and matching `StorefrontDraft` are initialized from `merchant.name` and `/s/${merchant.slug}`.

---

## 3. Complete API Contracts by Workstream

### Workstream A — Merchant Slug, Media Upload & Storefront

#### Auth & Slug
- `POST /api/auth/register/merchant`
  - Body: `{ email, password, storeName, slug? }`
  - `slug`: optional, 3–63 chars, `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Reserved slugs (`admin`, `merchant`, `member`, `login`, `register`, `api`, `uploads`, `s`) rejected with `400 INVALID_INPUT`.
  - If `slug` omitted: auto-slugified from `storeName` (transliterating Vietnamese characters) + numeric suffix if taken.
  - Collision against existing `Merchant.slug` or `MerchantApplication.slug` -> `409 SLUG_TAKEN`.
  - `MerchantApplicationDto` adds `slug: string | null`.
- `POST /api/admin/merchants/:id/approve`
  - Uses `application.slug ?? fallbackSlug(application.storeName, application.id)` to create `Merchant`, and initializes `StorefrontConfigVersion` v1 (`DEFAULT_INIT`, `isPublished: true`) + `StorefrontDraft`.

#### Merchant Media Upload
- `POST /api/merchant/media/upload` (`MERCHANT`)
  - `multipart/form-data` (`file`) -> `201 { url: "/uploads/merchant-<id>/<uuid>.<ext>", mimeType, size }`
  - Errors: `400 INVALID_FILE_TYPE` / `400 FILE_REQUIRED`, `413 FILE_TOO_LARGE`.

#### Merchant Storefront Management (`MERCHANT`)
- `GET /api/merchant/storefront` -> `{ merchant, draft: { config, updatedAt }, published: VersionSummary | null }`
- `PUT /api/merchant/storefront/draft` -> Body: `StorefrontConfig` -> `200 { draft: { config, updatedAt } }` (validates `featuredProductIds` belong to this merchant!)
- `GET /api/merchant/storefront/preview` -> `{ merchant, config, isDraftPreview: true, categories, featuredProducts, upcomingEvents }`
- `POST /api/merchant/storefront/publish` -> Body: `{ note?: string }` -> `201 { published: VersionDto, draft }` (atomically marks previous `isPublished = false`, creates next `version`, `isPublished = true`)
- `GET /api/merchant/storefront/versions` -> `{ versions: VersionSummaryDto[] }`
- `POST /api/merchant/storefront/versions/:versionId/rollback` -> Body: `{ note?: string }` -> `201 { published: VersionDto, draft }` (creates a NEW published version with `source: "ROLLBACK", sourceVersionId`, copies config to draft or keeps draft? Copies rolled-back config into `published` and updates `StorefrontDraft` to match or returns both — specifically: creates new `StorefrontConfigVersion` with `source: "ROLLBACK"` so publish history is append-only & auditable!)

#### Public Storefront (`Guest` & `Member`)
- `GET /api/public/stores/:slug` -> `{ merchant: { id, name, slug }, version, config, featuredProducts, categories, upcomingEvents }` (reads ONLY `isPublished = true`, auto-initializes v1 if merchant existed pre-V4 without versions).

---

### Workstream B — Product Catalog V2

#### Merchant Categories (`MERCHANT`)
- `GET /api/merchant/categories` -> `{ categories: ProductCategoryDto[] }`
- `POST /api/merchant/categories` -> `{ name, slug?, description?, sortOrder? }` -> `201 { category }`
- `PATCH /api/merchant/categories/:categoryId` -> `{ name?, slug?, description?, sortOrder? }` -> `200 { category }`
- `DELETE /api/merchant/categories/:categoryId` -> `200 { deleted: true }` (sets `Product.categoryId = null` via `onDelete: SetNull` or explicitly in tx scoped to `merchantId`)

#### Merchant Products (`MERCHANT`) — Upgraded Contract
- `GET /api/merchant/products?q=&categoryId=&status=&kind=&lowStock=&sort=&page=&limit=`
  - Response: `{ items: ProductDto[], pagination: { page, limit, totalItems, totalPages } }` (defaults: `page=1, limit=20`, max `limit=100`).
- `POST /api/merchant/products`
  - Body adds optional: `sku?: string | null`, `categoryId?: number | null`, `lowStockThreshold?: number` (default 5, `0..100000`), `richDescription?: string | null` (max 5000 chars), `images?: { url: string; altText?: string | null; sortOrder?: number }[]` (max 10).
  - If `images` provided without `imageUrl`, `imageUrl` syncs to `images[0].url`. If `imageUrl` provided without `images`, creates 1 `ProductImage` entry.
  - `categoryId` validated to belong to `merchant.id` (`404 CATEGORY_NOT_FOUND` if other merchant or missing).
  - Duplicate `sku` in same merchant -> `409 SKU_ALREADY_EXISTS`.
- `PATCH /api/merchant/products/:productId`
  - Supports updating `name, price (SALE only), description, richDescription, imageUrl, status, sku, categoryId, lowStockThreshold, images`.
  - When `images` is provided, replaces product gallery inside transaction and syncs `Product.imageUrl = images[0]?.url ?? null`.

#### Public Products
- `GET /api/merchants/:merchantId/products?q=&categoryId=&sort=&page=&limit=`
  - Response: `{ items: ProductDto[], pagination: { page, limit, totalItems, totalPages } }`.
- `GET /api/public/stores/:slug/products?q=&categoryId=&sort=&page=&limit=`
  - Response: `{ items: ProductDto[], categories: ProductCategoryDto[], pagination: { page, limit, totalItems, totalPages } }`.
- `GET /api/public/stores/:slug/products/:productId`
  - Response: `{ product: ProductDto }` (only `kind = SALE, status = ACTIVE`, active merchant).

`ProductDto` fields:
```ts
export interface ProductImageDto {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
}
export interface ProductCategoryDto {
  id: number;
  merchantId: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}
export interface ProductDto {
  id: number;
  merchantId: number;
  categoryId: number | null;
  category: { id: number; name: string; slug: string } | null;
  sku: string | null;
  name: string;
  description: string | null;
  richDescription: string | null;
  imageUrl: string | null;
  images: ProductImageDto[];
  lowStockThreshold: number;
  isLowStock: boolean; // availableQuantity <= lowStockThreshold
  kind: ProductKind;
  price: string;
  status: ProductStatus;
  inventory: { availableQuantity: number; onHandQuantity?: number; reservedQuantity?: number };
}
```

---

### Workstream C — Event Content Management

#### Merchant Events (`MERCHANT`)
- `GET /api/merchant/events?status=&q=&page=&limit=` -> `{ items: MerchantEventDto[], pagination }`
- `POST /api/merchant/events` -> `{ title, slug?, description, bannerUrl?, startAt, endAt, locationName, locationAddress? }` (`endAt > startAt` validated) -> `201 { event }` (starts `DRAFT`)
- `GET /api/merchant/events/:eventId` -> `{ event }`
- `PATCH /api/merchant/events/:eventId` -> `{ title?, slug?, description?, bannerUrl?, startAt?, endAt?, locationName?, locationAddress? }` -> `200 { event }`
- `POST /api/merchant/events/:eventId/publish` -> `200 { event }` (`status = "PUBLISHED"`, sets `publishedAt`)
- `POST /api/merchant/events/:eventId/unpublish` -> `200 { event }` (`status = "DRAFT"`)
- `DELETE /api/merchant/events/:eventId` -> only allowed when `status === "DRAFT"`, otherwise `409 EVENT_NOT_DRAFT` -> `200 { deleted: true }`

#### Public Events (`Guest` & `Member`)
- `GET /api/public/stores/:slug/events?scope=upcoming|past|all&page=&limit=` -> `{ items: MerchantEventDto[], pagination }` (ONLY `PUBLISHED`)
- `GET /api/public/stores/:slug/events/:eventSlug` -> `{ event: MerchantEventDto }` (ONLY `PUBLISHED`, `404 EVENT_NOT_FOUND` for `DRAFT` or other merchant)

---

### Workstream D — Automatic Membership & Customer 360°

#### Automatic Membership (`MEMBER`)
- `POST /api/member/stores/:slug/membership` -> `200 { membership: { id, merchantId, memberId, tier, createdAt }, created: boolean }`
- `POST /api/member/merchants/:merchantId/membership` -> same idempotent contract for `/member/:merchantId` compatibility.
  - Concurrency-safe (`upsert` + `P2002` catch & re-read inside tx), creates `LoyaltyWallet` if missing, keeps `tierId: null` (`UNRANKED`) until first `EARN`.
  - Rejects inactive/missing merchant with `404 MERCHANT_NOT_FOUND` / `403 MERCHANT_NOT_ACTIVE`.
  - Requires `MEMBER` role (`401`/`403` for guests/merchants/admins).

#### Merchant Customer 360° (`MERCHANT`)
- `GET /api/merchant/customers?q=&tier=&purchaseStatus=all|buyers|non_buyers&page=&limit=`
  - Response: `{ items: CustomerSummaryDto[], pagination }`
  - `CustomerSummaryDto`:
    - `memberId`, `email`, `joinedAt` (`membership.createdAt`)
    - `tier` (`UNRANKED | BRONZE | SILVER | GOLD | PLATINUM`)
    - `availablePoints`, `netLifetimeEarned`, `pointDebt` (exact decimal strings / integer as existing)
    - `paidOrderCount` (count of `PAID` + `REFUND_PENDING`? Wait: let's return `paidOrderCount` for `PAID`, `refundPendingOrderCount`, `refundPendingSpendVnd`, `netSpendVnd` (`PAID + REFUND_PENDING`), `lastPurchaseAt`)
- `GET /api/merchant/customers/:memberId`
  - Response: `{ customer: CustomerDetailDto }`
  - Includes:
    - `member: { id, email, joinedAt }`
    - `stats: { totalOrders, paidOrderCount, refundPendingOrderCount, refundedOrderCount, netSpendVnd, refundPendingSpendVnd, averageOrderValueVnd, lastPurchaseAt }`
    - `wallet`: same rich wallet DTO (exactBalance, availablePoints, fractionalCarry, pointDebt, netLifetimeEarned, tier, policy)
    - `pointLedger`: `PointTransactionDto[]` (most recent 50 or paginated)
    - `vouchers`: `MemberVoucherDto[]`
    - `orders`: `OrderDto[]`
  - Cross-merchant check: member must have `MerchantMembership` in this `merchant.id`, else `404 MEMBER_NOT_FOUND`. All orders, vouchers, and ledger entries strictly filtered by `merchantId`.

---

### Workstream E — Merchant Analytics V1 (`MERCHANT`)

- `GET /api/merchant/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|month`
  - Defaults: `to` = today (`Asia/Ho_Chi_Minh`), `from` = 29 days ago (30-day window) for `day`, or 11 months ago for `month`.
  - Validates `from <= to`, max range 366 days.
  - All calculations use `Asia/Ho_Chi_Minh` (`+07:00`) and `Prisma.Decimal`.
  - Response:
    ```ts
    {
      range: { from: string; to: string; granularity: "day" | "month"; timezone: "Asia/Ho_Chi_Minh" },
      kpis: {
        netRevenueVnd: string,          // sum(total) for PAID + REFUND_PENDING in range
        paidOnlyRevenueVnd: string,     // sum(total) for PAID in range
        refundPendingRevenueVnd: string,// sum(total) for REFUND_PENDING in range
        refundedRevenueVnd: string,     // sum(total) for REFUNDED in range
        paidOrderCount: number,         // count(PAID + REFUND_PENDING) in range
        refundPendingOrderCount: number,
        refundedOrderCount: number,
        averageOrderValueVnd: string,   // netRevenueVnd / paidOrderCount (0 if 0 orders, ROUND_HALF_UP)
        totalMembers: number,           // total MerchantMembership for merchant
        newMembers: number,             // memberships createdAt in range
        returningCustomers: number,     // members with >= 2 qualifying orders lifetime (or >=1 prior to range + >=1 in range; let's define clearly: members who placed a qualifying order in range AND have total >= 2 qualifying orders with this merchant)
      },
      revenueSeries: { bucket: string; label: string; revenueVnd: string; orderCount: number }[],
      topProducts: { productId: number; productName: string; sku: string | null; unitsSold: number; revenueVnd: string }[], // top 10 in range
      slowMovingProducts: { productId: number; productName: string; sku: string | null; unitsSold: number; revenueVnd: string; availableQuantity: number }[], // active SALE products sorted ascending by unitsSold in range (bottom 10)
      noSales90DaysProducts: { productId: number; productName: string; sku: string | null; availableQuantity: number; lastSoldAt: string | null }[], // active SALE products with 0 qualifying sales in last 90 days
      lowStockProducts: { productId: number; productName: string; sku: string | null; availableQuantity: number; lowStockThreshold: number }[], // active products where availableQuantity <= lowStockThreshold
    }
    ```

---

## 4. Frontend Routes Map

### Public & Storefront Routes (Unauthenticated + Authenticated Member)
- `/s/:slug` — Public Storefront Home (renders sections in Merchant's configured order; if `?preview=draft` and logged in as that Store's `MERCHANT` owner, fetches preview draft)
- `/s/:slug/products/:productId` — Public Product Detail (gallery, SKU, category, rich description, available stock, add to cart -> prompts login with `?returnTo=/s/:slug/products/:productId` if unauthenticated)
- `/s/:slug/events` — Public Events List (published upcoming & past)
- `/s/:slug/events/:eventSlug` — Public Event Detail
- `/s/:slug/cart` (`MEMBER` required, redirects to `/login?returnTo=/s/:slug/cart`)
- `/s/:slug/checkout` (`MEMBER` required)
- `/s/:slug/wallet` (`MEMBER` required)
- `/s/:slug/vouchers` (`MEMBER` required)
- `/s/:slug/rewards` (`MEMBER` required)
- `/s/:slug/orders` (`MEMBER` required)
- `/s/:slug/orders/:orderId` (`MEMBER` required)

### Legacy Compatibility Routes (Preserved)
- `/member` -> `MemberLanding` (links to `/s/:slug` or `/member/:merchantId`)
- `/member/:merchantId/*` -> still works for all existing member routes and links!

### Merchant Console Routes (`/merchant/...`)
- `/merchant` -> `MerchantOverview`
- `/merchant/store` -> `MerchantStore` (store info + slug display)
- `/merchant/storefront` -> `MerchantStorefront` (Branding editor, Sections enable/order, Featured products, Image upload, Draft save, Preview link, Publish, Version history & Rollback)
- `/merchant/products` -> `MerchantProducts` (Category manager + Product V2 CRUD with SKU/Gallery/Threshold + Search/Filter/Sort/Pagination)
- `/merchant/events` -> `MerchantEvents` (Event CRUD, Draft/Publish/Unpublish/Delete Draft)
- `/merchant/customers` -> `MerchantCustomers` (Customer 360° List)
- `/merchant/customers/:memberId` -> `MerchantCustomerDetail` (Customer 360° Detail)
- `/merchant/analytics` -> `MerchantAnalytics` (KPI cards, Revenue chart, Top/Slow/90-day/Low-stock tables, Date filters)
- `/merchant/orders`, `/merchant/loyalty`, `/merchant/vouchers` -> preserved
