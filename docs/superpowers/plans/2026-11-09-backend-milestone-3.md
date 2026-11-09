# Backend Milestone 3 — Catalog và Buy Now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchant quản lý sản phẩm, Member đặt mua một sản phẩm và thanh toán giả lập.

**Architecture:** Giữ Controller → Service → Repository trong hai module `products` và `orders`. Dùng guard và lookup cửa hàng hiện có. Prisma ghi đơn cùng snapshot dòng đơn, sau đó cập nhật trạng thái thanh toán có điều kiện.

**Tech Stack:** Express 5, TypeScript ESM, Prisma 7, MySQL, Node.js >= 22.12, `node:test` + `tsx`.

**Spec:** [Thiết kế flow và hợp đồng HTTP](../specs/2026-11-09-backend-milestone-3-design.md).

## Global Constraints

- Chỉ sửa `apps/backend`. Giữ Express 5, TypeScript ESM, Prisma 7, MySQL, Node.js >= 22.12 và Controller → Service → Repository.
- Dùng schema `Product`, `Order` và `OrderItem` hiện có. Dùng lại auth, role guard và lookup cửa hàng active từ Milestone 2. Không thêm dependency hay migration.
- Một đơn có một dòng sản phẩm, số lượng từ 1 đến 99. Milestone này kết thúc ở thanh toán giả lập `PAID`. Giỏ hàng, kho, danh sách/lịch sử đơn, cổng thanh toán, loyalty và voucher để sau.
- Chạy các lệnh trong repo BE. Kiểm tra test và build trước mỗi commit. Khi triển khai, giữ các commit trên `main` theo yêu cầu ở Milestone 2.

## Review Focus

1. Merchant không sửa được sản phẩm cửa hàng khác. Task 1.
2. Sản phẩm ẩn biến mất khỏi catalog và không tạo được đơn mới. Tasks 1–2.
3. BE từ chối giá do client gửi khi đặt đơn và tổng vượt cột tiền. Task 2.
4. Sửa giá hoặc ẩn sản phẩm sau khi đặt không làm đổi tiền trên đơn. Task 2.
5. Member khác nhận `404` khi thanh toán. Chủ đơn gửi lại nhận `409`. Task 2.

---

## File map và cách test

| File | Vai trò |
| --- | --- |
| `src/modules/products/products.{routes,controller,service,repository}.ts` | Catalog công khai, quản lý sản phẩm theo chủ cửa hàng, query sản phẩm đang bán |
| `src/modules/orders/orders.{routes,controller,service,repository}.ts` | Buy Now, tính tổng, snapshot, thanh toán giả lập |
| `src/app.ts` | Gắn router trước handler 404 |
| `tests/milestone-3.integration.test.ts` | Tái sử dụng cách test HTTP + MySQL của M2 |
| `README.md` | Kịch bản thử thủ công sau khi hai task hoàn thành |

Dùng một file integration test. Tạo hai Merchant active có owner role `MERCHANT` và hai User role `MEMBER` với email ngẫu nhiên. Dùng `signAccessToken` với các User fixture và gọi Express qua `127.0.0.1:0` để kiểm tra guard thật. Đặt JWT secret test trước khi import app như test M2. Dọn các fixture theo thứ tự OrderItem → Order → Product → Merchant → User, đóng server và ngắt Prisma. Không cần script npm mới.

### Task 1 — Catalog

**Files:** Tạo `src/modules/products/products.{routes,controller,service,repository}.ts` và `tests/milestone-3.integration.test.ts`. Sửa `src/app.ts`.

**Interfaces:**

- Service `createProduct(ownerId: number, input: ProductInput): Promise<ProductDto>`, `listOwnProducts(ownerId: number): Promise<ProductDto[]>`, `updateProduct(ownerId: number, productId: number, patch: ProductPatch): Promise<ProductDto>`, `listPublicProducts(merchantId: number): Promise<ProductDto[]>`. `ProductInput` có `name, price` và `description?, imageUrl?` theo spec. `ProductPatch = Partial<ProductInput> & {status?: "ACTIVE" | "HIDDEN"}`. `ProductDto` theo spec.
- Repository `create(merchantId, input)`, `listByMerchant(merchantId, activeOnly)`, `updateOwned(merchantId, productId, patch)` và `isMerchantActive(merchantId)`. `updateOwned` trả sản phẩm hoặc null khi ID không khớp cửa hàng. Export `findSellableProduct(productId: number): Promise<{id: number; merchantId: number; name: string; price: Prisma.Decimal} | null>`, lọc cả `Product.status=ACTIVE` và `Merchant.isActive=true`. Task 2 dùng query này.

