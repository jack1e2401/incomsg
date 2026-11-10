# IncomSG Loyalty Commerce Backend

API của prototype thương mại và loyalty cho nhiều cửa hàng. Backend xử lý duyệt Merchant, catalog, đặt hàng, thanh toán, tích điểm, xếp hạng và đổi thưởng.

Ứng dụng dùng Express, TypeScript, Prisma và MySQL. Các route xác thực bằng Bearer token và kiểm tra vai trò. Merchant chỉ quản lý dữ liệu của shop mình. Member chỉ truy cập đơn, ví và voucher thuộc tài khoản của mình.

## Nghiệp vụ chính

- **Duyệt cửa hàng.** Member có thể mua sau khi đăng ký. Merchant cần Admin duyệt hồ sơ trước khi quản lý shop. Admin local được tạo qua seed.
- **Catalog và đơn hàng.** Sản phẩm đang bán và sản phẩm dành để đổi thưởng là hai loại riêng. Một đơn có thể chứa nhiều sản phẩm của cùng một shop. Backend tính tiền và lưu tên, giá tại thời điểm đặt.
- **Loyalty theo shop.** Mỗi cặp Member và Merchant có một ví riêng. Số dư dùng để đổi thưởng. Tổng điểm đã tích lũy dùng để xét hạng. Member bắt đầu ở trạng thái chưa xếp hạng và dùng hệ số Bronze cho đơn thanh toán đầu tiên tại shop.
- **Voucher và quà.** Đổi voucher trừ điểm và ghi giao dịch trong cùng một transaction. Voucher giảm giá được giữ khi tạo đơn và chỉ được đánh dấu đã dùng sau khi đơn thanh toán. Quà đổi thưởng có trạng thái chờ trao cho đến khi Merchant xác nhận.
- **Thanh toán.** Bản demo dùng thanh toán giả lập. Khi bật VNPay Sandbox, backend xác minh IPN trước khi chốt đơn. Thanh toán lặp không cộng điểm lần hai.

Điểm mỗi đơn được tính từ số tiền thực trả sau giảm giá. Backend làm tròn xuống sau khi chia cho tỷ lệ VND trên mỗi điểm, rồi làm tròn xuống lần nữa sau khi nhân hệ số hạng. Khi đơn giúp Member lên hạng, backend lưu mốc đó cùng giao dịch điểm. Các đơn đã thanh toán trước khi có trường này vẫn đọc được điểm đã phát từ lịch sử.

## Nhóm API

| Nhóm | Phạm vi |
| --- | --- |
| `/api/auth`, `/api/admin` | Đăng ký, đăng nhập, trạng thái hồ sơ và duyệt Merchant. |
| `/api/merchants` | Danh sách shop hoạt động, sản phẩm đang bán và mẫu voucher công khai. |
| `/api/merchant` | Quản lý sản phẩm, chính sách loyalty, mẫu voucher và trao quà. Danh sách đơn trả email người mua cho Merchant sở hữu đơn. |
| `/api/member` | Đơn hàng, ví điểm, chính sách loyalty của shop và voucher của Member. |
| `/api/orders`, `/api/payments/vnpay` | Tạo đơn, thanh toán, truy vấn trạng thái và nhận thông báo từ VNPay. |

## Khởi động local

Dùng Node.js 22.12 trở lên và MySQL. Sau khi chạy `npm ci`, tạo `.env` theo [.env.example](./.env.example) và chọn `PAYMENT_MODE=mock` cho demo local. Áp migration bằng `npx prisma migrate deploy` và tạo Prisma Client bằng `npm run db:generate`. Lần đầu, chạy `npm run db:seed` để tạo Admin local.

```sh
npm run dev
```

API mặc định ở `http://localhost:3000`. Có thể kiểm tra server tại `GET /api/health` và MySQL tại `GET /api/health/db`.

## Cấu trúc repo

- [src/modules](./src/modules) nhóm route, controller, service và repository theo nghiệp vụ.
- [prisma/schema.prisma](./prisma/schema.prisma) mô tả mô hình dữ liệu. [prisma/migrations](./prisma/migrations) lưu các lần thay đổi schema.
- [tests](./tests) chứa kiểm tra tích hợp qua HTTP và MySQL cho phân quyền, thanh toán, ví điểm và đổi thưởng.
