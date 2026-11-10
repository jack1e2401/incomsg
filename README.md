# IncomSG Loyalty Commerce Backend

API cho prototype loyalty nhiều cửa hàng, xây dựng bằng Express, TypeScript, Prisma và MySQL.

- **Admin** duyệt hồ sơ trước khi Merchant được quản lý cửa hàng.
- **Merchant** quản lý sản phẩm, đơn hàng, chính sách tích điểm và xác nhận trao quà.
- **Member** mua hàng, tích điểm, lên hạng và đổi voucher hoặc quà. Ví và hạng được quản lý riêng theo từng cửa hàng.

## Chạy local

Dùng Node.js 22.12 trở lên, cài dependencies và chuẩn bị MySQL đã áp migration. Cấu hình theo [.env.example](./.env.example) và đặt `PAYMENT_MODE=mock` để demo thanh toán giả lập.

```sh
npm run dev
```

API chạy mặc định tại `http://localhost:3000`.

Mã nghiệp vụ nằm trong [src/modules](./src/modules), schema và migration trong [prisma](./prisma), kiểm thử tích hợp trong [tests](./tests).
