# Loyalty Commerce Demo — chạy bằng backend và MySQL thật

Chạy từ npm workspace root. Cần MySQL local và cấu hình kết nối theo
`apps/backend/.env.example`. Các lệnh demo chỉ chấp nhận database `incomsg-test`.
Không thay thế migration bằng `db push`.

```text
npm run demo:seed
npm run demo:backend
npm run demo:frontend
```

Với demo này, chỉ khởi động API bằng `npm run demo:backend`. Không dùng
`npm run dev:backend`: lệnh đó nạp trực tiếp `apps/backend/.env` và có thể kết nối
sang database khác. `demo:backend` khóa đích về MySQL local `incomsg-test` và mock
payment.

Mở frontend tại `http://localhost:5173`. Hai lệnh server chạy ở hai terminal.
`demo:frontend` đặt HTTP mode và mock payment qua backend; kết quả điểm và đơn
được ghi trong MySQL. `demo:seed` tạo namespace tài khoản/cửa hàng mới, không xóa
hoặc sửa lịch sử cũ. Mỗi lần chạy seed tạo một bộ demo độc lập.

Seed in ra ID và đường dẫn credentials. Mặc định credentials nằm ở
`%TEMP%/incomsg-loyalty-demo.json`, ngoài Git; đọc các email/password ở đó để login.
Có thể đặt `DEMO_PASSWORD` trước seed, tối thiểu 12 ký tự. Không commit file này.

Để thực thi và kiểm tra kịch bản API thật:

```text
npm run demo:verify
```

Chạy riêng một DB integration file vẫn qua guard/migration/client generation:

```text
node scripts/test-backend-db.mjs --test-file milestone-3-4-lifecycle-refund.integration.test.ts
```

Lần đầu lệnh đăng nhập, tạo/pay/refund/redeem qua HTTP, kiểm tra authorization,
reward cancel/fulfill và Admin moderation. Nó đọc lại Prisma/MySQL để đối chiếu
wallet balance với tổng ledger, lifetime chỉ với EARN/EARN_REVERSAL. Lần chạy lại
chỉ đối chiếu dữ liệu đã hoàn tất, không tạo lại đơn. Nếu một run lỗi giữa chừng,
seed run mới để giữ nguyên audit của run lỗi.

## Trình bày luồng điểm

1. Merchant có rate 10.000 VND/điểm; Bronze multiplier 1.00; discount cost 1 điểm.
2. Member mua sản phẩm 6.000 và thanh toán: available 0, carry 0.6.
3. Mua lại 6.000: available 1, carry 0.2.
4. Đổi discount 1 điểm: available 0, carry 0.2; tier không giảm.
5. Merchant preview/full refund đơn thứ hai: đảo đúng 0.6; available 0, carry 0,
   debt 0.4; ledger có EARN_REVERSAL -0.6.
6. Member mua sản phẩm 14.000: earning 1.4 trả debt 0.4, available 1.
7. Mở Merchant Loyalty / giao dịch điểm và xem đủ 5 events theo thứ tự.
8. Dùng account reward riêng xem quà đã hủy/đã trao và audit người xử lý.
9. Admin xem Users, suspend/unban có lý do, blacklist/deactivate và Audit Logs.

Sau `demo:verify`, account `member` đang ở trạng thái cuối bước 6. Muốn trình bày
từ đầu bằng UI, dùng account Member mới hoặc seed run mới rồi thực hiện các bước
bằng browser thay vì chạy `demo:verify` trước.

## Giải thích cho người review

`raw earning = net order VND / vndPerPoint × tierMultiplier`. Backend tính Decimal
và lưu credit chính xác vào order. Khi PAID, cùng transaction cập nhật wallet,
append ledger và tier. Một event reference duy nhất chặn double credit.

Wallet có một signed exact balance. UI suy ra điểm nguyên, carry hoặc debt;
redemption chỉ tiêu phần nguyên còn đủ sau nợ. Refund lấy exact credit đã lưu của
order gốc để append số âm; không tính lại theo chính sách hiện tại và không thu
hồi voucher khác đã đổi hợp lệ. Lifetime chỉ đổi vì EARN/EARN_REVERSAL, nên tiêu
điểm không hạ tier.

