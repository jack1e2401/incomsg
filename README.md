# IncomSG Loyalty Commerce Frontend

Giao diện của prototype thương mại và loyalty cho nhiều cửa hàng. Mỗi shop có chính sách tích điểm riêng. Ví, hạng và voucher của Member được quản lý riêng theo shop.

Ứng dụng dùng React, TypeScript, Vite, Tailwind CSS, Radix UI và React Router.

## Trải nghiệm theo vai trò

| Vai trò | Tính năng chính |
| --- | --- |
| Admin | Duyệt hoặc từ chối hồ sơ mở shop, xem lịch sử duyệt, danh sách cửa hàng và số liệu hệ thống. |
| Merchant | Xem doanh thu 7 ngày, xem trước gian hàng, quản lý sản phẩm và cấu hình loyalty. Theo dõi người mua trên đơn, phát hành mẫu voucher và xác nhận trao quà. |
| Member | Mua nhiều sản phẩm của cùng một shop trong một đơn, dùng voucher giảm giá, xem ví và chính sách của từng shop, đổi điểm lấy voucher hoặc quà. |

Khi backend xác nhận đơn đã thanh toán, màn kết quả hiển thị số điểm thực nhận và lời chúc mừng nếu đơn giúp Member đạt hạng mới. Mở lại đơn vẫn xem được kết quả đã ghi cho đơn đó.

Trong tab **Ví điểm**, nút **Chính sách tích điểm** mở tỷ lệ quy đổi, ngưỡng tích lũy và hệ số từng hạng của shop hiện tại. Biểu đồ Merchant dùng uPlot và chỉ tính đơn đã thanh toán theo ngày ở giờ Việt Nam.

## Khởi động local

Dùng Node.js 22.12 trở lên. Tạo `.env` theo [.env.example](./.env.example). Khi demo với backend local, đặt `VITE_API_MODE=http` và `VITE_PAYMENT_MODE=mock`. API mặc định ở `http://localhost:3000`.

```sh
npm ci
npm run dev
```

Mở `http://localhost:5173`. Chế độ `VITE_API_MODE=mock` dành cho bản xem offline. Nếu demo VNPay Sandbox, đặt `VITE_PAYMENT_MODE=vnpay` cùng chế độ thanh toán tương ứng ở backend.

## Cấu trúc repo

- [src/app](./src/app) và [src/layouts](./src/layouts) chứa các route, điều hướng và bố cục theo vai trò.
- [src/features](./src/features) chứa màn hình Admin, Merchant, Member và xác thực.
- [src/api](./src/api) chứa API client và kiểu dữ liệu từ backend.
- [playwright](./playwright) chứa kiểm tra các luồng trên trình duyệt với API giả lập.