- [ ] Viết test `merchant manages its own catalog`. Merchant A tạo sản phẩm `"Demo Coffee"` giá `"150000"` và nhận `201`, `assert.equal(created.product.price, "150000")`. Member tạo sản phẩm nhận `403`. Merchant B sửa sản phẩm của A nhận `404`. A sửa tên và giá thành `"160000"`, nhận `200`.
- [ ] Viết test `public catalog filters hidden products`. Catalog của A có sản phẩm đang active. Sau khi A PATCH `{status:"HIDDEN"}`, `assert.equal(publicList.products.some(p => p.id === productId), false)` và `assert.equal(ownList.products.find(p => p.id === productId).status, "HIDDEN")`. Cửa hàng inactive nhận `404`.
- [ ] Chạy `npx tsx --test tests/milestone-3.integration.test.ts`. Mong đợi đỏ vì API Catalog chưa tồn tại.
- [ ] Thêm controller validate theo spec và service lấy Merchant ID từ `merchantRepository.findActiveStoreByOwner`. Repository scope theo Merchant ID trong câu lệnh cập nhật. Gắn router quản trị tại `/api/merchant/products` sau `authenticate` và `requireRole("MERCHANT")`. Gắn router đọc công khai tại `/api/merchants`. Serializer trả tiền bằng `Decimal.toFixed(0)`.
- [ ] Chạy `npm test`, `npm run test:db`, `npm run build` và `git diff --check`. Tất cả exit 0.
- [ ] Stage file Task 1, commit `feat: add merchant product catalog`.

### Task 2 — Buy Now và thanh toán giả lập

**Files:** Tạo `src/modules/orders/orders.{routes,controller,service,repository}.ts`. Sửa `src/app.ts`, `tests/milestone-3.integration.test.ts` và `README.md`.

**Interfaces:**

- Service `createOrder(memberId: number, input: {productId: number; quantity: number}): Promise<OrderDto>` và `payOrder(memberId: number, orderId: number): Promise<OrderDto>`. `OrderDto` theo spec.
- Repository `createPendingOrder(input: {memberId: number; merchantId: number; productId: number; productName: string; unitPrice: Prisma.Decimal; quantity: number; total: Prisma.Decimal}): Promise<OrderDto>` và `markPaid(memberId: number, orderId: number): Promise<OrderDto | "missing" | "already_paid">`. Lấy giá và Merchant ID từ `findSellableProduct` của Task 1.

- [ ] Viết test `buy now snapshots price and name`. Sản phẩm giá `"150000"`, số lượng `2` tạo đơn `201` với `assert.equal(order.status, "PENDING")`, `assert.equal(order.total, "300000")`, `assert.equal(order.items[0].unitPrice, "150000")` và `assert.equal(order.items[0].productName, "Demo Coffee")`. Sửa tên, giá và ẩn sản phẩm, rồi trả tiền đơn cũ. Assert tiền và tên trên đơn vẫn như cũ. Đặt mới cùng product ID nhận `404`.
- [ ] Viết test `buy now validates the payload`. `quantity: 0`, body chứa `total: "1"` và tổng từ giá `"999999999999999"` nhân `2` đều trả `400`.
- [ ] Viết test `only the member who owns the order can pay once`. Member B trả tiền đơn A nhận `404`. Member A nhận `200`, `assert.equal(order.status, "PAID")` và `assert.ok(order.paidAt)`. Gửi lần hai nhận `409`, kiểm tra `paidAt` trong DB giữ nguyên. Merchant gọi route đặt đơn nhận `403`.
- [ ] Chạy `npx tsx --test tests/milestone-3.integration.test.ts`. Ca Catalog pass, ca Orders đỏ vì route chưa có.
- [ ] Thêm Orders router tại `/api/orders` sau `authenticate` và `requireRole("MEMBER")`. Lấy Member ID từ `res.locals.user.id`. Service nhân Decimal, kiểm giới hạn rồi gọi Repository nested create Order + OrderItem, đặt tiền giảm bằng 0. `markPaid` dùng update có điều kiện theo `id, memberId, status=PENDING` rồi đọc đơn theo cùng owner. Nếu không cập nhật được, dùng lookup theo owner để phân biệt `404` và `409`.
- [ ] Cập nhật README với một ô PowerShell cho mỗi lệnh `Invoke-RestMethod`. Dùng token đã lấy từ M2 để chạy tạo sản phẩm → xem catalog → đặt đơn → thanh toán. Ghi kết quả mong đợi ở từng bước.
- [ ] Chạy `npm test`, `npm run test:db`, `npm run build` và `git diff --check`. Tất cả exit 0. Dừng khi nghiệm thu đạt.
- [ ] Stage file Task 2, commit `feat: add buy now and simulated order payment`.