Cancel chỉ dành cho pending an toàn và giải phóng reservation. VNPay CREATED
chưa đối soát sẽ chặn cancel; VNPay refund giữ pending cho tới provider xác nhận.
Demo mock refund hoàn thành ngay là mô phỏng thanh toán được backend kiểm soát.
Không có tích hợp xác nhận VNPay refund thật hoặc partial refund.

## Kịch bản UI: tồn kho và chính sách đơn

Thời lượng khoảng 8–10 phút. Dùng dữ liệu mới để có tồn kho và ví điểm sạch; không
chạy `demo:verify` trước khi trình bày vì lệnh đó tạo giao dịch demo qua API.

### Chuẩn bị

Từ npm workspace root, tạo bộ tài khoản mới. Seed chỉ ghi vào MySQL local
`incomsg-test`, không xóa bộ demo cũ:

```powershell
npm run demo:seed
Get-Content "$env:TEMP/incomsg-loyalty-demo.json"
```

Giữ lại `merchant.id`, `products.small`, `products.recovery`, email các tài khoản
và password trong JSON. Không gửi hoặc commit file credentials. Mở hai terminal:

```text
Terminal 1: npm run demo:backend
Terminal 2: npm run demo:frontend
```

Mở `http://localhost:5173`. Mọi thanh toán trong demo đều là mock; không dùng
VNPay. Nếu cổng 3000 hoặc 5173 đang bận, dừng phiên demo cũ trước khi chạy.

### Luồng chính

1. Đăng nhập bằng email `merchant` trong file credentials, mở **Sản phẩm**.
   Bảng đọc tồn kho thật từ backend; mở dấu ba chấm ở `products.small` →
   **Điều chỉnh tồn kho** → **Tăng**, nhập `5`, ghi chú `Chuẩn bị demo với sếp`,
   rồi lưu. Tồn thay đổi từ 100 lên 105.
2. Mở dấu ba chấm → **Lịch sử tồn kho** để xem lần tăng từ 100 lên 105,
   người thực hiện và ghi chú.
3. Đăng xuất Merchant, đăng nhập bằng email `member`, mở gian hàng
   `/member/<merchant.id>`. Thêm `products.recovery` (14.000 VND) vào giỏ và
   checkout. Trang đơn cho thấy tồn được giữ trong 5 phút. Chọn **Thanh toán
   (mô phỏng)**: tồn sản phẩm giảm đúng một món và đơn chuyển sang đã thanh toán.
4. Mở chi tiết đơn ở Member và **Đơn hàng** ở Merchant. Cả hai bên xem cùng
   snapshot chính sách đã áp dụng: 10.000 VND/điểm và hạng Bronze ×1.00. Tải lại
   trang vẫn thấy trạng thái đơn và snapshot được lưu từ backend.

### Phần mở rộng nếu còn thời gian

- Member vừa nhận 1,4 điểm từ đơn 14.000 VND. Đổi voucher `Demo discount
  1,000 VND` giá 1 điểm; tồn lượt phát hành giảm từ 10 xuống 9. Trang Voucher của
  Merchant cho thấy số lượng backend.
- Để demo quà vật lý, mua thêm sản phẩm 6.000 VND để đủ 1 điểm, đổi `Demo reward
  gift`, rồi dùng hàng chờ **Quà đổi thưởng** của Merchant để xác nhận đã trao.
  Tồn quà giảm từ 2 xuống 1 đúng một lần.
- Để demo cancel, tạo một đơn mua khác, hủy khi còn chờ thanh toán và kiểm tra
  số lượng đã giữ được giải phóng.

### Kết quả cần thấy

- Sản phẩm `small`: 105 sau khi tăng tồn. Nếu mua thêm một món ở phần mở rộng,
  số lượng còn 104. Sản phẩm `recovery`: 99 sau thanh toán. Quà vật lý còn 1 sau khi trao.
- Lịch sử ghi mỗi thay đổi, số lượng trước/sau, actor và ghi chú. Payment chỉ
  hoàn tất sau phản hồi mock từ backend; policy snapshot giống nhau ở Member và
  Merchant.
- Sau demo, dừng hai server bằng `Ctrl+C`. Không cần xóa dữ liệu. Lần seed kế
  tiếp tạo bộ mới và giữ nguyên audit của lần này.
