# Milestone 3 BE — Catalog và Buy Now

Roadmap có hai cách nhóm công việc. Plan này theo Prompt 03 (Catalog + Orders) vì luồng duyệt Merchant đã hoàn tất ở Milestone 2. Luồng đặt đơn bám BR-08 và dùng lựa chọn Buy Now trong phần cắt scope của roadmap.

## Phạm vi

- Chỉ sửa `apps/backend`. Giữ Express 5, TypeScript ESM, Prisma 7, MySQL, Node.js >= 22.12 và Controller → Service → Repository.
- Dùng schema `Product`, `Order` và `OrderItem` hiện có. Dùng lại auth, role guard và lookup cửa hàng active từ Milestone 2. Không thêm dependency hay migration.
- Một đơn có một dòng sản phẩm, số lượng từ 1 đến 99. Milestone này kết thúc ở thanh toán giả lập `PAID`. Giỏ hàng, kho, danh sách/lịch sử đơn, cổng thanh toán, loyalty và voucher để sau.

## Luồng demo

1. Merchant đã được duyệt tạo sản phẩm cho cửa hàng của mình. Merchant có thể xem danh sách riêng, sửa thông tin và đổi trạng thái `ACTIVE` hoặc `HIDDEN`.
2. Member gọi catalog theo Merchant ID. Catalog mở cho khách và chỉ hiển thị sản phẩm `ACTIVE` của cửa hàng active.
3. Member gửi `productId` và `quantity`. BE tra sản phẩm đang bán, suy ra Merchant từ sản phẩm và tính tiền. BE lưu đơn `PENDING` cùng một dòng đơn bằng nested create. Tên và đơn giá trên dòng đơn là snapshot tại lúc đặt. Giá trị `subtotal` và `total` bằng đơn giá nhân số lượng, `discountAmount` bằng `"0"`, `voucherId` và `paidAt` là null.
4. Member thanh toán đơn của mình. BE đổi có điều kiện từ `PENDING` sang `PAID` và ghi `paidAt`. Gọi lại trả `409` và giữ thời điểm thanh toán ban đầu. Đơn đã tạo giữ snapshot và vẫn có thể thanh toán khi sản phẩm đổi giá hoặc bị ẩn.

## Hợp đồng API

| Method và path | Quyền | Request | Thành công |
| --- | --- | --- | --- |
| `POST /api/merchant/products` | Merchant, cửa hàng active | `{name,price,description?,imageUrl?}` | `201 {product}`, status `ACTIVE` |
| `GET /api/merchant/products` | Merchant, cửa hàng active | — | `200 {products}`, gồm cả `HIDDEN` |
| `PATCH /api/merchant/products/:productId` | Merchant sở hữu sản phẩm | Ít nhất một trường tạo sản phẩm hoặc `status` | `200 {product}` |
| `GET /api/merchants/:merchantId/products` | Public | — | `200 {products}`, chỉ `ACTIVE` |
| `POST /api/orders` | Member | `{productId,quantity}` | `201 {order}`, status `PENDING` |
| `POST /api/orders/:orderId/pay` | Member sở hữu đơn | — | `200 {order}`, status `PAID` |

- `product` gồm `id, merchantId, name, description, imageUrl, price, status`. Các danh sách trả thứ tự `id asc`.
- `order` gồm `id, merchantId, memberId, status, subtotal, discountAmount, total, paidAt, items`. Dòng đơn gồm `productId, productName, unitPrice, quantity, lineTotal`. `paidAt` là ISO UTC hoặc null. Mọi trường tiền là chuỗi số nguyên VND, ví dụ `"150000"`.
- Input tạo/sửa sản phẩm và tạo đơn là JSON object, chỉ chấp nhận trường trong bảng. `name` trim rồi dài 1–191 ký tự. `price` là chuỗi chữ số từ `"1"` đến `"999999999999999"`, không có dấu, số 0 đứng đầu hoặc phần thập phân. `description` có thể null hoặc chuỗi tối đa 1000 ký tự. `imageUrl` có thể null hoặc URL HTTP(S) tối đa 2048 ký tự. Hai trường tùy chọn mặc định null khi tạo. Với PATCH, trường vắng giữ nguyên, null xóa mô tả hoặc ảnh.
- ID phải là số nguyên từ 1 đến 2147483647. Route param dùng chữ số thập phân. `productId` và `quantity` trong body là JSON number. Dùng Decimal cho phép nhân và từ chối tổng vượt giới hạn `Decimal(15,0)` trước khi ghi.
- Dùng lỗi `{error:string}` theo Milestone 2. `400 INVALID_INPUT` cho payload/ID sai hoặc tổng vượt giới hạn. `401 UNAUTHORIZED` cho thiếu token hợp lệ. `403 FORBIDDEN` cho sai role và `403 MERCHANT_NOT_ACTIVE` khi không có cửa hàng active của Merchant. `404 MERCHANT_NOT_FOUND` khi cửa hàng public thiếu hoặc inactive, `404 PRODUCT_NOT_FOUND` khi sản phẩm thiếu, không thuộc Merchant đang sửa hoặc không bán được tại lúc đặt, `404 ORDER_NOT_FOUND` khi đơn thiếu hoặc thuộc Member khác. `409 ORDER_ALREADY_PAID` khi đơn của chính Member đã thanh toán.

## Nghiệm thu

Merchant A tạo và sửa được sản phẩm của mình, Merchant B không sửa được. Catalog ẩn sản phẩm `HIDDEN`. Member tạo đơn từ sản phẩm đang bán, BE tính đúng tiền và giữ snapshot. Member khác không thanh toán được đơn. Chủ đơn thanh toán thành công một lần và lần sau nhận `409`.
