# Backend Milestone 2 — Auth và duyệt Merchant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chạy được luồng Member đăng ký và luồng Merchant nộp hồ sơ, được Admin duyệt rồi xem cửa hàng của mình.

**Architecture:** Controller xử lý HTTP, Service xử lý nghiệp vụ, Repository thao tác Prisma. Middleware JWT và role dùng chung cho route Admin và Merchant.

**Tech Stack:** Express 5, TypeScript ESM, Prisma 7, MySQL, Node.js >=22.12, jose, node:test + tsx.

**Spec:** [Thiết kế flow và hợp đồng API](../specs/2026-11-09-backend-milestone-2-design.md).

## Global Constraints

- Chỉ sửa `apps/backend`. Giữ schema, migration, seed Admin và hàm hash/verify của Milestone 1.
- Giữ Controller → Service → Repository. Dùng một transaction cho mỗi lần approve.
- Test luồng thành công và phân quyền cơ bản. Dùng MySQL local và lệnh `npm run test:db` hiện có.
- Chạy build/test trước mỗi commit. Dừng khi các điều kiện nghiệm thu của thiết kế đạt.

## Review Focus

- Merchant `PENDING` và `REJECTED` chưa thể đăng nhập hoặc vào cửa hàng.
- Admin mới được xét duyệt. Merchant đã duyệt chỉ nhận DTO của cửa hàng gắn với User của mình.

---

## Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| `src/modules/auth/auth.{routes,controller,service,repository,types}.ts` | Đăng ký, login, kiểu input và DTO dùng chung |
| `src/lib/access-token.ts`, `src/middleware/auth.ts` | Ký/verify JWT và kiểm tra role |
| `src/lib/http-error.ts`, `src/app.ts` | Gắn routes và ánh xạ lỗi HTTP |
| `src/modules/merchant-applications/application.{routes,controller,service,repository}.ts` | Admin xem hồ sơ chờ, duyệt/từ chối |
| `src/modules/merchant/merchant.{routes,controller,service,repository}.ts` | Merchant xem cửa hàng của mình |
| `tests/backend/integration/milestone-2.integration.test.ts` | Gọi HTTP thật, kiểm tra luồng chính |
| `package.json`, `package-lock.json`, `.env.example`, `README.md` | Dependency và hướng dẫn chạy |

## Task 1 — Đăng ký, login và role guard

**Files:** Tạo module `auth`, JWT helper, auth middleware, HTTP error helper và file test đã liệt kê. Sửa `app.ts`, `package.json`, `package-lock.json`, `.env.example`.

**Interfaces:**

- Service `registerMember(input: Credentials): Promise<UserDto>`, `registerMerchant(input: MerchantInput): Promise<{user:UserDto;application:ApplicationDto}>`, `login(input: Credentials): Promise<{accessToken:string;user:UserDto}>`. `Credentials = {email:string;password:string}`, `MerchantInput = Credentials & {storeName:string}`. DTO theo spec.
- Repository `createMember(email:string,passwordHash:string): Promise<UserDto>`, `createApplicant(email:string,passwordHash:string,storeName:string): Promise<{user:UserDto;application:ApplicationDto}>`, `findByEmail(email:string): Promise<(UserDto & {passwordHash:string})|null>`, `findUser(id:number): Promise<UserDto|null>`.
- JWT helper `signAccessToken(userId:number): Promise<string>`, `readAccessToken(token:string): Promise<number>`. Middleware `authenticate: RequestHandler` và `requireRole(role:UserDto["role"]): RequestHandler`. User đã xác thực ở `res.locals.user`.

- [ ] Thêm ca test `member registers and logs in`. Assert đăng ký `201`, role `MEMBER`, active `true`, login `200` và có token. Thêm ca `merchant applies and cannot log in yet`. Assert `201`, hồ sơ `PENDING`, User inactive và login `403`.
- [ ] Dùng `node:test`, `app.listen(0,"127.0.0.1")` và `fetch` ngay trong file test. Dùng email ngẫu nhiên, đóng server và xóa đúng fixture do bài test tạo trong teardown. Chạy `npm exec -w apps/backend -- tsx --test ../../tests/backend/integration/milestone-2.integration.test.ts` và xác nhận đỏ vì route chưa có.
- [ ] Thêm `jose` và `JWT_SECRET` vào `.env.example`. Gắn routes, validate theo spec, băm và kiểm tra password bằng utility Mốc 1. Dùng email unique trong Prisma và trả `409` khi trùng. Thêm JSON error middleware và các guard dùng cho Task 2. Đặt secret test trước khi gọi login, giữ các route health hiện tại.
- [ ] Chạy `npm test`, `npm run test:db` và `npm run build`. Tất cả phải exit 0.
- [ ] Stage file Task 1 rồi commit `feat: add member and merchant authentication`.

## Task 2 — Admin xét duyệt, Merchant xem cửa hàng

**Files:** Tạo module `merchant-applications` và `merchant`. Sửa `src/app.ts`, `tests/backend/integration/milestone-2.integration.test.ts`, `README.md`.

**Interfaces:**

- Service `listPending(): Promise<ApplicationDto[]>`, `approve(id:number,reviewerId:number): Promise<{application:ApplicationDto;merchant:MerchantDto}>`, `reject(id:number,reviewerId:number): Promise<ApplicationDto>`. Repository cung cấp cùng ba phương thức. Đọc hồ sơ theo ID, trả `404` nếu thiếu, ghi có điều kiện `status=PENDING` và trả `409` nếu đã xử lý.
- Merchant Repository `findActiveStoreByOwner(ownerId:number): Promise<MerchantDto|null>`. Service `getOwnStore(ownerId:number): Promise<MerchantDto>` trả `403` khi chưa có cửa hàng active. Controller lấy `ownerId` từ `res.locals.user.id`.

- [ ] Thêm ca `admin lists and approves a pending merchant`. Assert Member gọi Admin list và Merchant me đều `403`, gọi route bảo vệ thiếu token nhận `401`. Admin login được, list có hồ sơ `PENDING`, approve `200` và `APPROVED`. Merchant login `200` rồi me `200` với `merchant.id` đúng bằng cửa hàng vừa tạo.
- [ ] Thêm ca `admin rejects a pending merchant`. Assert reject `200`, hồ sơ `REJECTED` và Merchant login `403`. Dùng một Admin fixture với password được băm bằng utility của seed. Khi teardown, xóa cửa hàng và hồ sơ fixture trước User.
- [ ] Chạy `npm exec -w apps/backend -- tsx --test ../../tests/backend/integration/milestone-2.integration.test.ts`. Các ca đăng ký vẫn pass, ca mới đỏ vì routes chưa có.
- [ ] Gắn Admin routes sau `authenticate` và `requireRole("ADMIN")`. Approve ghi hồ sơ, tạo cửa hàng, kích hoạt User trong cùng Prisma transaction. Reject chỉ cập nhật hồ sơ. Gắn `/api/merchant/me` sau `authenticate` và `requireRole("MERCHANT")`.
- [ ] Cập nhật README với cấu hình JWT và thứ tự gọi API để thử demo bằng Admin đã seed.
- [ ] Chạy `npm test`, `npm run test:db` và `npm run build`. Tất cả phải exit 0. Dùng server local và Admin đã seed để thử nhanh Member đăng ký → Merchant đăng ký → Admin duyệt → Merchant login → Merchant me.
- [ ] Stage file Task 2 và commit `feat: review merchant applications and expose own store` khi nghiệm thu đạt.
