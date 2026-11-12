# IncomSG Loyalty Commerce — Release Readiness Audit

**Ngày audit:** 12/11/2026
**HEAD:** `feat/loyalty-exact-points` — `389159e`
**Phạm vi:** đối chiếu `audit.md` và BRS v2 với code, schema, UI, test và local runtime. Đây là audit, không sửa production code.

## Kết luận

**NO-GO cho demo backend có đăng nhập trong môi trường hiện tại.** Frontend/API khởi động được, nhưng database `incomsg` thiếu `User.isActive`; auth middleware phát Prisma `P2022`. `incomsg-test` cũng thiếu cột này dù Prisma báo không còn migration pending. Vì vậy không thể xác nhận các luồng loyalty đã ghi/đọc đúng trên DB thật.

Ở cấp source, earning exact tới 12 chữ số thập phân, ví/ledger, tier, voucher redemption và reward fulfillment đã có đường đi khá đầy đủ theo kiến trúc route → controller → service → repository. Cancel/refund/reversal và Admin moderation v2 chưa có implementation sử dụng được. Do đó codebase đang ở mức **prototype MVP có core loyalty được triển khai, nhưng chưa đạt release readiness cho BRS v2 end-to-end**.

## Readiness matrix

| Flow | Business rule hiện có trong code | API / service / DB / UI | Tests và bằng chứng | Trạng thái |
|---|---|---|---|---|
| Point Earning + fractional carry | Chỉ ghi điểm khi chuyển order PENDING → PAID. Tính trên `order.total` sau voucher; lấy tier/multiplier trước earning (VNPay dùng snapshot); lưu kết quả đến 12 chữ số, HALF_UP. | `POST /api/orders/:id/pay` cho mock và VNPay IPN cùng gọi `completePaidOrder`; `Order.earnedPointsExact` + `loyaltySnapshot`; wallet tăng trong cùng transaction; Member Order Result hiển thị số điểm backend trả về. | Unit calculation pass; integration `exact-points.integration.test.ts` có nhưng không chạy qua setup DB. UI browser chưa login được. | **UNVERIFIED** — code và unit tests có; chưa chứng minh persisted flow. |
| Wallet + Ledger | `exactBalance` là balance kinh tế; available/carry/debt là projection. Redeem không trừ net lifetime. EARN/REDEEM tạo ledger row có delta, balanceAfter, source, actor, eventRef. | `GET /api/member/merchants/:id/wallet`; `LoyaltyWallet` DECIMAL(38,12), `PointTransaction`; Member Wallet hiển thị available, carry, debt, net lifetime và transactions. | Unit balance pass và frontend display pass; DB integration bị chặn bởi schema drift. | **UNVERIFIED** |
| Tier promotion | Chọn tier theo `netLifetimeEarned`; order dùng tier trước khi cộng earning; sau đó cập nhật membership tier. Redeem giữ lifetime. | Tier threshold/multiplier theo merchant trong `LoyaltyTier`; `completePaidOrder` ghi `promotedToTier`, cập nhật membership; ví tính tier từ backend. | Unit tier selection pass; integration DB chưa xác minh. Không có reversal để kiểm tra tier giảm sau refund. | **UNVERIFIED** |
| Voucher redemption + reward fulfillment | Debit điểm và cấp voucher trong transaction; idempotency key theo member/route; discount voucher snapshot điều kiện khi phát hành. Reward chỉ chuyển AVAILABLE → FULFILLED khi Merchant xác nhận, một lần. | `/api/member/vouchers/:definitionId/redeem`; `/api/merchant/rewards` và `/:memberVoucherId/fulfill`; `RedemptionIdempotency`, `MemberVoucher`, `RewardFulfillment`; Member redeem screen và Merchant reward queue (đặt trong màn Orders). | Unit validation/snapshot/idempotency pass; integration milestone 5 có nhưng DB setup lỗi. Chưa chạy UI qua tài khoản thật. | **UNVERIFIED** |
| Cancel + refund + point reversal | BRS yêu cầu cancel PENDING không EARN, refund PAID có EARN_REVERSAL/debt và idempotency. | **Không có** cancel/refund route/controller/service/UI. `OrderStatus` chỉ có PENDING/PAID. Reversal chỉ được khai báo trong enum, không có code ghi reversal hoặc hoàn tiền. | Không thấy test thực thi cancel/refund/reversal. | **MISSING** — không demo như feature đã hoàn thành. |

**Runtime auth:** **BROKEN trong local environment hiện tại**. Đây là blocker độc lập với trạng thái implementation của năm flow.

