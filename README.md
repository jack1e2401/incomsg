# Loyalty Commerce Frontend

React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router và các component dựa trên Radix/shadcn/ui. `VITE_API_MODE=mock` mở DemoRoutes với dữ liệu mẫu offline; `VITE_API_MODE=http` mở route có đăng nhập và chỉ dùng API backend, không rơi về dữ liệu mock khi API lỗi.

## Chạy local

1. Cài Node.js >= 22.12 và chạy `npm install` trong `apps/frontend`.
2. Chạy backend theo `apps/backend/README.md`, với `FRONTEND_ORIGIN=http://localhost:5173`.
3. Đặt `VITE_API_BASE_URL=http://localhost:3000` trong `.env` nếu API chạy tại địa chỉ khác giá trị mặc định. Chọn `VITE_API_MODE=mock` để chạy demo offline hoặc `VITE_API_MODE=http` để gọi backend. Ở HTTP mode, chọn `VITE_PAYMENT_MODE=mock` để gọi thanh toán mô phỏng backend hoặc `VITE_PAYMENT_MODE=vnpay` để chuyển qua VNPay Sandbox.
4. Chạy `npm run dev`, mở `http://localhost:5173`.

Đăng ký Member/Merchant qua UI. Merchant chỉ đăng nhập sau khi Admin duyệt hồ sơ. Admin dùng tài khoản được tạo ở backend. JWT được lưu trong `sessionStorage` của tab và gửi bằng Bearer token.

## Màn hình và API

| Vai trò  | Route                                                                     | Nguồn dữ liệu hiện có                                                                 |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Public   | `/login`, `/register`, `/application/status`                              | Auth và trạng thái hồ sơ                                                              |
| Admin    | `/admin/applications`                                                     | Hàng chờ PENDING, approve/reject                                                      |
| Admin    | `/admin`, `/admin/merchants`                                              | Dashboard và directory có dữ liệu từ `/api/admin/dashboard`, `/api/admin/merchants`   |
| Merchant | `/merchant`, `/merchant/store`, `/merchant/products`, `/merchant/loyalty` | Cửa hàng của owner, sản phẩm, cấu hình loyalty                                        |
| Merchant | `/merchant/vouchers`                                                      | CRUD mẫu voucher qua API Merchant                                                     |
| Merchant | `/merchant/rewards`                                                       | Hàng chờ quà và xác nhận trao qua API                                                 |
| Merchant | `/merchant/orders`                                                        | Danh sách đơn của cửa hàng và điểm đã cấp từ API                                      |
| Member   | `/member`                                                                 | Directory Merchant công khai từ API                                                   |
| Member   | `/member/:merchantId`, `product/:productId`, `cart`, `checkout`           | Sản phẩm ACTIVE, voucher giảm giá của chính Merchant và tạo đơn một sản phẩm qua API  |
| Member   | `/member/:merchantId/orders/:orderId`                                     | Tải đơn theo ID, thanh toán mock hoặc chuyển VNPay, poll trạng thái từ API sau return |
| Member   | `/member/:merchantId/wallet`                                              | Số dư, lifetime points, tier và lịch sử từ API ví                                     |
| Member   | `/member/:merchantId/vouchers`                                            | Danh mục, đổi điểm, số dư ví và voucher sở hữu từ API                                 |
| Member   | `/member/:merchantId/rewards`                                             | Quà đã đổi và trạng thái fulfillment từ API                                           |
| Member   | `/member/:merchantId/orders`                                              | Danh sách đơn của Member tại Merchant hiện tại                                        |

Checkout chỉ tạo đơn `PENDING` và hiển thị giá/giảm giá từ response backend. Ở `VITE_PAYMENT_MODE=mock`, nút thanh toán gọi `POST /api/orders/:orderId/pay`; ở mode `vnpay`, FE gọi endpoint khởi tạo Sandbox rồi chuyển hướng. Return URL luôn tải lại order/payment status; chỉ response API `PAID` mới hiện trạng thái thành công. Đổi điểm và xác nhận trao quà chỉ cập nhật sau response backend.

Voucher discount `reserved` bởi đơn PENDING không thể chọn ở checkout; UI giải thích rằng đơn đang giữ voucher. Reward ở trạng thái AVAILABLE được hiển thị “Chờ cửa hàng trao” cho đến khi Merchant xác nhận fulfillment.

Schema tham chiếu: `apps/backend/prisma/schema.prisma`. DTO thật của API hiện tại nằm trong `src/api/contracts/milestone2.ts` và `src/api/commerce-types.ts`; transport nằm trong `src/api/milestone2-client.ts` và `src/api/commerce-http.ts`.

## Rive tùy chọn

Đặt file `.riv` tại `public/rive/` rồi khai báo `VITE_MEMBER_RIVE_SRC=/rive/your-file.riv`. Chỉ Member tải runtime Rive. Khi thiếu asset, tải lỗi hoặc bật reduced motion, UI dùng mascot tĩnh.

## Kiểm tra

`npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e:m2`, `npm run test:e2e:commerce`, `npm run test:e2e:vnpay`, `npm run test:e2e:demo`. Playwright dùng API stub để kiểm tra checkout, voucher/reward và VNPay CREATED→PAID, FAILED/retry, 30 lần polling timeout và resume bằng “Kiểm tra lại”.
