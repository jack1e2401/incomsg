# Loyalty Commerce — đặc tả trải nghiệm Rive cho Member

**Trạng thái:** Bản thiết kế để duyệt · **Ngày:** 09/11/2026 · **Nguồn nghiệp vụ:** BRS v1.0 người dùng cung cấp

**Mục tiêu gần:** demo lúc 16:00, giờ Bangkok, ngày 09/11/2026

## 1. Ý định

Đưa animation tương tác định dạng `.riv` vào hành trình Member để người xem demo nhìn thấy ngay ba giá trị của hệ thống: mua hàng được tích điểm, điểm làm tăng tier, và điểm có thể đổi voucher hoặc quà. Cảm hứng là nhịp phản hồi vui, rõ và có nhân vật đồng hành như Duolingo. Theo yêu cầu mới, ưu tiên asset có sẵn trên Rive Marketplace để kịp demo; không dùng bản sao nhân vật hoặc asset Duolingo. Asset dùng lâu dài có thể được thay bằng mascot riêng sau demo.

Animation **diễn đạt trạng thái nghiệp vụ đã được backend xác nhận**. Nó không tự tính điểm, tự xếp tier, tự trừ ví hay tự quyết định voucher đã dùng. Không có phản hồi thành công trước khi API trả về thành công.

## 2. Phạm vi và quyết định đã chốt

- **Đã chốt từ BRS:** ví điểm và tier tách riêng theo từng Merchant; Member mới là Unranked; đơn đầu tiên chỉ sinh tier sau khi PAID; lần đầu tính điểm theo hệ số Bronze; tier dựa vào Lifetime Earned Points; mỗi đơn phát điểm một lần; đổi voucher trừ điểm ngay khi đổi; voucher dùng khi đơn PAID; không hoàn điểm ngược trong MVP.
- **Đã chọn cho demo:** `.riv` chỉ nằm trong hành trình Member. Merchant và Admin dùng UI thông thường.
- **Đề xuất thiết kế trong tài liệu này:** dùng một asset mascot `.riv` có sẵn, ưu tiên Interactive Beaver ở mục 6; ánh xạ các trạng thái thực có sang phản hồi nghiệp vụ và dùng CSS nhẹ cho thanh tiến độ nếu cần. Đây là lựa chọn để giữ phạm vi asset nhỏ trước 16:00; chưa phải quyết định nghiệp vụ mới.
- **Chưa có trong repo:** asset `.riv`, màn hình Member và tích hợp Rive. Frontend hiện là React + TypeScript + Vite với trang health check; backend mới là khung API. Tài liệu này là hợp đồng thiết kế, không xác nhận các chức năng đã được triển khai.

### Mục tiêu

1. Người xem hiểu một hành động đã thành công hay thất bại mà không phải đoán từ animation.
2. Ba câu chuyện demo của BRS có phản hồi thị giác nhất quán; phần Member ưu tiên mua lần đầu, nhận điểm, nâng tier, đổi voucher.
3. Không để animation làm sai số điểm, tier, trạng thái voucher hoặc thứ tự xử lý.
4. Giao diện vẫn dùng được nếu `.riv` tải lỗi, thiết bị yếu hoặc người dùng bật giảm chuyển động.

### Ngoài phạm vi đến 16:00

Animation cho Admin/Merchant; minigame, streak, nhiệm vụ hằng ngày, leaderboard, âm thanh tự phát, cá nhân hóa mascot theo từng Merchant; nội dung Rive thay thế toàn bộ màn hình checkout; tạo nhiều nhân vật hoặc nhiều bộ skin. Các ý tưởng này cần quyết định sản phẩm và thời gian sản xuất riêng.

### Điều cần tránh

Chúc mừng khi đơn vẫn PENDING; cho thấy Bronze trước đơn PAID đầu tiên; chạy hiệu ứng tăng điểm hai lần khi refresh hoặc retry; animation che nút xác nhận, số dư hay thông báo lỗi; phụ thuộc animation để hoàn tất giao dịch; dùng asset không rõ quyền sử dụng.

## 3. Các cách làm đã cân nhắc

