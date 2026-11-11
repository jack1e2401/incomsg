# FE + Integration + Smoke Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kết nối giao diện Admin/Merchant/Member với API M2–M6, rồi chứng minh luồng mua hàng, tích điểm, đổi voucher và thanh toán Sandbox bằng smoke test.

**Architecture:** Giữ `DemoRoutes` và mock adapter cho bản trình diễn offline. Trong `VITE_API_MODE=http`, mở các route cùng giao diện nhưng dùng một HTTP adapter có kiểu và JWT từ `AuthSessionProvider`; các mutation lấy lại trạng thái từ server. Chỉ hiển thị chức năng có endpoint thật và kiểm tra role/owner ở backend.

**Tech Stack:** React 19, TypeScript, Vite 8, React Router, Vitest, Playwright; Express/Prisma/MySQL phía backend.

**Spec:** BR.md tại `C:/Users/ACER/Downloads/BR.md`; [Frontend plan hiện có](./2026-11-09-loyalty-commerce-frontend.md), [M3](./2026-11-09-backend-milestone-3.md), [M4](./2026-11-09-backend-milestone-4-loyalty.md), [M5](./2026-11-09-backend-milestone-5-vouchers.md), [M6](./2026-11-09-backend-milestone-6-vnpay-sandbox.md).

## Global Constraints

- Bắt đầu sau M3–M6 và migration chạy được; không bật HTTP commerce trước khi API có thật.
- API M3 chỉ hỗ trợ một sản phẩm/đơn, quantity 1–99. HTTP checkout chỉ Buy Now một dòng; không gửi `merchantId`, giá, tổng hay nhiều items như mock `CheckoutInput` hiện có.
- Backend trả ID dạng number và tiền VND dạng string; frontend `src/api/types.ts` hiện dùng ID string, tiền number và một số trường chỉ có trong mock (`stock`, `category`, `tagline`). Tạo mapping tường minh hoặc sửa model UI, không ép kiểu ngầm.
- Chỉ API trả về PAID, wallet/tier, voucher USED/FULFILLED mới kích hoạt thông báo thành công/Rive. Không để client tự tính hoặc xác nhận.
- Ước lượng 40–80 phút giả định API và DTO đã ổn định; nếu còn thiếu read endpoints hoặc sửa màn giỏ hàng/checkout, tính thêm thời gian.

## Review Focus

1. HTTP mode không rơi về mock data khi một endpoint lỗi; hiển thị lỗi và retry.
2. Đổi Merchant xóa dữ liệu ví/voucher/order trước khi tải Merchant mới.
3. Refresh ở Return URL khi IPN chưa tới vẫn PENDING; sau IPN đọc lại thành PAID.
4. Double click redeem/pay không phát hai yêu cầu từ UI; backend vẫn chặn request song song.
5. Reward AVAILABLE hiển thị “chờ trao”, chỉ FULFILLED sau Merchant xác nhận.

---

## File map

| File | Trách nhiệm |
| --- | --- |
| `apps/frontend/src/api/contracts/commerce.ts` | DTO/path M3–M6, lỗi server và status payment |
| `apps/frontend/src/api/commerce-client.ts`, `commerce-client.test.ts` | Fetch JWT, mapping money/ID/tier/voucher, test contract |
| `apps/frontend/src/api/client.tsx`, `types.ts`, `auth-session.tsx` | Chọn adapter theo mode và cung cấp token; tách mock/http rõ ràng |
| `apps/frontend/src/app/App.tsx`, `layouts/*`, `features/{admin,merchant,member}/*` | Route role, merchant context, màn giao dịch và return/result |
| `tests/frontend/e2e/commerce-http.spec.ts`, `docs/frontend/README.md` | Smoke UI có stub và hướng dẫn chạy end-to-end thật |
| `apps/backend/src/modules/*` | Chỉ bổ sung read endpoints tối thiểu nêu trong Task 1 nếu các milestone BE chưa cung cấp |

### Task 1 — Chốt contract đọc trước khi nối màn

**Interfaces:** Ngoài endpoint M2–M6, UI cần `GET /api/merchants` (danh sách active), `GET /api/member/orders?merchantId=...` (đơn chính Member), `GET /api/member/orders/:id` (chính Member), `GET /api/merchant/orders` (đơn Merchant active). Cả ba order DTO dùng snapshot M3, thêm `earnedPoints` từ ledger nếu PAID. Nếu M3/M4 đã cung cấp tương đương, dùng lại path hiện có thay vì thêm route.

- [ ] Kiểm kê route thật sau M6 và lập bảng path→DTO trong `contracts/commerce.ts`; đánh dấu chính xác bốn read needs ở trên. Viết integration test BE cho owner/merchant scope và trạng thái PENDING/PAID; xác nhận đỏ nếu route thiếu.
- [ ] Thêm đúng read endpoints còn thiếu theo Controller → Service → Repository, không thêm dashboard stats hoặc trường mock để chiều UI. Chạy `npm run test:db`, `npm run build` ở BE; mong đợi exit 0. Commit `feat: expose commerce read models for frontend` nếu có thay đổi BE.

