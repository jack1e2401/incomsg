# Kế hoạch hoàn thiện giao diện Nhiệm vụ theo hướng gamification

**Trạng thái:** Sẵn sàng triển khai UI
**Phạm vi:** Member storefront và Merchant console
**Hợp đồng nghiệp vụ:** [Challenges, navigation và refund](../specs/2026-11-17-v4-challenges-navigation-refund-design.md)

## Mục tiêu

Biến nhiệm vụ phía member thành một hành trình có mục tiêu, các mốc tiến độ dễ hiểu và phản hồi sinh động khi hoàn thành. Merchant có màn quản lý chiến dịch rõ ràng để tạo, theo dõi và điều chỉnh ngân sách nhiệm vụ.

Lấy cảm hứng từ cách Duolingo thể hiện hành trình học tập, nhưng giữ nhận diện IncomSG và nội dung phù hợp với mua sắm, điểm danh, đơn hàng.

## Quyết định giao diện và nghiệp vụ

- Chỉ phía member dùng hành trình gamification và animation. Merchant console vẫn ưu tiên đọc số liệu, quản lý trạng thái và thao tác chính xác.
- Các nút mốc là chỉ báo tiến độ trực quan. **Không tạo phần thưởng hoặc điểm thưởng riêng cho từng mốc**; phần thưởng chỉ phát khi hoàn thành mục tiêu và backend trả trạng thái tương ứng.
- Backend tiếp tục là nguồn chuẩn cho `currentValue`, `targetValue`, `percent`, `rewardState`, `completedAt` và `grantedAt`. UI không tự xác nhận hoàn thành hoặc tự cộng điểm.
- Mốc hoàn thành được suy ra để trình bày từ mục tiêu hiện có: mục tiêu đếm đơn/điểm danh hiển thị tối đa 5 chặng dễ đọc; mục tiêu chi tiêu chia thành các chặng tỷ lệ. Đây chỉ là phép chia hình ảnh của cùng một mục tiêu.
- `WAITING_BUDGET` hiển thị hoàn thành mục tiêu nhưng đang chờ ngân sách cấp thưởng. Không phát hiệu ứng hoặc nội dung khiến member hiểu là điểm đã vào ví.
- Khi hoàn tiền làm tiến độ giảm, thể hiện cập nhật lùi một cách nhẹ nhàng và không chạy hiệu ứng chúc mừng.
- Animation là micro-interaction ngắn, có fallback tĩnh, tôn trọng `prefers-reduced-motion`; chỉ dùng trong trải nghiệm Member.
- Khách xem được mục tiêu và phần thưởng nhưng không thấy tiến độ `0/target`. Các CTA đăng nhập và điều hướng giữ đúng shop slug.
- Giữ nguyên API, schema, loại nhiệm vụ, auto-enrollment, auto-reward và chính sách hoàn tiền trong đặc tả hiện hành.

## Thiết kế trải nghiệm Member

### Trang chủ và thẻ nhiệm vụ nổi bật

- Giữ thẻ nhiệm vụ nổi bật gọn, cho thấy tên nhiệm vụ, phần thưởng cuối, hạn và tiến độ hiện tại.
- Thay thanh tiến độ đơn lẻ bằng một đoạn đường có các nút mốc; mốc đã qua, mốc hiện tại và mốc kế tiếp có hình thái riêng.
- CTA theo loại nhiệm vụ: điểm danh, xem sản phẩm để tiếp tục mục tiêu đơn hàng, hoặc xem chi tiết nhiệm vụ.
- Có liên kết rõ ràng đến danh sách nhiệm vụ; không chèn nhiều lời kêu gọi hoặc badge trang trí.

### Danh sách nhiệm vụ

- Tổ chức các nhiệm vụ đang làm thành các thẻ hành trình dễ quét trên mobile; thẻ đã nhận thưởng và hết hạn nằm trong vùng trạng thái tương ứng.
- Mỗi thẻ cho thấy mục tiêu, số điểm thưởng cuối, hạn, tiến độ và bước còn lại.
- Giữ trạng thái rỗng, loading, lỗi và khách chưa đăng nhập có hành động tiếp theo cụ thể.

### Chi tiết nhiệm vụ

- Tạo thứ bậc rõ: tên và mô tả, phần thưởng cuối, hạn, hành trình mốc, CTA chính.
- Hiển thị các mốc theo loại mục tiêu: số đơn, số ngày điểm danh hoặc các chặng chi tiêu. Mốc đạt được dựa vào dữ liệu tiến độ backend.
- Danh sách hoạt động gần đây giải thích tiến độ tăng hoặc giảm, dùng dữ liệu `recentEntries` hiện có.
- Nút điểm danh khóa theo phản hồi `checkedInToday`; sau phản hồi thành công, cập nhật dữ liệu rồi mới chạy chuyển động tiến độ.
- Hoàn thành đủ mục tiêu có hiệu ứng ngắn tại nút cuối và lời xác nhận theo trạng thái thưởng. Không dùng âm thanh mặc định.

## Thiết kế Merchant console