| Cách | Lợi ích | Đánh đổi | Kết luận |
|---|---|---|---|
| Member trước: một mascot `.riv` dùng lại theo sự kiện | Đủ thấy giá trị loyalty, ít asset và ít điểm tích hợp | Merchant/Admin ít hiệu ứng | **Đã chọn** cho mốc demo |
| Member + Merchant | Dashboard Merchant sinh động hơn | Thêm trạng thái, artboard và kiểm thử | Để sau demo |
| Cả ba vai trò | Nhận diện xuyên suốt | Phân tán công sức, tăng nguy cơ demo lỗi | Không phù hợp hạn 16:00 |

Trong phạm vi Member, một file mascot nhiều trạng thái được ưu tiên hơn một file cho mỗi màn hình: dễ giữ cùng nhân vật và giảm số asset phải kiểm tra. Nếu file duy nhất trở nên nặng, tách hiệu ứng tier thành file thứ hai sau khi đo trên thiết bị demo.

## 4. Trải nghiệm Member theo màn hình

| Vị trí | Nội dung thấy được | Animation | Nguồn dữ liệu |
|---|---|---|---|
| Trang cửa hàng / hồ sơ loyalty của Merchant | Tier hoặc “Chưa xếp hạng”, Available Points, tiến độ tới tier kế tiếp | Mascot `idle`; chuyển nhẹ khi đổi Merchant | Ví của đúng cặp Member–Merchant |
| Giỏ hàng / checkout | Giá sau giảm, voucher được chọn, điểm dự kiến chỉ là ước tính nếu có hiển thị | Mascot `waiting` khi gửi thanh toán giả lập; không ăn mừng ở trạng thái PENDING | Tóm tắt đơn và phản hồi checkout |
| Kết quả PAID | Số điểm vừa cộng, số dư mới, tier cũ → mới | `earn_success`; nếu đơn đầu tiên thêm `first_purchase`; nếu vượt ngưỡng thêm `tier_up` | Phản hồi/order summary đã xác nhận từ backend |
| Kho voucher | Giá điểm, số dư hiện tại, voucher thuộc Merchant đang xem | `redeem_success` sau khi đổi thành công; `error` khi thất bại | Redemption response và wallet mới |
| Kết quả sử dụng voucher | Voucher đã dùng, số tiền giảm, đơn PAID | `voucher_used` ngắn hoặc dùng `earn_success` kèm nội dung đúng | Order PAID và trạng thái MemberVoucher |
| Reward Voucher | Quyền nhận quà và trạng thái chờ Merchant trao | `redeem_success` sau khi đổi điểm; không diễn đạt như đã nhận quà | Reward redemption response |

Các con số, tên Merchant, tên tier, lời thông báo và CTA là HTML/React. Rive đảm nhiệm nhân vật và chuyển động. Cách này giữ nội dung tiếng Việt sắc nét, dễ kiểm tra và đọc bằng công cụ hỗ trợ.

## 5. Kịch bản chuyển trạng thái

### A. Mua lần đầu

1. Trước checkout: ví Merchant hiện tại hiển thị **Unranked**, không có huy hiệu Bronze.
2. Khi gửi thanh toán: UI khóa thao tác lặp trong lúc chờ; mascot chuyển `waiting` tối đa trong thời gian request đang chạy.
3. Nếu API trả đơn `PAID` và kết quả phát điểm hợp lệ: cập nhật số điểm/tier từ backend trước, rồi chạy `earn_success` → `first_purchase`. Nội dung: “Đơn đầu tiên thành công. Bạn nhận +N điểm và đạt [tier mới].”
4. Nếu tổng điểm từ đơn đầu tiên vượt ngưỡng Silver hoặc cao hơn, hiển thị **tier thực tế backend trả về**, không ép là Bronze. Bronze vẫn là hệ số dùng để tính điểm của đơn đầu tiên theo BRS.
5. Nếu request lỗi hoặc trạng thái chưa PAID: hiển thị kết quả tương ứng; không phát hiệu ứng nhận điểm hoặc lên tier.

### B. Mua tiếp và lên tier

