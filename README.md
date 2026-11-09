# Backend

Express + TypeScript + Prisma + MySQL. Mỗi module đặt controller, service, repository và routes cạnh nhau trong `src/modules/`.

## Chạy local

1. Cài Node.js >= 22.12 và MySQL trên máy.
2. Sao chép `.env.example` thành `.env`, đặt `DATABASE_URL`, `JWT_SECRET` (ít nhất 32 byte), `ADMIN_EMAIL`, `ADMIN_PASSWORD` và `FRONTEND_ORIGIN`.
3. Chạy `npm ci`, `npm run db:generate`, `npm run db:seed`, rồi `npm run dev`.

API chạy tại `http://localhost:3000`. `GET /api/health` kiểm tra server; `GET /api/health/db` kiểm tra kết nối MySQL qua Repository.

## Milestone 1 — nền tảng dữ liệu

Schema gồm tài khoản, hồ sơ xin mở cửa hàng, Merchant, sản phẩm, đơn hàng, Membership, ví điểm, tier, giao dịch điểm, voucher và xác nhận trao thưởng. `MerchantMembership` là cặp Member–Merchant duy nhất; tier `null` nghĩa là Unranked. Mỗi Membership có ví riêng. Migration đầu tiên đã được tạo trong `prisma/migrations/`.

Để dựng database mới, chạy `npx prisma migrate deploy`. Khi thay schema trong giai đoạn phát triển, tạo migration bằng `npx prisma migrate dev --name <ten_migration>`.

Để tạo Admin demo, điền `ADMIN_EMAIL` và `ADMIN_PASSWORD` (tối thiểu 12 ký tự) vào `.env`, rồi chạy `npm run db:seed`. Seed có thể chạy lại; tài khoản Admin đã tồn tại sẽ giữ nguyên mật khẩu. Mật khẩu được lưu bằng scrypt với salt ngẫu nhiên.

Chạy `npm test`, `npm run test:db` và `npm run build` để kiểm tra mã, quan hệ database và bản build. Bài test database dùng transaction rồi rollback, không để lại dữ liệu test.

`npm run build` tạo bản chạy tại `dist/`; sau đó dùng `npm start`.

## Milestone 2 — đăng ký, đăng nhập và Merchant approval

- Member đăng ký qua `POST /api/auth/register/member` và active ngay.
- Merchant đăng ký qua `POST /api/auth/register/merchant`. Tài khoản ở trạng thái chờ duyệt.
- Đăng nhập qua `POST /api/auth/login`, sau đó gửi `Authorization: Bearer <accessToken>` tới route cần đăng nhập.
- Admin xem hồ sơ chờ tại `GET /api/admin/merchants/pending`, duyệt tại `PATCH /api/admin/merchants/:id/approve` hoặc từ chối tại `PATCH /api/admin/merchants/:id/reject`.
- Merchant đã duyệt xem cửa hàng của mình tại `GET /api/merchant/me`.

Chạy `npm run test:milestone2` để kiểm tra luồng Member đăng ký/login, Merchant đăng ký chờ duyệt, Admin duyệt/từ chối, và role guard qua HTTP thật. Test dùng email ngẫu nhiên trên database local rồi dọn các bản ghi do chính test tạo.
