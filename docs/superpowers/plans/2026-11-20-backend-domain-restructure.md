# Backend theo nhóm nghiệp vụ

Phương án đã thống nhất trong chat ngày 20/11/2026 là giữ modular monolith và gom các module theo nghiệp vụ. Giữ nguyên URL, middleware phân quyền, DTO, Prisma schema và quy tắc tính điểm. Tiếp tục thao tác trên worktree hiện tại theo AGENTS.md.

## Milestone 1 — Nhóm module và cập nhật nơi sử dụng

- [x] Chuyển `customers` và `analytics` vào `reporting/`, kiểm tra route và import.
- [x] Đặt `program`, `vouchers`, `challenges` dưới `loyalty/`, và `products`, `inventory`, `orders`, `payments`, `refunds` dưới `commerce/`. Gom `profile`, `applications`, `storefront`, `events` vào `merchants/`, `admin` và `abuse-reports` vào `governance/`, `auth`, `health` và `media` vào `platform/`.
- [x] Cập nhật import trong source, seed và test, cùng các đường dẫn trong tài liệu backend đang dùng.
- [x] Chạy unit test backend, typecheck và kiểm tra danh sách route. Milestone di chuyển nằm ở commit `15f240f`.

## Milestone 2 — Điều phối giao dịch

- [x] Tách phần ghi điểm từ `completePaidOrder` thành thao tác nhận transaction trong `loyalty/program`. Đặt điều phối trong `commerce/orders` và gọi từ các điểm vào thanh toán hiện tại.
- [x] Đặt `completeMockRefund` trong `commerce/refunds` và chuyển tính, ghi điểm đảo, cập nhật hạng về `loyalty/program`.
- [x] Đặt thao tác dùng và khôi phục voucher tại `loyalty/vouchers`, dùng transaction do luồng đơn hàng hoặc hoàn tiền truyền vào. Dời helper retry Prisma và unit test tương ứng sang `lib`, giữ mã lỗi, số lần retry và mức cô lập giao dịch.
- [x] Đối chiếu thứ tự ghi, điều kiện cập nhật, phạm vi merchant/member và replay. `npm run test:backend` qua 81 ca, `npm run test:db` qua 133 ca trên MySQL local riêng, `npm run typecheck` và `npm run build` thành công.

`npm test` còn lỗi frontend. Lần chạy lại với hai worker qua 205/219 ca, với 14 ca lỗi ở nhóm trải nghiệm merchant, catalog, wizard sản phẩm và báo cáo vi phạm.