Sau PAID, so sánh `previousTier` và `currentTier` do backend trả về hoặc từ snapshot ví trước/sau cùng Merchant. Có tăng hạng thì phát `tier_up` **một lần** sau `earn_success`; không tăng thì dừng ở `earn_success`. Điểm hiển thị là `earnedPoints` thực nhận, không tự tính từ giá đơn trên frontend.

### C. Đổi Discount Voucher

Trước khi đổi, UI hiển thị giá điểm và Available Points. Sau khi backend trả thành công, cập nhật ví và danh sách voucher, rồi mới phát `redeem_success`. Nếu thiếu điểm, vô hiệu nút và hiển thị lý do; backend vẫn quyết định cuối cùng để xử lý hai yêu cầu đồng thời. Voucher vừa đổi thuộc Merchant hiện tại và chưa được đánh dấu Used. Checkout của đúng Merchant mới dùng được voucher đó.

### D. Đổi Reward Voucher

Phản hồi `redeem_success` xác nhận **đã sở hữu quyền nhận quà**, chưa phải đã nhận quà. Khi Merchant xác nhận trao, màn Member đổi nhãn sang “Đã nhận” theo trạng thái backend; animation mới cho bước trao quà là phần mở rộng sau demo.

### E. Đổi Merchant, tải lại trang, retry

Đổi Merchant phải tải đúng wallet/voucher của Merchant mới và đặt mascot về `idle`; không mang số dư hoặc animation còn dở của Merchant cũ sang. Tải lại trang chỉ hiện trạng thái hiện tại, không tự phát lại hiệu ứng ăn mừng. Retry request dùng kết quả nghiệp vụ cuối cùng; một giao dịch đã phát điểm không được tạo thêm hiệu ứng như một giao dịch mới.

## 6. Hợp đồng asset `.riv`

### Asset có sẵn được đề xuất