### Task 2 — HTTP adapter và route theo role

**Interfaces:** `createCommerceClient(baseUrl: string, getToken: () => string | null, fetcher = fetch): CommerceApi`; giữ `createMockApi` cho demo. Adapter chuyển ID number↔string ở biên, tiền Decimal string→number chỉ sau khi kiểm tra trong `Number.MAX_SAFE_INTEGER`, tier null→Unranked, reward AVAILABLE→PENDING_FULFILLMENT ở view model. HTTP error `{error}` giữ mã để UI hiển thị.

- [ ] Viết Vitest cho catalog, order một dòng, wallet Merchant A/B, redeemed voucher và lỗi 401/403/409; xác nhận test đỏ. Kiểm tra không có method HTTP nào gọi mock.
- [ ] Cài HTTP adapter dùng bearer token hiện có; route `/admin`, `/merchant/:merchantId`, `/member/:merchantId` trong HTTP mode dùng guard M2 và context Merchant thật. Merchant chỉ vào ID cửa hàng của mình; Member chỉ thấy Merchant active. Những trường không có ở BE dùng UI fallback hiển thị, không bịa dữ liệu.
- [ ] Chạy `npm test`, `npm run typecheck`, `npm run build` ở FE; mong đợi exit 0. Commit `feat(frontend): connect role routes to commerce api`.

### Task 3 — Checkout, loyalty và voucher trên dữ liệu thật

**Interfaces:** HTTP checkout tạo `{productId:number,quantity:number,voucherId?:number}`; `POST /api/orders/:id/pay` chỉ khi BE `PAYMENT_MODE=mock`; `POST /api/orders/:id/payments/vnpay` khi sandbox, nhận `paymentUrl` rồi điều hướng. Result page poll `GET /api/orders/:id/payment-status` tới trạng thái terminal hoặc timeout UI, sau đó refetch order/wallet/vouchers. Không coi return query là bằng chứng thanh toán.

- [ ] Viết Playwright HTTP mode với stub contract: Buy Now tạo PENDING, pay mock thành PAID rồi ví cập nhật; redeem giảm điểm và cấp voucher; discount áp dụng đúng Merchant; reward chờ trao rồi Merchant fulfillment; lỗi thiếu điểm/foreign voucher hiển thị được. Chạy suite, xác nhận đỏ.
- [ ] Sửa MemberShop/MemberLoyalty/MerchantPages: trong HTTP mode giới hạn giỏ một dòng hoặc đưa thẳng Buy Now; chỉ hiển thị sản phẩm/tier/config/voucher/order thật. Disable nút khi request đang chạy; sau mutation refetch thay vì cộng/trừ local. Reward không hiện đã nhận trước `FULFILLED`.
- [ ] Thêm màn redirect/result VNPay: khi quay lại chỉ hiển thị đang xác minh cho đến khi status API PAID; lỗi/cancel giữ PENDING và hướng dẫn tạo đơn mới theo M6. Đối với zero total, dùng response PAID nội bộ. Không phát Rive success trước response PAID.
- [ ] Chạy `npm run test:e2e:m2`, suite HTTP commerce, `npm run typecheck`, `npm run build`; mong đợi exit 0. Commit `feat(frontend): complete checkout and loyalty integration`.

### Task 4 — Smoke test thật và bàn giao

- [ ] Khởi động MySQL/BE/FE, apply migrations/seed; chạy `npm test`, `npm run test:db`, `npm run build` ở BE và `npm test`, `npm run typecheck`, `npm run build`, HTTP Playwright ở FE. Ghi lệnh/kết quả vào README hoặc `docs/smoke-test.md`.
- [ ] Dùng hai Merchant A/B và Member mới: Admin duyệt A/B; Merchant A tạo sản phẩm, config tier, Discount và Reward; Member ở A Unranked→mua đơn đầu→Bronze; B vẫn Unranked; redeem ở A, discount trên đơn A, thanh toán, voucher USED và điểm chỉ cộng một lần; Reward ở A chờ trao→Merchant A xác nhận FULFILLED. Thử thiếu điểm, dùng voucher A ở B, pay/redeem lặp và hai redeem song song.
- [ ] Với credential/URL IPN public: mở thanh toán Sandbox, thực hiện một giao dịch thành công; quan sát IPN, order PAID, wallet EARN một lần và voucher USED. Thử thất bại/cancel: order vẫn PENDING. Nếu không có credential/URL, chạy signed-IPN integration test M6 và ghi rõ smoke sandbox ngoài hệ thống chưa hoàn thành.
- [ ] Kiểm tra màn Member ở viewport mobile và Merchant/Admin desktop, refresh trực tiếp result route, lỗi API và chuyển Merchant. Cập nhật `docs/frontend/README.md` về mode mock/http, config VNPay, read endpoints và giới hạn một item. `git diff --check`; commit `docs: record integrated smoke test` nếu có thay đổi.

**Exit gate:** FE HTTP không dùng mock, smoke qua A/B và trạng thái thanh toán nhất quán; kết quả Sandbox thật được ghi riêng với test IPN giả lập.
