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

## Kiểm thử DB local

Chạy `npm run test:db` từ root. Lệnh này chỉ dùng MySQL local `incomsg-test`,
áp dụng migration đã commit rồi chạy integration tests; `.env` của app không bị sửa.
Mặc định lấy thông tin kết nối từ `apps/backend/.env` và thay tên database thành
`incomsg-test`. Có thể đặt `TEST_DATABASE_URL` cho tài khoản test riêng; URL này
phải trỏ đúng database `incomsg-test` trên localhost/127.0.0.1/::1. Database phải
được tạo trước và tài khoản cần quyền migration trên database test.

Không chạy trực tiếp workspace `test:db` bằng cấu hình database app. Unit suites
vẫn dùng `npm test`; typecheck/build dùng các scripts tại root.

M1 lưu điểm bằng DECIMAL(38,12), làm tròn HALF_UP một lần tại 12 chữ số thập phân.
Wallet trả `exactBalance`, `fractionalCarry`, `pointDebt`, `netLifetimeEarned` dạng
chuỗi decimal; `availablePoints` và `lifetimeEarnedPoints` là số nguyên suy ra.
Ledger `delta`/`balanceAfter` và order `earnedPointsExact` là chuỗi chính xác.
Ví dụ hai đơn 6000 VND, rate 10000, multiplier 1.00 tạo balance `1.2`, available
`1`, carry `0.2`. Đổi voucher 1 điểm còn balance/carry `0.2`, lifetime vẫn `1.2`.

Migration M1 dừng trước khi đổi cột nếu wallet không khớp tổng ledger hoặc đơn
PAID thiếu EARN. Phải đối soát dữ liệu lệch trước khi retry; không tự tạo điểm bù.
Không thể khôi phục phần lẻ đã mất trước M1. VNPay attempt mở trước migration
giữ cách tính nguyên cũ để không vượt reservation cũ; attempt mới chốt policy/tier
khi bắt đầu thanh toán và nhận điểm lẻ theo M1.

Mã nghiệp vụ nằm trong [src/modules](../../apps/backend/src/modules), schema và migration trong [prisma](../../apps/backend/prisma), unit test và kiểm thử tích hợp trong [tests/backend](../../tests/backend).

| Nhóm trong `src/modules` | Trách nhiệm |
| --- | --- |
| `loyalty` | Chương trình hội viên, chính sách tính điểm, hạng, ví, sổ điểm, voucher và thử thách. |
| `commerce` | Sản phẩm, tồn kho, đơn hàng, thanh toán và hoàn tiền. |
| `merchants` | Hồ sơ, đăng ký, cửa hàng công khai và sự kiện của merchant. |
| `reporting` | Tra cứu hồ sơ khách hàng và phân tích cho merchant. |
| `governance` | Quản trị và báo cáo vi phạm. |
| `platform` | Xác thực, kiểm tra tình trạng hệ thống và tải tệp. |

[Hoàn tất thanh toán](../../apps/backend/src/modules/commerce/orders/orders.complete-payment.ts) và [hoàn tất hoàn tiền](../../apps/backend/src/modules/commerce/refunds/refunds.complete.ts) điều phối các thao tác nghiệp vụ qua transaction do điểm gọi truyền vào. Công thức và thao tác ghi sổ điểm nằm trong `loyalty/program`. [app.ts](../../apps/backend/src/app.ts) đăng ký các tuyến HTTP và middleware của từng nhóm.
