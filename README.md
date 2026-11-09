# Backend

Express + TypeScript + Prisma + MySQL. Mỗi module đặt controller, service, repository và routes cạnh nhau trong `src/modules/`.

## Chạy local

1. Cài Node.js >= 22.12 và MySQL trên máy.
2. Sao chép `.env.example` thành `.env`, đặt `DATABASE_URL`, `JWT_SECRET` (ít nhất 32 byte), `ADMIN_EMAIL`, `ADMIN_PASSWORD` và `FRONTEND_ORIGIN`.
3. Chạy `npm ci`, `npm run db:generate`, `npm run db:seed`, rồi `npm run dev`.

API chạy tại `http://localhost:3000`. `GET /api/health` kiểm tra server; `GET /api/health/db` kiểm tra kết nối MySQL qua Repository.

## Milestone 1 — nền tảng dữ liệu

Schema gồm tài khoản, hồ sơ xin mở cửa hàng, Merchant, sản phẩm, đơn hàng, Membership, ví điểm, tier, giao dịch điểm, voucher và xác nhận trao thưởng. `MerchantMembership` là cặp Member–Merchant duy nhất; tier `null` nghĩa là Unranked. Mỗi Membership có ví riêng. Migration đầu tiên đã được tạo trong `prisma/migrations/`.

Để dựng database mới, chạy `npx prisma migrate deploy`. Khi thay schema trong giai đoạn phát triển, tạo migration bằng `npx prisma migrate dev --name <ten_migration>`.

Để tạo Admin demo, điền `ADMIN_EMAIL` và `ADMIN_PASSWORD` (tối thiểu 12 ký tự) vào `.env`, rồi chạy `npm run db:seed`. Seed có thể chạy lại; tài khoản Admin đã tồn tại sẽ giữ nguyên mật khẩu. Mật khẩu được lưu bằng scrypt với salt ngẫu nhiên.

Chạy `npm test`, `npm run test:db` và `npm run build` để kiểm tra mã, quan hệ database và bản build. Bài test database dùng transaction rồi rollback, không để lại dữ liệu test.

`npm run build` tạo bản chạy tại `dist/`; sau đó dùng `npm start`.

## Milestone 2 — đăng ký, đăng nhập và Merchant approval

- Member đăng ký qua `POST /api/auth/register/member` và active ngay.
- Merchant đăng ký qua `POST /api/auth/register/merchant`. Tài khoản ở trạng thái chờ duyệt.
- Merchant xem trạng thái hồ sơ của chính mình qua `POST /api/auth/application-status` với email/mật khẩu đã đăng ký; endpoint trả PENDING, APPROVED hoặc REJECTED mà không cấp token.
- Đăng nhập qua `POST /api/auth/login`, sau đó gửi `Authorization: Bearer <accessToken>` tới route cần đăng nhập.
- Admin xem hồ sơ chờ tại `GET /api/admin/merchants/pending`, duyệt tại `PATCH /api/admin/merchants/:id/approve` hoặc từ chối tại `PATCH /api/admin/merchants/:id/reject`.
- Merchant đã duyệt xem cửa hàng của mình tại `GET /api/merchant/me`.

Chạy `npm run test:milestone2` để kiểm tra luồng Member đăng ký/login, Merchant đăng ký chờ duyệt, Admin duyệt/từ chối, và role guard qua HTTP thật. Test dùng email ngẫu nhiên trên database local rồi dọn các bản ghi do chính test tạo.

## Milestone 3 — catalog và Buy Now

- Merchant đã được duyệt tạo, xem và sửa sản phẩm của cửa hàng tại `/api/merchant/products`. PATCH `status` thành `HIDDEN` để ẩn sản phẩm.
- Catalog công khai tại `GET /api/merchants/:merchantId/products` chỉ trả sản phẩm đang `ACTIVE` của cửa hàng active.
- Member đặt một sản phẩm với số lượng 1–99 tại `POST /api/orders`. Backend tự lấy giá hiện tại, tính tiền và lưu snapshot sản phẩm trong đơn `PENDING`.
- Member thanh toán giả lập đơn của mình tại `POST /api/orders/:orderId/pay`. Đơn chuyển sang `PAID`; gọi lần nữa nhận `409 ORDER_ALREADY_PAID`.

### Smoke test thủ công bằng PowerShell

Đặt `$baseUrl`, `$merchantEmail`, `$merchantPassword`, `$memberEmail` và `$memberPassword` theo tài khoản local. Merchant cần được Admin duyệt trước. Mỗi request bên dưới là một lệnh riêng; xem response để lấy token và ID cho bước tiếp theo.

1. Đăng nhập Merchant, kết quả có `accessToken` và thông tin User.

```powershell
$merchantSession = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType "application/json" -Body (@{ email = $merchantEmail; password = $merchantPassword } | ConvertTo-Json)
```

2. Lưu token Merchant để gọi API quản lý sản phẩm.

```powershell
$merchantToken = $merchantSession.accessToken
```

3. Đăng nhập Member, kết quả có `accessToken`.

```powershell
$memberSession = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType "application/json" -Body (@{ email = $memberEmail; password = $memberPassword } | ConvertTo-Json)
```