| Ưu tiên | Asset | Điều đã xác minh trên trang nguồn | Điểm cần kiểm tra sau khi tải |
|---|---|---|---|
| 1 | [Interactive Beaver — emanuelcabezas](https://rive.app/marketplace/26503-49686-interactive-beaver/) | Tác giả mô tả Idle, Waiting, Success và Data Binding; trang có nút Download, Remix và ghi CC BY 4.0 | Tên state/thuộc tính thực, kích thước file, hoạt động trong React runtime, khung hình phù hợp UI |
| 2 | [Cloud Mascot — AnggaMotion](https://rive.app/marketplace/27043-50911-rive-app-mascot-cloud-character-with-state-machine-and-6-expressions/) | Sáu biểu cảm qua state machine; tác giả ghi có file `.riv` chỉnh sửa được; CC BY 4.0 | Có đủ trạng thái chờ và thành công hay cần ánh xạ biểu cảm |
| 3 | [Cute Bunny Interactive Character — metamom_mama](https://rive.app/marketplace/25456-47507-cute-bunny-interactive-character/) | Idle, Hover, Pressed, Happy; CC BY 4.0 | Không thấy trạng thái Waiting trên mô tả; cần dùng UI loading riêng |

**Chọn Interactive Beaver cho bản demo nếu file tải được và chạy ổn trên máy demo.** Việc tìm trên web mới xác minh trang nguồn và mô tả, chưa tải file `.riv` hoặc chạy thử trong repo; không khẳng định asset có sẵn đúng toàn bộ tên state ở bảng dưới. Nếu asset đầu tiên không dùng được, chuyển Cloud Mascot, rồi Cute Bunny. Không lấy các bản tái tạo nhân vật Duolingo dù Marketplace có đăng.

Giấy phép [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) cho phép chia sẻ và sửa đổi, kể cả mục đích thương mại, với điều kiện ghi công, liên kết giấy phép và nêu thay đổi. Bản demo cần một dòng attribution ở phần Giới thiệu/credits và trong tài liệu asset, ví dụ: “Interactive Beaver © emanuelcabezas, CC BY 4.0; adapted for Loyalty Commerce” kèm liên kết tới asset và giấy phép. Không để cách ghi này ngụ ý tác giả tài trợ dự án.

**Bàn giao tối thiểu sau khi chọn:** file `.riv` tải từ Marketplace, poster/fallback (`.webp` hoặc `.png`), URL nguồn, tên tác giả, giấy phép, bảng tên state/thuộc tính thực sau khi mở file. Nếu cần sửa asset, giữ bản gốc và ghi rõ thay đổi; file nguồn chỉnh sửa được chỉ là yêu cầu nếu Marketplace cung cấp. Đặt asset ở `apps/frontend/public/rive/` khi bắt đầu tích hợp; đây là đường dẫn đề xuất, chưa tạo file.

| Hạng mục | Quy ước đề xuất |
|---|---|
| Artboard | Kiểm tra tên thực trong file; URL preview của Interactive Beaver đang ghi `Main` |
| State machine | Kiểm tra tên thực trong file; URL preview đang ghi `State Machine 1` |
| Trạng thái nền cần ánh xạ | `idle`, `waiting` |
| Phản hồi nghiệp vụ cần ánh xạ | `earn_success`, `first_purchase`, `tier_up`, `redeem_success`, `voucher_used`, `error`; có thể dùng chung một Success của asset và phân biệt bằng chữ/biểu tượng React |
| Thuộc tính từ ứng dụng | Ghi lại tên input/Data Binding thật sau khi mở file; không giả định asset có `moment`, `playId` hay `reducedMotion` |
| Kích thước | Vẽ vector để co giãn; giữ nội dung quan trọng trong vùng an toàn của khung vuông, kiểm tra ở mobile 320 px và desktop |
| Hành vi | Mỗi phản hồi một lần trở về `idle`; `waiting` lặp nhẹ và dừng khi request kết thúc |

Các tên phản hồi trên là **hợp đồng logic của ứng dụng**, không phải tên có sẵn trong file Beaver. Người tích hợp lập bảng ánh xạ từ kết quả nghiệp vụ sang state/input thực của asset sau khi tải và mở file. Có thể dùng một animation Success cho nhận điểm, nâng tier và đổi voucher, còn câu chữ và huy hiệu React phân biệt sự kiện. Theo cập nhật runtime của Rive tháng 8/2026, các API input cũ của React đã bị deprecate và Rive hướng sang Data Binding; ưu tiên Data Binding nếu asset và runtime hỗ trợ. Nếu file hiện có chỉ xuất state machine input cũ, tích hợp tạm cho demo với phiên bản runtime tương thích và ghi việc chuyển đổi sau demo.

### Nhịp chuyển động đề xuất

- `idle`: chuyển động nhỏ, chậm; không tranh sự chú ý với giá, điểm và CTA.
- `waiting`: nhịp chờ nhẹ, không ngụ ý thanh toán đã thành công.
- `earn_success`: 0,8–1,5 giây; hướng mắt về số điểm mới.
- `first_purchase` / `tier_up`: 1,5–2,5 giây, có điểm nhấn nhưng không chặn thao tác tiếp.
- `redeem_success`: 0,8–1,5 giây; thể hiện voucher/quyền nhận quà xuất hiện, không mô tả hoàn tiền.
- `error`: phản hồi ngắn, trung tính, không đổ lỗi cho Member.

Đây là mục tiêu thiết kế để kiểm thử bằng mắt, không phải điều kiện kỹ thuật cứng. Tránh chớp sáng liên tục và chuyển động lớn lặp vô hạn.

## 7. Hợp đồng dữ liệu giữa UI và animation

Ứng dụng dựng một `MemberMoment` từ **kết quả nghiệp vụ**. Không cho file `.riv` gọi API hoặc tự sửa dữ liệu. Dữ liệu tối thiểu UI cần có sau một hành động:

| Sự kiện | Trường cần cho màn hình | Điều kiện phát animation |
|---|---|---|
| Order paid | `orderId`, `merchantId`, `status`, `earnedPoints`, `availablePoints`, `previousTier`, `currentTier`, `firstPaidPurchase` | `status === PAID` và kết quả phát điểm gắn với order được xác nhận |
| Discount redemption | `redemptionId`, `merchantId`, `memberVoucherId`, `pointsSpent`, `availablePoints`, `status` | Redemption thành công và voucher đã được cấp |
| Reward redemption | `redemptionId`, `merchantId`, `rewardVoucherId`, `pointsSpent`, `fulfillmentStatus` | Redemption thành công; trạng thái trao quà vẫn là chờ |
| Voucher used | `orderId`, `memberVoucherId`, `discountAmount`, `voucherStatus` | Đơn PAID và voucher là Used |

Tên trường trên là **đề xuất cho API Contract**, không khẳng định API hiện đã có. Backend cần cung cấp đủ thông tin hoặc frontend phải lấy lại order/wallet/voucher sau mutation. `merchantId` là ranh giới bắt buộc: phản hồi của request Merchant A không được cập nhật màn Merchant B nếu người dùng đã đổi Merchant trong lúc request chạy.

Thứ tự UI: gửi request → nhận kết quả → cập nhật dữ liệu trên màn hình → chạy animation một lần theo `orderId`/`redemptionId`. Nếu kết quả đến muộn khi đã rời màn, lưu trạng thái thật; không ép mở lại animation. Animation không phải bằng chứng giao dịch.

## 8. Khả dụng, hiệu năng và fallback

- Luôn có chữ, số và trạng thái HTML cho điểm, tier, voucher, lỗi. Mascot trang trí dùng mô tả hỗ trợ phù hợp hoặc ẩn khỏi cây accessibility nếu thông tin đã có bằng chữ.
- Tôn trọng `prefers-reduced-motion`: hiện poster/trạng thái tĩnh hoặc chuyển động tối thiểu; không tự chạy chuỗi ăn mừng dài.
- Asset tải lỗi: hiện poster, giữ toàn bộ nút và luồng mua/đổi; ghi lỗi kỹ thuật để xử lý, không báo giao dịch thất bại chỉ vì Rive lỗi.
- Chỉ tải asset ở khu vực Member có dùng; không bắt Admin/Merchant tải runtime. Tạm dừng hoặc bỏ animation ngoài viewport/tab ẩn khi có thể.
- Đo file `.riv` xuất cuối cùng và thử trên máy, trình duyệt, mạng dùng để demo. Chưa đặt ngân sách KB/FPS cứng khi chưa có asset mẫu và thiết bị mục tiêu; nếu lag, ưu tiên cắt hiệu ứng phụ trước.
- Không để animation phủ lên nút, hộp thoại hoặc thông báo lỗi. Mọi thao tác chính dùng nút HTML có nhãn rõ ràng.

## 9. Ưu tiên sản xuất cho buổi demo

| Mức | Cần xong | Minh chứng khi demo |
|---|---|---|
| P0 | Một mascot `.riv` với `idle`, `waiting`, `earn_success`, `tier_up` và poster fallback | Đơn PAID làm số điểm tăng và mascot phản hồi; tier mới đúng backend |
| P0 | Luồng Unranked → đơn đầu tiên → tier | Trước PAID không có tier; sau PAID có tier thực tế |
| P1 | `redeem_success` cho Discount Voucher và Reward Voucher | Số dư trừ đúng một lần; voucher mới xuất hiện đúng Merchant |
| P1 | Trạng thái lỗi và giảm chuyển động | Lỗi không ăn mừng; tắt motion vẫn dùng được |
| P2 | `voucher_used` riêng, nhiều biểu cảm, âm thanh, skin theo tier | Làm sau khi P0/P1 ổn |

Nếu không đủ thời gian ánh xạ nhiều trạng thái, một file `.riv` có `Idle` + `Success` đã có giá trị demo: dùng Success sau PAID và sau đổi voucher thành công, còn tier và số điểm diễn đạt bằng chữ/huy hiệu React. Các bước khác vẫn hiển thị bằng text và poster; không dùng animation để ngụ ý giao dịch thành công khi backend chưa xác nhận.

### Kịch bản demo đề xuất

1. Mở Member mới tại Merchant A: thấy Unranked và ví của A.
2. Mua hàng đầu tiên, thanh toán giả lập: khi PAID, thấy `+N` điểm và tier mới, mascot ăn mừng.
3. Mua thêm bằng dữ liệu seed đủ vượt ngưỡng: thấy tiến độ và `tier_up`.
4. Đổi Discount Voucher: thấy điểm bị trừ, voucher vào kho; dùng nó ở checkout của A.
5. Chuyển sang Merchant B: ví/tier/voucher khác; không dùng được voucher của A.
6. Nếu có thời gian, đổi Reward Voucher và cho thấy trạng thái chờ trao quà.

Không cần trình diễn Admin/Merchant bằng Rive. Tài liệu này chỉ quy định phần animation Member; nếu buổi demo chứng minh toàn hệ thống, chức năng Admin/Merchant vẫn phải theo BRS v1.0 và cần kế hoạch triển khai riêng. Repo hiện chưa có các màn hình đó, vì vậy không thể xem tài liệu này là xác nhận demo toàn BRS đã sẵn sàng.

## 10. Tiêu chí nghiệm thu bổ sung cho Rive

| ID | Điều kiện kiểm tra |
|---|---|
| RIV-01 | Member mới ở mỗi Merchant thấy Unranked, mascot không tự hiện huy hiệu tier. |
| RIV-02 | Chỉ đơn PAID mới phát `earn_success`; `PENDING`/lỗi không phát. |
| RIV-03 | Điểm và tier hiển thị trùng dữ liệu backend; đơn đầu tiên dùng hệ số Bronze, tier sau đơn có thể cao hơn Bronze. |
| RIV-04 | `tier_up` chỉ phát khi tier thực tế tăng, không phát lại khi refresh. |
| RIV-05 | Đổi voucher thành công mới phát `redeem_success`; thiếu điểm hoặc hai request tranh chấp không tạo animation thành công giả. |
| RIV-06 | Chuyển Merchant không rò điểm, tier, voucher hay animation của Merchant trước. |
| RIV-07 | Một order/redemption chỉ tạo một lần phản hồi thành công trên cùng phiên UI dù retry/refetch. |
| RIV-08 | File `.riv` lỗi hoặc bật giảm chuyển động: nghiệp vụ và thông tin vẫn dùng được. |
| RIV-09 | Reward Voucher sau đổi được mô tả là quyền nhận quà; không hiện “đã nhận” trước xác nhận của Merchant. |
| RIV-10 | Asset bàn giao có file `.riv`, poster, URL nguồn, attribution CC BY 4.0 và bảng ánh xạ state/input thực. |

## 11. Việc còn lại cho người triển khai

1. Tải Interactive Beaver từ Rive Marketplace, mở thử và ghi bảng ánh xạ state/input thực; chuyển ứng viên dự phòng nếu file không chạy ổn. Tạo poster tĩnh từ asset theo giấy phép.
2. Xác minh runtime React phù hợp với file xuất và cách điều khiển mà asset hỗ trợ trên thiết bị demo; khóa phiên bản trong dự án.
3. Hoàn thiện API Contract cho các trường sự kiện ở mục 7; bảo toàn các acceptance criteria BRS ở backend.
4. Xây màn Member và trình điều phối animation theo `merchantId` + `orderId`/`redemptionId`.
5. Chuẩn bị dữ liệu seed và tập dượt toàn bộ kịch bản mục 9 trước 16:00.

### Những lựa chọn mình tự đề xuất, cần bạn duyệt cùng tài liệu

Một asset mascot có sẵn (Interactive Beaver nếu kiểm tra đạt); một file `.riv` chính; chữ/số do React render; ánh xạ state/input thực sau khi tải; chỉ phát animation sau xác nhận backend; ưu tiên P0/P1 ở mục 9. Không thay đổi quy tắc BRS v1.0.

### Tài liệu Rive tham chiếu

- [Rive — Character Animation](https://rive.app/use-cases/character-animation): file `.riv`, state machine và kết nối dữ liệu nhân vật.
- [Rive — Features](https://rive.app/features): Data Binding, State Machines, Events và khả năng của runtime React.
- [Rive Runtime Updates, 31/08/2026](https://community.rive.app/c/announcements/rive-runtime-updates-august-31-2026): các API input React/Web cũ bị deprecate, hướng sang Data Binding.
- [Rive — Making designs more visually accessible](https://rive.app/blog/making-rive-designs-more-visually-accessible): lưu ý về giảm chuyển động, nhấp nháy và khả dụng.
