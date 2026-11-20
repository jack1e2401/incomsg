# Backend theo nhóm nghiệp vụ

Phương án đã thống nhất trong chat ngày 20/11/2026 là giữ modular monolith và gom các module theo nghiệp vụ. Giữ nguyên URL, middleware phân quyền, DTO, Prisma schema và quy tắc tính điểm. Tiếp tục thao tác trên worktree hiện tại theo AGENTS.md.

## Milestone 1 — Nhóm module và cập nhật nơi sử dụng

- [ ] Chuyển `customers` và `analytics` vào `reporting/`, kiểm tra route và import.
- [ ] Đặt `program`, `vouchers`, `challenges` dưới `loyalty/`; `products`, `inventory`, `orders`, `payments`, `refunds` dưới `commerce/`; `profile`, `applications`, `storefront`, `events` dưới `merchants/`; `admin`, `abuse-reports` dưới `governance/`; `auth`, `health`, `media` dưới `platform/`.
- [ ] Cập nhật import trong source, seed và test; cập nhật đường dẫn trong tài liệu backend đang dùng.
- [ ] Chạy unit test, typecheck và kiểm tra danh sách route. Commit riêng cho việc di chuyển.

## Milestone 2 — Điều phối giao dịch

- [ ] Tách phần ghi điểm từ `completePaidOrder` thành thao tác nhận transaction trong `loyalty/program`. Đặt điều phối trong `commerce/orders` và gọi từ các điểm vào thanh toán hiện tại.
- [ ] Đặt `completeMockRefund` trong `commerce/refunds` và chuyển tính, ghi điểm đảo, cập nhật hạng về `loyalty/program`.
- [ ] Đặt thao tác dùng và khôi phục voucher tại `loyalty/vouchers`, dùng transaction do luồng đơn hàng hoặc hoàn tiền truyền vào. Dời helper retry Prisma dùng chung sang `lib`, giữ nguyên mã lỗi, số lần retry và mức cô lập giao dịch.
- [ ] Đối chiếu thứ tự ghi, điều kiện cập nhật, phạm vi merchant/member và replay. Chạy unit test, typecheck, build và bộ MySQL trên database local dành cho test. Các ca chính nằm trong `exact-points.integration.test.ts`, `milestone-3-4-lifecycle-refund.integration.test.ts` và `v4-challenges-and-refunds.integration.test.ts`. Commit riêng cho phần điều phối.