4. Lưu token Member để đặt hàng và thanh toán.

```powershell
$memberToken = $memberSession.accessToken
```

5. Tạo sản phẩm. Mong đợi `201` và `product.status` là `ACTIVE`.

```powershell
$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/merchant/products" -Headers @{ Authorization = "Bearer $merchantToken" } -ContentType "application/json" -Body (@{ name = "Demo Coffee"; price = "150000"; description = "Coffee for the M3 demo" } | ConvertTo-Json)
```

6. Xem sản phẩm của Merchant, gồm sản phẩm `HIDDEN` nếu có.

```powershell
$ownCatalog = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/merchant/products" -Headers @{ Authorization = "Bearer $merchantToken" }
```

7. Xem catalog công khai theo `merchantId` trả về lúc tạo. Sản phẩm `ACTIVE` xuất hiện ở đây.

```powershell
$publicCatalog = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/merchants/$($product.product.merchantId)/products"
```

8. Member đặt mua hai sản phẩm. Mong đợi `201`, trạng thái `PENDING`, `total` bằng `"300000"` và `unitPrice` bằng `"150000"`.

```powershell
$order = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/orders" -Headers @{ Authorization = "Bearer $memberToken" } -ContentType "application/json" -Body (@{ productId = $product.product.id; quantity = 2 } | ConvertTo-Json)
```

9. Thanh toán giả lập. Mong đợi trạng thái `PAID` và `paidAt` có timestamp.

```powershell
$paidOrder = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/orders/$($order.order.id)/pay" -Headers @{ Authorization = "Bearer $memberToken" }
```

Gọi lại bước 9 với cùng đơn trả `409 ORDER_ALREADY_PAID`. Đơn giữ nguyên tên sản phẩm và giá snapshot tại thời điểm đặt, kể cả khi Merchant sửa hoặc ẩn sản phẩm sau đó.

## Milestone 6 — VNPay Sandbox

Mặc định `PAYMENT_MODE=mock`; route `POST /api/orders/:orderId/pay` xác nhận thanh toán giả lập. Khi bật `PAYMENT_MODE=vnpay`, cấu hình `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và `VNPAY_RETURN_URL` trong `.env`. URL thanh toán bị giới hạn vào endpoint HTTPS Sandbox `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`; không dùng hash secret production trong cấu hình này.

Chạy `npx prisma migrate deploy` để tạo `PaymentAttempt`. Khai báo Return URL trong cấu hình `.env`, sau đó đăng nhập trang quản trị Sandbox và cấu hình IPN URL công khai trên HTTPS cho merchant/TmnCode tương ứng. IPN URL được cấu hình tại tài khoản VNPay; không gửi `vnp_IpnUrl` như một tham số thanh toán. Return URL chỉ đưa Member về trang kết quả, còn IPN có chữ ký HMAC-SHA512 mới quyết định PAID. Member khởi tạo thanh toán qua `POST /api/orders/:orderId/payments/vnpay`, giao diện đọc lại `GET /api/orders/:orderId/payment-status`. Thành công cần cả `vnp_ResponseCode=00` và `vnp_TransactionStatus=00`; trạng thái `01` giữ attempt mở để nhận kết quả hoàn tất sau đó, còn IPN lặp không phát điểm lần hai. Đơn tổng bằng 0 được hoàn tất trong backend mà không chuyển sang VNPay.

Payment attempt chụp `vndPerPoint`, trạng thái loyalty và multiplier của từng tier tại lúc tạo, đồng thời giữ trước mức điểm tối đa để không vượt giới hạn ví. Khi quyết toán, IPN chọn tier hiện tại của Member rồi áp dụng multiplier đã chụp cho tier đó. Vì vậy đơn thứ hai đã khởi tạo trước khi tier tăng vẫn được tính theo tier mới, còn thay đổi cấu hình multiplier chỉ áp dụng cho attempt tạo sau. Mock pay từ chối mọi đơn đã có VNPay attempt. Migration dừng nếu các reservation cũ không thể nằm an toàn trong giới hạn số nguyên ví; cần đối soát giao dịch đang mở với VNPay trước khi retry.

Với các attempt đã mở trước khi có tier snapshot, không thể khôi phục multiplier lịch sử. Attempt có reservation dương giữ nguyên số điểm đã reserve và settlement trao đúng số điểm đó; không thể khôi phục multiplier lịch sử hoặc suy ra tỷ lệ quy đổi ban đầu. Attempt có reservation bằng 0 được backfill theo tier cao nhất hiện có; nếu giá trị 0 từng là một mức thưởng thực tế thì không thể phân biệt với dữ liệu thiếu. Migration đánh dấu `snapshotTierConfigFallback` và gán multiplier dự phòng bằng mức tối đa đã reserve cho mọi tier; bước fallback không thay đổi reservation hay số dư ví.

Chạy `npm test`, `npm run build`, `npx prisma validate` và `npx tsx --test tests/milestone-6.integration.test.ts`. Integration test tạo IPN đã ký để kiểm tra xác nhận, lỗi và gọi lặp; smoke test với VNPay thật cần credential Sandbox và URL IPN công khai.
