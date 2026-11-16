# Storefront and Merchant UI Refactor

## Goal

Make the member storefront easier to browse and the merchant console easier to navigate while preserving existing checkout, voucher, Loyalty, and bottom-navigation behavior.

## Member storefront

- Replace the long footer rendering with a compact, visible “Thông tin cửa hàng” card containing an optional shop image, address, weekly opening hours, and available contact/directions actions.
- Add a separately configurable shop image. If it is absent, use the existing logo as the card image.
- Store opening hours as optional weekly data in storefront branding; when configured, each weekday is either marked closed or has an opening and closing time. Do not add holiday exceptions in this milestone.
- The home page shows at most six curated products in configured order. If none are selected, show up to six newest sale products. Keep the category chips; selecting a category opens the product catalog with that category selected.
- Remove the product grid from the home page and show a “Xem tất cả” link to the full catalog.
- The product catalog uses eight products per page and explicit page navigation. Keep horizontal category chips, search, and sort.
- Show inventory as “Còn hàng” above 10, “Chỉ còn X sản phẩm” from 1 through 10, and “Hết hàng” at zero. Sold-out products remain visible, and adding them to cart is disabled. Keep backend inventory checks authoritative.
- Keep the member bottom navigation unchanged.

## Merchant console

- Organize the merchant sidebar into expandable groups: Vận hành (Tổng quan, Đơn hàng), Sản phẩm (Sản phẩm, Danh mục), Cửa hàng (Thông tin cửa hàng, Giao diện cửa hàng), Khách hàng & Loyalty (Khách hàng, Cấu hình điểm, Giao dịch điểm, Lịch sử chính sách, Voucher), Marketing (Sự kiện), Báo cáo (Phân tích).
- Keep each item as a direct route. Split Loyalty's current query tabs into `/merchant/loyalty/config`, `/transactions`, `/history`, and `/members`, with old query-tab URLs redirected.
- Move category management to `/merchant/categories`; keep product inventory controls in the existing product flows. Do not create an inventory page without a separate existing endpoint/workflow.
- Preserve the mobile drawer and all Admin navigation.

## Explicitly deferred

Product promotions, discounted price display, promotion configuration and order-price calculation are out of scope. Voucher and Loyalty remain separate existing features.

## Acceptance

- Public home has no full catalog grid or long footer; it has at most six featured products, category links, and the store information card.
- Catalog page loads eight products per page and retains filter/sort state while paging.
- Existing storefront configurations without shop image or opening hours load safely and can still be edited and published.
- Existing storefront configurations with up to 12 featured-product IDs remain readable and saveable; the editor prevents adding beyond six and the public home displays at most six.
- Merchant sidebar exposes the agreed groups; each child route loads directly, and existing Loyalty tab URLs resolve to the matching route.
- Admin routes and member bottom navigation remain unchanged.
