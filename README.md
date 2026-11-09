# Frontend

React 19 + TypeScript + Vite 8, React Router và Tailwind CSS v4. UI dùng các component theo mẫu shadcn/ui, chia theo `app/`, `api/`, `layouts/` và `features/`.

## Chạy local

1. Cài Node.js >= 22.12.
2. Chạy `npm install` và `npm run dev`.
3. Mở `http://localhost:5173`.

## Kết nối Backend Milestone 2

1. Chạy Backend theo hướng dẫn trong `apps/backend/README.md`, cấu hình `FRONTEND_ORIGIN=http://localhost:5173`, database và JWT secret.
2. Sao chép `.env.example` thành `.env` (hoặc khai báo hai biến tương ứng trong shell):
   - `VITE_API_MODE=http`
   - `VITE_API_BASE_URL=http://localhost:3000`
3. Khởi động lại Vite, rồi mở `http://localhost:5173`. Dùng Member/Merchant signup hoặc đăng nhập bằng tài khoản Admin đã seed ở BE.

Trong HTTP mode, router chỉ hiển thị các màn M2 nối API thật. Màn commerce demo không thể truy cập ở mode này. Để dùng giao diện demo hiện tại, đặt `VITE_API_MODE=mock` hoặc bỏ biến mode.

## Demo

Ứng dụng hiện chạy bằng mock API (`src/api/mock.ts`) và hiển thị nhãn Demo/Mock API. Checkout tạo đơn `PENDING`; frontend không tự xác nhận thanh toán hoặc phát điểm. Điểm, tier và trạng thái đổi quà hiển thị theo response từ adapter mock.

Backend Milestone 2 hiện chỉ có đăng ký Member/Merchant, login JWT, Admin duyệt hồ sơ và Merchant lấy cửa hàng của mình. DTO và các path đó được khai báo riêng tại `src/api/contracts/milestone2.ts`; `src/api/milestone2-client.ts` cung cấp HTTP client có kiểu cho đúng các endpoint này và giữ nguyên thông báo lỗi `{error}` từ BE. HTTP mode có login/register thật, lưu session theo tab, điều hướng và guard theo role backend.

Các luồng catalog, checkout, wallet, loyalty, voucher và fulfillment vẫn dùng mock cho tới khi endpoint backend tương ứng được triển khai. Không bật HTTP mode cho toàn bộ `CommerceApi` trong Milestone 2 vì API chưa cung cấp các phần này. Khi tích hợp auth, cần dùng token theo Bearer và backend vẫn là nơi chặn tài khoản chưa active/role sai.

### Route chính (demo mode)

- `/admin` — tổng quan, duyệt Merchant, danh sách cửa hàng.
- `/merchant/moc` — quản trị cửa hàng, sản phẩm, đơn hàng, loyalty, voucher và trao quà.
- `/member/moc` — storefront, giỏ hàng, checkout, ví, voucher, reward và đơn hàng.

Member có thể chọn Merchant ở thanh đầu trang. Ví, tier và voucher được phân tách theo Merchant.

### Rive (tùy chọn)

Đặt file `.riv` đã tải và kiểm tra trong `public/rive/`, rồi khai báo `VITE_MEMBER_RIVE_SRC=/rive/your-file.riv` trong `.env`. Nếu không cấu hình, tải lỗi hoặc thiết bị bật reduced motion, giao diện dùng mascot tĩnh. Runtime Rive được lazy-load và chỉ dùng trong khu vực Member.

## Kiểm tra

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run format:check`
- `npm run test:e2e` — Playwright demo suite (cần Chromium; `npx playwright install chromium` nếu máy chưa có)
- `npm run test:e2e:m2` — Playwright HTTP-mode suite, stub API contract responses

Thiết kế đầy đủ M2 theo màn hình và endpoint nằm tại [docs/milestone-2-interface-plan.md](docs/milestone-2-interface-plan.md).

`npm run build` tạo bản production trong `dist/`.
