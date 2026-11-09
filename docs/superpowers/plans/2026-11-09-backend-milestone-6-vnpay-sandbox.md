# Backend Milestone 6 — VNPay Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member thanh toán đơn PENDING qua VNPay Sandbox; chỉ IPN hợp lệ xác nhận PAID và kích hoạt điểm/voucher đúng một lần.

**Architecture:** Tạo URL thanh toán có HMAC trên server và lưu một PaymentAttempt cho Order. Return URL chỉ đưa Member về màn kết quả; IPN xác minh chữ ký, merchant code, mã giao dịch, số tiền và trạng thái rồi gọi `completePaidOrder` của M4 trong DB transaction. Chế độ `mock` giữ route pay giả lập để demo local; chế độ `vnpay` chặn route đó.

**Tech Stack:** Express 5, TypeScript ESM, Node `crypto`, Prisma 7, MySQL, `node:test` + `tsx`.

**Spec:** Yêu cầu M6 của user mở rộng BR.md tại `C:/Users/ACER/Downloads/BR.md`; [M4 plan](./2026-11-09-backend-milestone-4-loyalty.md), [M5 plan](./2026-11-09-backend-milestone-5-vouchers.md), [VNPay PAY v2.1.0](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).

## Global Constraints

- Chỉ Sandbox. Không hardcode hoặc commit `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`. Không triển khai refund/production settlement; IPN cần URL công khai mà VNPay gọi được.
- `vnp_Amount` là VND × 100, giới hạn 12 chữ số theo đặc tả PAY; HMAC-SHA512 ký query đã sort/encode đúng spec. Thời gian VNPay dùng GMT+7 và định dạng `yyyyMMddHHmmss`.
- Chỉ `vnp_ResponseCode === "00"` **và** `vnp_TransactionStatus === "00"` mới hoàn tất PAID. `vnp_TmnCode`, `vnp_TxnRef`, `vnp_Amount` phải khớp dữ liệu server lưu. Return URL không được sửa DB.
- Với `Order.total=0`, hoàn tất nội bộ qua hàm dùng chung, không tạo URL VNPay. Không nhận `total` từ client.
- Ước lượng 50–100 phút cần M3–M5 đã chạy, credential sandbox và URL IPN công khai. Nếu thiếu những điều kiện đó, mock IPN có chữ ký vẫn kiểm chứng được logic nhưng chưa phải smoke test với VNPay thật.

## Review Focus

1. Callback giả hoặc sai chữ ký không chuyển PAID hay phát điểm.
2. IPN đúng chữ ký nhưng sai amount/TmnCode/TxnRef bị từ chối.
3. IPN lặp, hoặc IPN đến đồng thời với return, vẫn chỉ một lần PAID/EARN/USED.
4. Return thành công trước IPN vẫn hiển thị đang chờ, rồi cập nhật khi IPN tới.
5. Client không thể gọi route pay giả lập để bỏ qua VNPay khi `PAYMENT_MODE=vnpay`.

---

