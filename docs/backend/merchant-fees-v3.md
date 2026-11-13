# Demo V3: hạng cửa hàng và sổ phí

## Chạy local

Từ thư mục gốc, áp dụng migration cho database local trong `apps/backend/.env`, tạo Prisma Client và bật hai app:

```powershell
npm exec -w apps/backend -- prisma migrate deploy --config prisma7.config.ts
npm run db:generate -w apps/backend
npm run dev
```

Dùng `PAYMENT_MODE=mock` để chạy đủ mua hàng và hoàn tiền. Migration chỉ bổ sung schema. Đơn đã thanh toán từ V2 vẫn góp vào doanh thu xét hạng nếu thuộc năm hiện tại. Việc bổ sung phí cho dữ liệu demo cũ là thao tác seed riêng, dựa trên thứ tự thanh toán và hoàn tiền được lưu trong database.

## Trình bày

1. Mở tổng quan Merchant để xem hạng, mức phí, doanh thu năm và modal **Đề xuất nghiệp vụ**.
2. Dùng Member mua và thanh toán một đơn. Kiểm tra giao dịch cộng trong **Ví điểm**.
3. Trong Merchant, mở **Đơn hàng → Sổ phí bán hàng**. Bấm **Chi tiết** để xem số tiền tính phí, hạng và tỷ lệ đã áp dụng.
4. Bấm **Xem đơn hàng**, hoàn tiền toàn phần, rồi quay lại sổ phí. Dòng hoàn phí mang số âm. Ví Member hiện dòng thu hồi điểm.
5. Mở tổng quan Admin để xem biểu đồ phí ròng và xếp hạng theo doanh thu hoặc phí đóng góp. Chọn **7 ngày**, **30 ngày** hoặc **Năm nay** cho bảng và biểu đồ. Bấm **Xem sổ phí** để đối chiếu một cửa hàng.

## Quy tắc tra cứu

- Hạng cửa hàng xét theo doanh thu năm dương lịch, giờ Việt Nam. Bronze áp 5%, Silver từ 10 triệu đồng áp 4% và Gold từ 50 triệu đồng áp 3%. Đơn chạm mốc dùng hạng trước khi tính doanh thu của đơn đó.
- Hoàn tiền toàn phần hoàn tất sẽ đảo đúng phí gốc, kể cả khi đã sang năm khác. Hoàn VNPay đang chờ xác nhận chưa ghi dòng đảo.
- Các ô **Từ ngày / Đến ngày** mặc định là một năm trước đến hôm nay theo giờ Việt Nam. Có thể đổi ngày để tra kỳ khác. Trong chi tiết phí, giao dịch liên quan được tìm theo mã đơn qua các năm.
- Xếp hạng doanh thu dựa trên giá trị thực trả của đơn trong kỳ, trừ các đơn đã hoàn tất hoàn tiền. Phí ròng dựa trên ngày ghi từng dòng phí hoặc hoàn phí. Cửa hàng tạm ngưng vẫn xuất hiện nếu có phát sinh trong kỳ.
- Sổ phí phục vụ demo và đối chiếu số phát sinh. Bản này chưa có luồng thu phí thực tế hay chuyển tiền.
- Tiền sau phí của Merchant là tiền đơn có bản ghi phí trừ phí sàn, đồng thời trừ các đơn đã hoàn theo ngày phát sinh. Con số hiển thị phục vụ đối chiếu demo và không xác nhận việc chuyển tiền.

## API

- `GET /api/merchant/finance` trả hạng hiện tại, tổng phí và lịch sử phí của cửa hàng đăng nhập.
- `GET /api/admin/merchants` thêm `financeTier`. `GET /api/admin/merchants/:merchantId/fees` trả sổ phí của cửa hàng được chọn.
- `GET /api/admin/dashboard` thêm tổng phí nền tảng trong năm. `GET /api/merchant/loyalty/transactions` thêm tổng điểm theo nhóm giao dịch.
- `GET /api/admin/finance?period=7d|30d|year` trả tổng phí, chuỗi biểu đồ và số liệu theo cửa hàng cho kỳ đã chọn.