- Thay bảng hiện tại đang tràn ngang và lộ enum kỹ thuật bằng danh sách quản lý dễ đọc trên desktop và thẻ trên mobile.
- Tóm tắt số nhiệm vụ theo trạng thái, người tham gia/hoàn thành, thưởng chờ ngân sách và phần ngân sách đã dùng bằng các trường API sẵn có.
- Đổi nhãn `ORDER_COUNT`, `DAILY_CHECKIN`, `SPEND_TOTAL`, trạng thái và thao tác sang tiếng Việt thân thiện.
- Đưa tìm kiếm, lọc trạng thái/loại và tạo nhiệm vụ vào cùng một vùng công cụ rõ ràng.
- Mỗi dòng/thẻ ưu tiên tên, trạng thái, mục tiêu, điểm thưởng, thời gian và ngân sách; gom thao tác ít dùng vào menu thao tác.
- Trang chi tiết phân vùng thông tin chiến dịch, ngân sách và danh sách thành viên. Giữ trạng thái hoàn thành, chờ ngân sách, thưởng đã phát/thu hồi rõ ràng.
- Giữ nguyên quy tắc khóa trường sau khi kích hoạt, giới hạn ngân sách, nổi bật duy nhất và hành động activate/pause/archive/delete.

## Kế hoạch triển khai

### Task 1 — Thành phần trình bày mốc

**Tệp dự kiến:** `apps/frontend/src/features/challenges/challenge-ui.tsx` và các component con trong `apps/frontend/src/features/challenges/`.

- Tạo component hành trình nhận challenge và progress từ API.
- Tính các ngưỡng mốc chỉ để hiển thị; dùng số chính xác hiện có và không biến mốc thành luật thưởng.
- Hỗ trợ mục tiêu nhỏ, mục tiêu lớn, trạng thái chưa bắt đầu, đang làm, chờ ngân sách, đã nhận thưởng, hết hạn.
- Có nhãn văn bản và accessibility role cho tiến độ, không phụ thuộc màu hoặc chuyển động.

**Hoàn tất khi:** cùng một component trình bày đúng ba loại nhiệm vụ và không hiển thị tiến độ member cho khách.

### Task 2 — Member home và danh sách nhiệm vụ

**Tệp dự kiến:** `apps/frontend/src/features/challenges/ChallengeHeroCard.tsx`, `ChallengesPage.tsx` và component thẻ mới nếu cần.

- Đưa hành trình mốc vào thẻ nhiệm vụ nổi bật và thẻ danh sách.
- Giảm thông tin lặp giữa tên, mô tả, mục tiêu và trạng thái.
- Giữ điều hướng theo `/s/:slug`, tab trạng thái và CTA theo loại nhiệm vụ.

**Hoàn tất khi:** member hiểu được nhiệm vụ đang làm, mốc kế tiếp, phần thưởng cuối và việc cần làm tiếp theo ngay trên mobile.

### Task 3 — Chi tiết nhiệm vụ và phản hồi tiến độ

**Tệp dự kiến:** `apps/frontend/src/features/challenges/ChallengeDetailPage.tsx`, hook hoặc component motion trong feature challenges.

- Dùng bố cục hành trình cho mốc tiến độ và đặt hoạt động gần đây bên dưới.
- Sau check-in, lấy dữ liệu xác nhận từ response/refetch trước khi animate.
- Khi progress thay đổi từ trạng thái tải mới, không tự chạy hiệu ứng nhận thưởng; chỉ chạy celebration khi có chuyển trạng thái hoàn thành được xác nhận trong phiên.
- Thêm chuyển động cho fill/nút mốc và celebration ngắn khi được thưởng; tắt hoặc thay bằng trạng thái tĩnh khi reduced motion.
- Với tiến độ bị đảo do hoàn tiền, animate lùi nhẹ và cập nhật thông tin trạng thái.

**Hoàn tất khi:** refresh, check-in, hoàn tiền, chờ ngân sách và nhận thưởng không tạo trạng thái giả hoặc celebration lặp.

### Task 4 — Merchant challenge list và detail

**Tệp dự kiến:** `apps/frontend/src/features/merchant/challenges/MerchantChallengesPage.tsx`, `MerchantChallengeDetailPage.tsx`, component nhãn/row/card dùng riêng cho feature merchant.

- Thay bảng tràn ngang bằng bố cục desktop có cột ưu tiên và mobile cards.
- Dùng nhãn tiếng Việt cho loại/trạng thái; thể hiện ngân sách bằng số liệu API.
- Bảo toàn tìm kiếm, lọc, phân trang, sửa, kích hoạt, tạm dừng, lưu trữ, nổi bật và xóa.
- Làm rõ thành viên đang tham gia, đã hoàn thành, chờ ngân sách và lịch sử thưởng ở trang chi tiết.

**Hoàn tất khi:** merchant quản lý được toàn bộ thao tác hiện có ở desktop/mobile mà không cần đọc enum hoặc cuộn bảng ngang.

### Task 5 — Kiểm tra responsive, accessibility và nghiệp vụ

- Kiểm tra chiều rộng 375–430px, tablet và desktop; đảm bảo đường mốc không tràn và CTA dễ chạm.
- Kiểm tra keyboard/focus, screen reader label, độ tương phản và `prefers-reduced-motion`.
- Kiểm tra guest, member, check-in trùng ngày, tiến độ đang làm, hoàn tất, `WAITING_BUDGET`, hết hạn và tiến độ giảm sau refund.
- Chạy unit/integration test hiện có liên quan, typecheck và build; cập nhật ảnh review sau khi người dùng chạy UI.

## Rủi ro và điểm cần giữ

- Với mục tiêu rất nhỏ, không ép hiện 5 mốc; số mốc phải co lại để không tạo checkpoint trùng nhau.
- Với chi tiêu, ngưỡng giữa là cách đọc tiến độ của một mục tiêu duy nhất; không được diễn đạt như các phần thưởng riêng.
- Lần tải đầu không có giá trị cũ để so sánh, vì vậy không phát celebration chỉ từ trạng thái đã hoàn thành có sẵn.
- Không thêm API hoặc trường response trong milestone UI. Nếu sau này muốn thưởng từng chặng, đó là yêu cầu nghiệp vụ và thiết kế backend riêng.