## Vấn đề theo mức ưu tiên

### P0 — xử lý trước demo backend

1. **Database schema drift làm hỏng đăng nhập.** Cả local app DB `incomsg` và test DB `incomsg-test` báo thiếu `User.isActive`. Backend `/api/health/` và `/api/health/db` trả `ok`, nhưng các query auth đọc User lỗi `P2022`. `npm run test:db` chạy migrate báo “No pending migrations” rồi integration hooks fail ngay ở `prisma.user.create()`. Cột có trong Prisma schema và migration init, nên trạng thái migration history không phản ánh schema thực.
   - Trước demo: kiểm tra schema thật của hai DB so với migrations. Với DB demo cần giữ dữ liệu, dùng migration tiến an toàn để khôi phục schema; chỉ rebuild test DB sau khi xác nhận nó disposable. Sau đó login thử và chạy lại toàn bộ DB suite. Không đánh dấu migration thủ công để che drift.

2. **Cancel/refund/reversal chưa được implement.** Đây là P0 đối với phạm vi BRS v2 hoặc bất kỳ demo nào trình bày vòng đời hoàn tiền. Hiện không thể hủy order trước PAID, hoàn tiền sau PAID, đảo earning, tạo point debt hoặc kiểm chứng tier sau reversal. Nếu buổi demo chỉ trình bày core earning/redemption, bỏ các bước refund/cancel khỏi kịch bản và nói rõ phạm vi này chưa có.

### P1 — cần nêu rõ giới hạn, không chặn demo rút gọn

1. **Quy ước precision hiện là fixed 12 decimals + HALF_UP.** Code và unit test đã chốt cách làm tròn này. Ví dụ `1/3` được ghi thành `0.333333333333` mỗi lần; ba giao dịch thành `0.999999999999`, không phải 1. BRS còn để ngỏ cách xử lý phân số vô hạn. Demo 6.000/10.000 tạo `0.6` chính xác ở scale này; không giới thiệu hệ thống là exact vô hạn cho mọi tỷ lệ.

2. **Admin moderation v2 chưa có.** `User.isActive` được auth kiểm tra, nhưng Admin API hiện chỉ đọc dashboard/merchant và duyệt hồ sơ; chưa có suspend/ban/unban, email blacklist hay audit log. Đây là phạm vi sau core theo BRS, không demo như đã hỗ trợ.

3. **VNPay không phải nhánh local đã kiểm chứng.** Backend local được cấu hình `PAYMENT_MODE=mock`; có code tạo VNPay attempt và xác minh IPN, nhưng không chạy sandbox trong audit. Demo thanh toán hiện tại chỉ nên gọi là mock payment.

## Business flow có source implementation

Các luồng dưới đây mô tả code path, **không phải xác nhận đã chạy end-to-end**:

- **Order → mock PAID → EARN:** server đọc giá sản phẩm, chụp line item, tạo PENDING; payment cập nhật PAID và gọi loyalty calculation trong DB transaction.
- **VNPay:** tạo attempt/reserve capacity và snapshot policy; IPN kiểm tra chữ ký, merchant code, amount, trạng thái; callback hợp lệ mới chuyển PAID và earn. Return URL chỉ đưa Member về trang order.
- **Wallet/tier:** balance và net lifetime dùng Decimal; tier được chọn từ net lifetime; ledger ghi event EARN/REDEEM; API wallet trả projection cho Member UI.
- **Discount/reward redemption:** transaction debit balance, tạo MemberVoucher với snapshot, ghi ledger và idempotency record; reward fulfillment là thao tác riêng của Merchant.
- **Chưa có:** cancel pending, refund xác nhận, earning reversal/debt recovery từ refund, reward cancellation/refund điểm, Admin moderation v2.

## Kịch bản demo an toàn sau khi sửa DB

Chỉ chạy sau khi login và `npm run test:db` qua trên schema đã được đối chiếu. Dùng tài khoản/cửa hàng/sản phẩm demo đã được chủ repo chuẩn bị qua flow thông thường; không dùng mock adapter để thay bằng chứng DB.

1. Admin đăng nhập và duyệt Merchant PENDING (nếu cần).
2. Merchant cấu hình rate 10.000 VND/point và tier; dùng sản phẩm hợp lệ để tạo order có tổng 6.000 VND.
3. Member thanh toán mock: kỳ vọng EARN `0.6`, carry `0.6`.
4. Member tạo order thứ hai 6.000 VND và thanh toán mock: kỳ vọng available `1`, carry `0.2`, ledger có hai EARN và tier/lifetime lấy từ backend.
5. Member đổi Discount Voucher giá 1 điểm: kỳ vọng balance kinh tế `0.2`, ledger REDEEM, lifetime không đổi.
6. Member đổi Reward Voucher; Merchant mở reward queue trong màn Orders và xác nhận đã trao; kiểm tra trạng thái FULFILLED.

