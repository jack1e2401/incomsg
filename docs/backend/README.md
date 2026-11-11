# IncomSG Loyalty Commerce Backend

API cho prototype loyalty nhiều cửa hàng, xây dựng bằng Express, TypeScript, Prisma và MySQL.

- **Admin** duyệt hồ sơ trước khi Merchant được quản lý cửa hàng.
- **Merchant** quản lý sản phẩm, đơn hàng, chính sách tích điểm và xác nhận trao quà.
- **Member** mua hàng, tích điểm, lên hạng và đổi voucher hoặc quà. Ví và hạng được quản lý riêng theo từng cửa hàng.

## Chạy local

Dùng Node.js 22.12 trở lên và chuẩn bị MySQL local. Tạo `apps/backend/.env` theo [.env.example](../../apps/backend/.env.example) và đặt `PAYMENT_MODE=mock` để demo thanh toán giả lập.

Chạy các lệnh sau từ thư mục gốc `IncomSG`.

```sh
npm ci
npm run db:migrate -w apps/backend -- --config prisma7.config.ts
npm run db:seed -w apps/backend
npm run dev:backend
```

API chạy mặc định tại `http://localhost:3000`.

Mã nghiệp vụ nằm trong [src/modules](../../apps/backend/src/modules), schema và migration trong [prisma](../../apps/backend/prisma), unit test và kiểm thử tích hợp trong [tests/backend](../../tests/backend).
