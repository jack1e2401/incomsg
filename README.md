# Loyalty Commerce Frontend

React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router và các component dựa trên Radix/shadcn/ui. Ứng dụng chỉ gọi API thật của `apps/backend`; không seed hay hiển thị dữ liệu mẫu.

## Chạy local

1. Cài Node.js >= 22.12 và chạy `npm install` trong `apps/frontend`.
2. Chạy backend theo `apps/backend/README.md`, với `FRONTEND_ORIGIN=http://localhost:5173`.
3. Đặt `VITE_API_BASE_URL=http://localhost:3000` trong `.env` nếu API chạy tại địa chỉ khác giá trị mặc định.
4. Chạy `npm run dev`, mở `http://localhost:5173`.

Đăng ký Member/Merchant qua UI. Merchant chỉ đăng nhập sau khi Admin duyệt hồ sơ. Admin dùng tài khoản được tạo ở backend. JWT được lưu trong `sessionStorage` của tab và gửi bằng Bearer token.

## Màn hình và API

| Vai trò | Route | Nguồn dữ liệu hiện có |
| --- | --- | --- |
| Public | `/login`, `/register`, `/application/status` | Auth và trạng thái hồ sơ |
| Admin | `/admin/applications` | Hàng chờ PENDING, approve/reject |
| Admin | `/admin`, `/admin/merchants` | Chưa có endpoint tổng quan monitoring hoặc directory Merchant |
| Merchant | `/merchant`, `/merchant/store`, `/merchant/products`, `/merchant/loyalty` | Cửa hàng của owner, sản phẩm, cấu hình loyalty |
| Merchant | `/merchant/vouchers` | CRUD mẫu voucher qua API Merchant |
| Merchant | `/merchant/rewards` | Hàng chờ quà và xác nhận trao qua API |
| Merchant | `/merchant/orders` | Chờ API danh sách đơn |
| Member | `/member` | Nhập Merchant ID vì chưa có directory công khai |
| Member | `/member/:merchantId`, `product/:productId`, `cart`, `checkout` | Sản phẩm ACTIVE, voucher giảm giá của chính Merchant và tạo đơn một sản phẩm qua API |
| Member | `/member/:merchantId/orders/:orderId` | Chỉ hiển thị response vừa tạo đơn; chưa có GET order |
| Member | `/member/:merchantId/wallet` | Số dư, lifetime points, tier và lịch sử từ API ví |
| Member | `/member/:merchantId/vouchers` | Danh mục, đổi điểm, số dư ví và voucher sở hữu từ API |
| Member | `/member/:merchantId/rewards` | Quà đã đổi và trạng thái fulfillment từ API |
| Member | `/member/:merchantId/orders` | Chờ API danh sách đơn |

Mọi route API được triển khai trong backend đều có client/UI tương ứng, ngoại trừ health check và `POST /api/orders/:orderId/pay`. UI không gọi endpoint thanh toán giả lập này để tránh hiển thị thanh toán thành công khi chưa có cổng thanh toán thật. Checkout chỉ tạo đơn `PENDING` và hiển thị giá/giảm giá từ response của backend. Đổi điểm nhận voucher và xác nhận trao quà cũng chỉ cập nhật sau khi backend trả kết quả.

Các màn hình vẫn chờ endpoint BE: danh sách Merchant công khai, dashboard/giám sát Admin, danh sách đơn Merchant, lịch sử đơn Member và truy xuất chi tiết đơn sau khi tải lại trang. UI không tạo dữ liệu thay thế cho các màn hình này.

Schema tham chiếu: `apps/backend/prisma/schema.prisma`. DTO thật của API hiện tại nằm trong `src/api/contracts/milestone2.ts` và `src/api/commerce-types.ts`; transport nằm trong `src/api/milestone2-client.ts` và `src/api/commerce-http.ts`.

## Rive tùy chọn

Đặt file `.riv` tại `public/rive/` rồi khai báo `VITE_MEMBER_RIVE_SRC=/rive/your-file.riv`. Chỉ Member tải runtime Rive. Khi thiếu asset, tải lỗi hoặc bật reduced motion, UI dùng mascot tĩnh.

## Kiểm tra

`npm run typecheck`, `npm test`, `npm run build`. Playwright M2 dùng server API stub theo hợp đồng và không cần dữ liệu mẫu trong ứng dụng.
