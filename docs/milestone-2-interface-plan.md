# Giao diện Milestone 2 — Auth và duyệt Merchant

## Mục tiêu

Giao diện hoàn chỉnh cho đúng phạm vi backend M2: đăng ký Member, đăng ký Merchant, đăng nhập bằng JWT, phân quyền theo role, Admin xét duyệt hồ sơ và Merchant đọc cửa hàng gắn với tài khoản. API là nguồn xác nhận duy nhất cho user, session, trạng thái hồ sơ và merchant.

## Điều hướng và màn hình

| Route | Vai trò | Màn hình và trạng thái |
| --- | --- | --- |
| `/` | Public | Giới thiệu các luồng M2; nút đăng nhập và tạo tài khoản; hiển thị API mode và giới hạn M2. |
| `/login` | Public | Email, mật khẩu, đang gửi, lỗi credential, Merchant PENDING/REJECTED, tài khoản inactive. Thành công điều hướng theo role BE trả về. |
| `/register` | Public | Chọn Member hoặc Merchant. Member chỉ nhập email/mật khẩu. Merchant nhập tên cửa hàng, email, mật khẩu và thấy trước quy tắc chờ duyệt. |
| `/admin/applications` | Admin | Tải hàng đợi PENDING, empty/error/loading, hồ sơ và applicant ID, trạng thái, ngày xét duyệt, approve/reject với trạng thái busy và lỗi API. |
| `/merchant` | Merchant active | Gọi `/api/merchant/me`, hiển thị tên/slug/trạng thái cửa hàng thật; loading/error; giải thích các màn commerce thuộc milestone sau. |
| `/member` | Member | Xác nhận tài khoản active và giải thích phần storefront/wallet chờ API commerce kế tiếp. |

Route không đúng role sẽ chuyển về workspace của role trong session. Chưa đăng nhập sẽ chuyển về login. API tiếp tục kiểm tra token, tài khoản active và role ở mọi thao tác được bảo vệ.

## Mapping endpoint

| Hành động UI | Request | Phản hồi UI sử dụng |
| --- | --- | --- |
| Đăng ký Member | `POST /api/auth/register/member` `{email,password}` | `201 {user}`; hiển thị hoàn tất và chuyển sang login. |
| Nộp hồ sơ Merchant | `POST /api/auth/register/merchant` `{email,password,storeName}` | `201 {user,application}`; hiển thị ID hồ sơ và PENDING. |
| Đăng nhập | `POST /api/auth/login` `{email,password}` | `200 {accessToken,user}`; lưu session theo tab và điều hướng theo `user.role`. |
| Tải hàng chờ | `GET /api/admin/merchants/pending` + Bearer | `200 {applications}`; chỉ dùng đúng trường DTO BE trả về. |
| Duyệt | `PATCH /api/admin/merchants/:id/approve` + Bearer | `200 {application,merchant}`; hiển thị trạng thái response. |
| Từ chối | `PATCH /api/admin/merchants/:id/reject` + Bearer | `200 {application}`; hiển thị trạng thái response. |
| Xem cửa hàng | `GET /api/merchant/me` + Bearer | `200 {merchant}`; hiển thị cửa hàng lấy theo owner trong token. |

## Quy tắc UI và dữ liệu

- Chỉ đánh dấu đăng nhập thành công sau response 200 có token và user. Role được lấy từ response, không chọn từ form.
- Lưu token trong `sessionStorage` để phiên demo đóng khi tab/session kết thúc; gửi dưới dạng `Authorization: Bearer <accessToken>`.
- Hiển thị lỗi BE `{error}`. Các lỗi `INVALID_CREDENTIALS`, `MERCHANT_PENDING`, `MERCHANT_REJECTED`, `ACCOUNT_INACTIVE` có thông điệp tiếng Việt dễ hiểu; lỗi khác giữ nguyên mã để hỗ trợ chẩn đoán.
- Không tự thêm hồ sơ vào hàng đợi nếu request thất bại. Approve/reject đổi trạng thái chỉ sau response thành công.
- Backend DTO application không có applicant email, tên người hoặc ghi chú. UI không suy diễn các trường đó.
- Member signup active ngay; Merchant signup không tự tạo session và không vào workspace trước khi được duyệt.
- Màn Admin chỉ truy vấn danh sách PENDING theo API hiện có. Kết quả approve/reject được giữ trong UI hiện tại; sau reload, API chỉ trả hồ sơ còn PENDING theo hợp đồng hiện tại.

## Điều kiện hoàn thành

- `VITE_API_MODE=http` chỉ render các màn M2 nối endpoint thật, không render các route commerce mock.
- `VITE_API_MODE=mock` tiếp tục mở demo commerce hiện tại.
- Admin không thể gọi màn Admin với Member/Merchant; Member không thể gọi Merchant workspace; chưa đăng nhập được chuyển về login.
- Merchant PENDING/REJECTED nhận được giải thích rõ từ lỗi login do backend trả về.
- Tất cả endpoint M2 có loading, error, pending/empty hoặc success state phù hợp.
- Playwright kiểm tra đăng ký Member, Merchant PENDING, guards theo role, Admin approve/reject và Merchant `/me` bằng API test server khi môi trường DB seed sẵn; UI adapter tests có thể dùng stub khi không có DB.

## Ngoài phạm vi M2

Backend M2 chưa có endpoint list merchants, catalog/products, orders/checkout/payment, wallet/tier/point transactions, loyalty config, voucher redemption hoặc reward fulfillment. HTTP mode không hiển thị các màn demo cho những phần này. Chúng tiếp tục dùng demo riêng trong mock mode và được nối ở các milestone backend kế tiếp.
