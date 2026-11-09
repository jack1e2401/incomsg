# Backend

Express + TypeScript + Prisma + MySQL. Mỗi module đặt controller, service, repository và routes cạnh nhau trong `src/modules/`.

## Chạy local

1. Cài Node.js >= 22.12 và MySQL trên máy.
2. Sao chép `.env.example` thành `.env`, sửa `DATABASE_URL` và `FRONTEND_ORIGIN` nếu cần.
3. Chạy `npm install`, `npm run db:generate`, rồi `npm run dev`.

API chạy tại `http://localhost:3000`. `GET /api/health` kiểm tra server; `GET /api/health/db` kiểm tra kết nối MySQL qua Repository. Schema hiện chưa có model nghiệp vụ nên chưa cần migration. Khi thêm model, chạy `npm run db:migrate -- --name <ten_migration>`.

`npm run build` tạo bản chạy tại `dist/`; sau đó dùng `npm start`.
