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
| Admin | `/admin`, `/admin/merchants` | Tổng quan/danh sách chờ endpoint monitoring và directory |
| Merchant | `/merchant`, `/merchant/store`, `/merchant/products`, `/merchant/loyalty` | Cửa hàng của owner, sản phẩm, cấu hình loyalty |
| Merchant | `/merchant/vouchers` | CRUD mẫu voucher qua API Merchant |
| Merchant | `/merchant/orders`, `/merchant/rewards` | Chờ API danh sách đơn và xác nhận trao thưởng |
| Member | `/member` | Nhập Merchant ID vì chưa có directory công khai |
| Member | `/member/:merchantId`, `product/:productId`, `cart`, `checkout` | Sản phẩm ACTIVE và tạo đơn một sản phẩm qua API |
| Member | `/member/:merchantId/orders/:orderId` | Chỉ hiển thị response vừa tạo đơn; chưa có GET order |
| Member | `/member/:merchantId/wallet` | Số dư, lifetime points, tier và lịch sử từ API ví |
| Member | `/member/:merchantId/vouchers` | Danh mục và voucher sở hữu từ API; đổi điểm chờ endpoint redeem |
| Member | `/member/:merchantId/rewards` | Quà sở hữu từ API; fulfillment chờ endpoint Merchant |
| Member | `/member/:merchantId/orders` | Chờ API danh sách đơn |

Checkout chỉ gọi `POST /api/orders` và dùng đúng response `PENDING`. UI không gọi endpoint `/pay` giả lập của backend. Trạng thái điểm, tier và voucher đọc từ API; FE chưa giả định việc đổi điểm hoặc xác nhận trao thưởng khi endpoint tương ứng chưa có.

Schema tham chiếu: `apps/backend/prisma/schema.prisma`. DTO thật của API hiện tại nằm trong `src/api/contracts/milestone2.ts` và `src/api/commerce-types.ts`; transport nằm trong `src/api/milestone2-client.ts` và `src/api/commerce-http.ts`.

## Rive tùy chọn

Đặt file `.riv` tại `public/rive/` rồi khai báo `VITE_MEMBER_RIVE_SRC=/rive/your-file.riv`. Chỉ Member tải runtime Rive. Khi thiếu asset, tải lỗi hoặc bật reduced motion, UI dùng mascot tĩnh.

## Kiểm tra

`npm run typecheck`, `npm test`, `npm run build`. Playwright M2 dùng server API stub theo hợp đồng và không cần dữ liệu mẫu trong ứng dụng.
