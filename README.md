# Backend

Express + TypeScript + Prisma + MySQL. Mỗi module đặt controller, service, repository và routes cạnh nhau trong `src/modules/`.

## Chạy local

1. Cài Node.js >= 22.12 và MySQL trên máy.
2. Sao chép `.env.example` thành `.env`, sửa `DATABASE_URL` và `FRONTEND_ORIGIN` nếu cần.
3. Chạy `npm ci`, `npm run db:generate`, rồi `npm run dev`.

API chạy tại `http://localhost:3000`. `GET /api/health` kiểm tra server; `GET /api/health/db` kiểm tra kết nối MySQL qua Repository.

## Milestone 1 — nền tảng dữ liệu

Schema gồm tài khoản, hồ sơ xin mở cửa hàng, Merchant, sản phẩm, đơn hàng, Membership, ví điểm, tier, giao dịch điểm, voucher và xác nhận trao thưởng. `MerchantMembership` là cặp Member–Merchant duy nhất; tier `null` nghĩa là Unranked. Mỗi Membership có ví riêng. Migration đầu tiên đã được tạo trong `prisma/migrations/`.

Để dựng database mới, chạy `npx prisma migrate deploy`. Khi thay schema trong giai đoạn phát triển, tạo migration bằng `npx prisma migrate dev --name <ten_migration>`.

Để tạo Admin demo, điền `ADMIN_EMAIL` và `ADMIN_PASSWORD` (tối thiểu 12 ký tự) vào `.env`, rồi chạy `npm run db:seed`. Seed có thể chạy lại; tài khoản Admin đã tồn tại sẽ giữ nguyên mật khẩu. Mật khẩu được lưu bằng scrypt với salt ngẫu nhiên.

Chạy `npm test`, `npm run test:db` và `npm run build` để kiểm tra mã, quan hệ database và bản build. Bài test database dùng transaction rồi rollback, không để lại dữ liệu test.

`npm run build` tạo bản chạy tại `dist/`; sau đó dùng `npm start`.
