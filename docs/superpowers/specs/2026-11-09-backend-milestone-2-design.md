# Milestone 2 BE — Auth và duyệt Merchant

Dùng lại schema MySQL, seed Admin và hàm băm mật khẩu scrypt từ Milestone 1. Phạm vi gồm đăng ký, đăng nhập, phân quyền theo role, xét duyệt hồ sơ và xem cửa hàng của mình.

~~~mermaid
flowchart TD
  M["Member đăng ký"] --> MA["User MEMBER active ngay"] --> L["Login trả JWT"]
  R["Merchant đăng ký"] --> P["User inactive + hồ sơ PENDING"]
  P --> A["Admin đăng nhập và xem hồ sơ chờ"]
  A -->|Duyệt| T["Một transaction: APPROVED, tạo cửa hàng, kích hoạt User"]
  A -->|Từ chối| X["REJECTED, User vẫn inactive"]
  T --> G["Merchant đăng nhập, gọi GET /api/merchant/me"]
~~~

- Member đăng ký bằng email và password. Service tạo `User` với `role=MEMBER` và `isActive=true`.
- Merchant gửi thêm `storeName`. Repository tạo `User` với `role=MERCHANT`, `isActive=false` và hồ sơ `PENDING` bằng Prisma nested create. Pending và rejected nhận `403` khi login với mật khẩu đúng.
- Login dùng lại `verifyPassword`. Khi tài khoản active, ký JWT bằng `jose` (HS256, `sub` là User ID, hiệu lực 1 giờ, secret lấy từ `JWT_SECRET`). Các route bảo vệ đọc Bearer token, tải User hiện tại và kiểm tra `isActive` cùng role. Demo dùng một access token.
- Admin chỉ xét hồ sơ `PENDING`. Khi duyệt, Repository dùng một `prisma.$transaction` để ghi `APPROVED` cùng reviewer và thời gian xét, tạo `Merchant` active với `ownerId=applicantId` và slug `store-<applicationId>`, rồi kích hoạt User. Khi reject, ghi `REJECTED`, reviewer và thời gian xét. User vẫn inactive và chưa có cửa hàng. Reviewer lấy từ User đã xác thực. [Prisma 7 Transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- Merchant gọi `/api/merchant/me` sau khi được duyệt. Middleware kiểm tra role và tài khoản active. Repository tìm cửa hàng active theo `ownerId` lấy từ User đã xác thực.

## Hợp đồng API

| Method và path | Quyền | Body | Kết quả |
| --- | --- | --- | --- |
| `POST /api/auth/register/member` | Public | `{email,password}` | `201 {user}` |
| `POST /api/auth/register/merchant` | Public | `{email,password,storeName}` | `201 {user,application}` |
| `POST /api/auth/login` | Public | `{email,password}` | `200 {accessToken,user}` |
| `GET /api/admin/merchants/pending` | Admin | — | `200 {applications}` |
| `PATCH /api/admin/merchants/:id/approve` | Admin | — | `200 {application,merchant}` |
| `PATCH /api/admin/merchants/:id/reject` | Admin | — | `200 {application}` |
| `GET /api/merchant/me` | Merchant active | — | `200 {merchant}` |

- DTO `user` gồm `id,email,role,isActive`. DTO `application` gồm `id,applicantId,storeName,status,reviewedById,reviewedAt`. DTO `merchant` gồm `id,name,slug,isActive`.
- Validate cơ bản. Email trim + lowercase, hợp lệ theo quy tắc seed và tối đa 191 ký tự. Password đăng ký 12–128 ký tự, login 1–128 ký tự. `storeName` trim, dài 1–191 ký tự. ID hồ sơ là số nguyên dương trong range MySQL INT. Server tự gán role và trạng thái.
- Lỗi trả `{error:string}` theo kiểu hiện có. `400` cho input sai, `401` cho credential hoặc token không hợp lệ, `403` cho tài khoản chưa active hoặc thiếu quyền, `404` cho hồ sơ không tồn tại, `409` cho email trùng hoặc hồ sơ đã xử lý, `500` cho lỗi bất ngờ. Trả DTO công khai và thông báo lỗi ngắn.

## Nghiệm thu

Member đăng ký và login được. Merchant đăng ký ở `PENDING` và chưa login được. Admin xem hồ sơ chờ rồi duyệt hoặc từ chối. Merchant đã duyệt login được và xem đúng cửa hàng của mình. Member bị chặn ở route Admin và Merchant. Build và test BE đạt.

Phạm vi code dừng ở các API trong bảng. Loyalty, catalog, orders và vouchers thuộc các mốc sau.