Không demo cancel/refund/debt hoặc VNPay sandbox ở trạng thái hiện tại. Những kết quả trên là expected outcomes từ BRS và code, chưa được xác minh persisted cho đến khi DB suite/browser flow chạy thành công.

## Validation thực tế ngày audit

| Check | Kết quả thực tế |
|---|---|
| `npm test` | PASS: frontend 4 files / 28 tests; backend 37 tests. Đây là unit tests, không chứng minh DB integration. |
| `npm run typecheck` | PASS: cả hai workspace, exit code 0. |
| `npm run test:db` | FAIL / không hoàn tất: `migrate deploy` báo không pending migrations; integration hooks lỗi `The column isActive does not exist in the current database.`; process bị dừng sau khi suite mắc ở setup/cleanup. Không có DB flow nào được đánh dấu PASS. |
| Orca Browser | Sau khi bật Vite/API bằng script repo, login page tại `localhost:5173/login` render được; console không có JS error. Chưa đăng nhập/chưa chạy commerce flow; tab cũ trước khi bật server gặp connection refused. |
| API health | `/api/health/` và `/api/health/db` trả `status: ok`; health chỉ xác nhận kết nối DB, không xác nhận schema tương thích. |

## Những phần chỉ mới thiết kế / chưa thể demo

- Cancel/refund, EARN_REVERSAL, point debt phát sinh từ refund và tier demotion.
- Refund status/provider confirmation cho VNPay; không có refund endpoint.
- Suspend/ban/unban, blacklist email, audit log và merchant abuse report.
- Reward cancellation có hoàn điểm; policy này cũng chưa chốt trong BRS.
- Partial refund, fraud scoring, device fingerprinting, point expiry/transfer là ngoài phạm vi demo gần hạn.

## Rủi ro còn lại

- Auth không dùng được trên DB hiện tại; đây là rủi ro chặn demo cao nhất.
- Chưa xác minh transaction isolation, persisted wallet/ledger reconcile, idempotency/concurrency và merchant isolation trên DB sạch.
- Scale 12 chữ số làm tròn từng event có sai số tích lũy rất nhỏ với tỷ lệ phân số lặp.
- Hai màn hình backend lớn (`BackendMemberPages.tsx` ~1.158 dòng, `BackendMerchantPages.tsx` ~988 dòng); maintainability debt, không ưu tiên sửa trước buổi demo.

## Source map

- Earning formula + exact scale: [`loyalty.calculation.ts`](../../apps/backend/src/modules/loyalty/loyalty.calculation.ts), [`loyalty.earning.ts`](../../apps/backend/src/modules/loyalty/loyalty.earning.ts).
- Order create/pay and lifecycle routes: [`orders.service.ts`](../../apps/backend/src/modules/orders/orders.service.ts), [`orders.repository.ts`](../../apps/backend/src/modules/orders/orders.repository.ts), [`orders.routes.ts`](../../apps/backend/src/modules/orders/orders.routes.ts).
- VNPay attempt/IPN: [`payments.service.ts`](../../apps/backend/src/modules/payments/payments.service.ts), [`payments.repository.ts`](../../apps/backend/src/modules/payments/payments.repository.ts).
- Wallet projection/tier read: [`loyalty.balance.ts`](../../apps/backend/src/modules/loyalty/loyalty.balance.ts), [`loyalty.read.ts`](../../apps/backend/src/modules/loyalty/loyalty.read.ts), [`schema.prisma`](../../apps/backend/prisma/schema.prisma).
- Redemption and reward fulfillment: [`vouchers.routes.ts`](../../apps/backend/src/modules/vouchers/vouchers.routes.ts), [`vouchers.service.ts`](../../apps/backend/src/modules/vouchers/vouchers.service.ts), [`vouchers.repository.ts`](../../apps/backend/src/modules/vouchers/vouchers.repository.ts).
- Member/merchant views and backend-vs-mock routing: [`BackendMemberPages.tsx`](../../apps/frontend/src/features/member/BackendMemberPages.tsx), [`BackendMerchantPages.tsx`](../../apps/frontend/src/features/merchant/BackendMerchantPages.tsx), [`App.tsx`](../../apps/frontend/src/app/App.tsx).
- Tests: [`tests/backend`](../../tests/backend), [`tests/frontend`](../../tests/frontend).
