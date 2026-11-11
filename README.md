# IncomSG Loyalty Commerce

Prototype thương mại và loyalty cho nhiều cửa hàng. Frontend React/Vite ở [apps/frontend](apps/frontend), API Express và Prisma ở [apps/backend](apps/backend).

## Chạy local

Dùng Node.js 22.12 trở lên. Từ thư mục `IncomSG`, chạy `npm ci` để cài dependencies cho cả hai app. Tạo `apps/frontend/.env` và `apps/backend/.env` theo file `.env.example` tương ứng. Chuẩn bị MySQL theo [hướng dẫn backend](docs/backend/README.md).

```sh
npm ci
npm run dev:backend
# Mở terminal thứ hai tại IncomSG
npm run dev:frontend
```

Frontend mặc định ở `http://localhost:5173`, API ở `http://localhost:3000`. Xem [hướng dẫn frontend](docs/frontend/README.md) để chọn chế độ demo hoặc VNPay Sandbox.

## Kiểm thử

| Lệnh tại thư mục gốc | Bộ test |
| --- | --- |
| `npm test` | Unit test FE và BE |
| `npm run test:frontend` | Vitest tại `tests/frontend/unit` |
| `npm run test:backend` | Node test tại `tests/backend/unit` |
| `npm run test:db` | Integration test tại `tests/backend/integration`, cần MySQL đã áp migration |
| `npm run test:e2e` | Playwright tại `tests/frontend/e2e`, tự khởi động Vite |

Cài Chromium cho Playwright bằng `npx playwright install chromium`. Chạy các bộ riêng với `npm run test:e2e:demo -w apps/frontend` hoặc thay `demo` bằng `m2`, `commerce`, `vnpay`, `ux`. Các ca gọi HTTP thật cần API local và dữ liệu seed tương ứng.

`npm run typecheck` và `npm run build` chạy cho cả hai app. [AGENTS.md](AGENTS.md) chứa quy ước làm việc. [docs/superpowers](docs/superpowers) chứa các plan và spec của dự án.
