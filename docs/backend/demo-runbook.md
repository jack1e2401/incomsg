# Loyalty Commerce Demo — chạy bằng backend và MySQL thật

Chạy từ npm workspace root. Cần MySQL local và cấu hình kết nối theo
`apps/backend/.env.example`. Các lệnh demo chỉ chấp nhận database `incomsg-test`.
Không thay thế migration bằng `db push`.

```text
npm run demo:seed
npm run demo:backend
npm run demo:frontend
```

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
