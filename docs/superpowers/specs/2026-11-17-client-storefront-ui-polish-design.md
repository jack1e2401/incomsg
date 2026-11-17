# Client Storefront UI Polish

## Intent

Use the supplied Go&Go and product-card screenshots as visual references to make the client storefront easier to scan on phones, while keeping its current visual identity and a balanced desktop layout. This is a frontend presentation change only.

## Goals

- Keep featured products and the full catalog in two columns on mobile and four columns on desktop; use three columns at tablet widths.
- Refine product cards using the reference image proportions and spacing while retaining the storefront's current light surfaces and merchant accent color.
- Show stock status as one small inline line below the price, without a pill background. Preserve the existing copy and semantic colors: `Còn hàng` in muted green above 10, `Chỉ còn X sản phẩm` in orange for 1–10, and `Hết hàng` in red at zero. Keep adding disabled when sold out.
- Replace the product-card `Thêm` label with a compact, stylized cart/add icon. Keep an accessible name and a comfortable touch target; do not use a plain text `+`.
- Refine product detail for mobile and retain its desktop two-column image and information layout.
- Pin the mobile product-detail add-to-cart action above the existing bottom navigation. Keep quantity selection in the product information section.
- Preserve all current bottom-navigation destinations and current cart behavior.

## Non-goals

- No Merchant UI, API, backend, data model, checkout, payment, fulfillment, Loyalty, voucher, news, or member-profile changes.
- No sale price, crossed-out price, discount badge, or new promotion behavior; the image is a layout reference and offers are deferred.
- No changes to stock thresholds, stock copy, pricing, or cart/order rules.

## Approaches

- Keep the current product grid at all sizes and polish spacing and status text. This is the smallest change but leaves the mobile product cards less aligned with the supplied reference.
- Use horizontal product rows on mobile and a grid on desktop. This follows the earlier reference but conflicts with the user's clarified two-column mobile preference.
- **Selected: responsive product-card grid.** Use two columns on mobile, three on tablet, and four on desktop. Refine image framing, text hierarchy, stock status, and add-to-cart affordance while preserving the current store theme.

## Constraints and implementation calls

- Existing catalog pagination remains 8 products per page; category chips and search/sort controls remain usable.
- The stock helper's business meaning stays unchanged; only presentation changes.
- The mobile add-to-cart bar must sit above, not replace or overlap, the existing bottom navigation and safe-area inset.
- Desktop detail keeps its image and product information in two columns; the desktop CTA remains in the product information area.
- Use existing product images, brand colors, components, and CSS conventions. Add no dependencies or remote assets.

## Acceptance

- Home featured products and catalog render as two columns on mobile, three on tablet, and four on desktop.
- Product-card actions have no visible `Thêm` text or bare plus glyph, remain accessible by name, and have a comfortable touch target.
- Stock text is one compact line, readable without color, and visually distinguishes in-stock, low-stock, and sold-out states.
- Mobile product detail keeps the add-to-cart action visible above the full bottom navigation without obscuring page content; sold-out behavior remains disabled.
- Desktop product detail remains a balanced two-column layout.
- Existing links, cart actions, catalog pagination/filter state, and merchant navigation remain intact.