## File map

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma`, migration mới | `PaymentAttempt` với `orderId` unique, `txnRef` unique, expected amount, trạng thái, transaction no và timestamps |
| `src/config/env.ts`, `.env.example` | `PAYMENT_MODE`, URL, TmnCode, hash secret, return URL; validation khi chọn vnpay |
| `src/modules/payments/vnpay-signature.ts` | Ký/xác minh query v2.1.0 bằng HMAC-SHA512, `timingSafeEqual` |
| `src/modules/payments/payments.{routes,controller,service,repository}.ts` | Tạo URL, IPN, status read và redirect return |
| `src/modules/orders/orders.service.ts`, `src/app.ts` | Gọi finalizer M4; tắt mock pay trong vnpay mode; gắn router |
| `tests/milestone-6.integration.test.ts`, `README.md` | Callback ký thật trong test, hướng dẫn sandbox |

### Task 1 — Config, schema và chữ ký

**Interfaces:** `signVnpay(params: Record<string,string>, secret: string): string`, `verifyVnpay(params: URLSearchParams, secret: string): boolean`; không tính `vnp_SecureHash` trong payload ký. `PaymentAttempt={orderId,txnRef,expectedAmount,status,transactionNo?,createdAt,confirmedAt?}`; `status=CREATED|SUCCEEDED|FAILED`.

- [ ] Viết unit test vector theo PAY v2.1.0: cùng tập key đảo thứ tự cho cùng chữ ký; sửa một amount thì verify false; hash thiếu/sai độ dài false. Chạy `npm test`, xác nhận đỏ.
- [ ] Thêm env validation: `PAYMENT_MODE=mock` mặc định; `vnpay` bắt buộc TmnCode, secret, sandbox URL, return URL. Migration unique `orderId`/`txnRef`; `npm run db:generate` và migrate trên DB test.
- [ ] Cài đặt sort/encode theo đặc tả, dùng `createHmac("sha512", secret)` và so sánh constant-time. Không đưa secret vào URL, response hoặc log.
- [ ] Chạy `npm test`, `npm run build`; mong đợi exit 0. Commit `feat: add vnpay sandbox signing and payment attempt`.

### Task 2 — Khởi tạo thanh toán và truy vấn trạng thái

**Interfaces:** `POST /api/orders/:orderId/payments/vnpay` (MEMBER owner) trả `{orderId:number,paymentUrl:string,txnRef:string}` khi total > 0, hoặc `{orderId:number,orderStatus:"PAID"}` khi total = 0; `GET /api/orders/:orderId/payment-status` (MEMBER owner) trả `{orderStatus:"PENDING"|"PAID",paymentStatus:"CREATED"|"SUCCEEDED"|"FAILED"|null}`. `GET /api/payments/vnpay/return` tra `txnRef` để redirect về FE `/member/:merchantId/orders/:orderId` mà không ghi DB.

- [ ] Viết HTTP test: chỉ owner tạo payment URL cho PENDING; amount VND × 100, mã `txnRef` unique và không vượt 12 chữ số; request lặp trả cùng attempt/URL hoặc `409`, không tạo attempt thứ hai; order PAID nhận `409`; mock pay bị chặn khi vnpay mode. Chạy test, xác nhận đỏ.
- [ ] Tạo URL từ `Order.total` đã lưu, `vnp_TxnRef` của attempt, IP lấy từ request theo cấu hình proxy tin cậy, `vnp_CreateDate` GMT+7; lưu attempt trước khi trả URL. Nếu `total=0`, gọi finalizer nội bộ và trả status PAID, không URL.
- [ ] Chỉ status endpoint được UI dùng để xác nhận kết quả. Return route xác thực hash nếu muốn hiển thị thông tin callback, nhưng dù hợp lệ cũng chỉ redirect, không gọi finalizer.
- [ ] Chạy test, `npm run build`; mong đợi exit 0. Commit `feat: initiate sandbox payment from pending orders`.

### Task 3 — IPN và hoàn tất giao dịch

**Interfaces:** `GET /api/payments/vnpay/ipn` public trả JSON `{RspCode:string,Message:string}` theo PAY spec: `00` xác nhận lần đầu, `02` đã xử lý, `01` không thấy order/attempt, `04` amount sai, `97` chữ ký sai, `99` lỗi server. Mã TmnCode/TxnRef không khớp cũng không được xác nhận.

- [ ] Viết test callback ký hợp lệ success: Order PAID, PaymentAttempt SUCCEEDED, một EARN và Discount Voucher USED. Gửi lại cùng IPN và hai IPN đồng thời: không thêm EARN; response duplicate theo spec. Chạy test, xác nhận đỏ.
- [ ] Viết test chữ ký/amount/TmnCode/TxnRef sai; `ResponseCode` hoặc `TransactionStatus` khác `00`; return URL được gọi trước IPN. Tất cả trường hợp thất bại phải giữ order PENDING, không phát điểm/không USED. Chạy test, xác nhận đỏ.
- [ ] Trong transaction, khóa attempt bằng chuyển trạng thái có điều kiện `CREATED→SUCCEEDED/FAILED`; với success gọi finalizer M4/M5 trong cùng transaction. Callback thất bại chỉ đánh dấu FAILED, không đổi Order. Một order chỉ có một attempt trong MVP; muốn thử lại sau FAILED thì tạo Order mới và thông báo rõ ở UI.
- [ ] Chạy `npm test`, `npm run test:db`, `npm run build`, `git diff --check`; mong đợi exit 0. Viết README về credential, IPN URL công khai và smoke sandbox; commit `feat: confirm vnpay sandbox payments by ipn`.

**Exit gate:** Mock callback được ký thật qua HTTP test; khi có credential và IPN công khai, chạy một giao dịch sandbox thành công và một giao dịch thất bại/cancel, đối chiếu Order/PaymentAttempt/Wallet/Voucher.
