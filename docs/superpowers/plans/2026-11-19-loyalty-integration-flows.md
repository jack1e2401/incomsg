# Kế hoạch hoàn thiện các luồng Loyalty của IncomSG

**Mục tiêu đầu tiên** — Đến cuối ngày 22/11/2026, trên MySQL local, một giao dịch từ website đối tác có thể cộng điểm vào đúng ví đang dùng trên IncomSG. Gửi lại giao dịch trả về cùng kết quả. Merchant và member tra được bút toán qua các màn hình hiện có.

**Phạm vi** — Theo brief IncomSG Platform ngày 19/11 và mã nguồn tại `49413b2`. Platform quản lý danh tính, merchant và phân quyền. Commerce xác nhận sự kiện tài chính. Loyalty sở hữu membership, quy tắc điểm, ledger, hạng, nhiệm vụ và phần thưởng. “Mission” trong brief tương ứng với `Challenge` hiện có. Tiếp tục dùng Express, Prisma, MySQL và React trong hai workspace. Cây thư mục trong brief là đích tổ chức dài hạn.

**Lịch đề xuất** — Cuối tuần 21–22/11 là bản thử trên local. Sáu tuần tiếp theo đưa tích hợp vào thử nghiệm với một đối tác, rồi mới thêm AI Analytics. Mỗi ô dưới đây là một đầu việc có thể nghiệm thu. Các tên API và bảng mới là đề xuất để hai phía chốt trước khi code.

## Điểm xuất phát

| Luồng | Đã thấy trong repo | Việc cần làm |
|---|---|---|
| Đơn nội bộ → ví → hạng | `modules/payments/payments.repository.ts` và `modules/orders/orders.repository.ts` gọi `modules/loyalty/loyalty.earning.ts#completePaidOrder`. Hàm này còn chốt đơn, tồn kho, voucher và phí. VNPay giữ chỗ điểm và đóng băng điều kiện tính điểm khi tạo payment attempt. | Đặt điều phối đơn về Commerce và đưa phần tác động Loyalty sau một interface. Bảo toàn luồng mock, đơn 0 đồng, IPN và payment attempt cũ. |
| Hoàn tiền → đảo điểm và tiến độ | `modules/orders/orders.refund.repository.ts#completeMockRefund` dùng điểm chính xác của đơn gốc, khôi phục voucher và gọi `reverseOrderChallenges`. Nhánh VNPay thành công bị chặn tại đây. | Tách tác động Loyalty của một lần hoàn đã xác nhận. Giữ luồng chờ nhà cung cấp, kể cả khi merchant đã duyệt yêu cầu. |
| Ledger, nhiệm vụ, voucher | `PointTransaction.eventRef` và `MemberActivity.eventKey` đã unique. Earning, challenge grant/reversal và voucher redeem/cancel đang tự ghi ví và ledger ở nhiều nơi. Các route merchant/member cho ví, giao dịch, chiến dịch đã có. | Dùng chung thao tác ghi ví và bút toán trong transaction. Giữ logic riêng về budget, tồn kho, fulfillment, lifetime và reservation. |
| Đối tác và analytics | `apps/backend/src/app.ts` đã mount API merchant analytics và challenges. `analytics.service.ts` hiện chủ yếu đọc order, sản phẩm, inventory và membership. Schema hiện tại chưa có receipt của event đối tác hoặc mapping external customer. | Thêm cổng nhận sự kiện, sau đó xây truy vấn KPI Loyalty và dùng lại cho UI lẫn AI. |

Các đường dẫn `modules/…` bên trên nằm dưới `apps/backend/src`. Mốc kiểm thử có sẵn gồm `tests/backend/integration/exact-points.integration.test.ts`, `milestone-6.integration.test.ts`, `milestone-3-4-lifecycle-refund.integration.test.ts` và `v4-challenges-and-refunds.integration.test.ts` trong cùng thư mục.

## Hợp đồng giữa Commerce, đối tác và Loyalty

| Event v1 | Dữ liệu nghiệp vụ tối thiểu | Kết quả đã commit |
|---|---|---|
| `purchase.confirmed` | Mã giao dịch ổn định của nguồn, thời điểm xác nhận, số VND ròng sau giảm giá dạng chuỗi nguyên, hội viên đã ánh xạ. Adapter nội bộ mang theo snapshot/reservation hiện hành khi có. | Điểm chính xác theo policy, tiến độ nhiệm vụ đủ điều kiện, hạng sau cùng và tham chiếu bút toán. |
| `purchase.refunded` | Mã lần hoàn, mã giao dịch gốc cùng nguồn, số VND đã hoàn và thời điểm hoàn tất. | Đảo theo lần earn và các đóng góp nhiệm vụ gốc. Hoàn toàn phần là phạm vi pilot đề xuất. |
| `mission.action.completed` | Mã hành động được merchant đăng ký, mã lần thực hiện ổn định, thời điểm và hội viên đã ánh xạ. | Ghi một activity đã xác minh. Challenge engine xét hiệu lực, mục tiêu và ngân sách để cập nhật tiến độ, phát thưởng hoặc hiển thị chờ ngân sách. |

Đề xuất API nhận webhook vào là `POST /api/integrations/loyalty/v1/events`. Ví dụ body cho bản thử dưới đây dùng các mã minh họa và cần một mapping hợp lệ trước khi gửi.

```json
{
  "version": 1,
  "type": "purchase.confirmed",
  "eventId": "evt-1842",
  "occurredAt": "2026-11-22T03:00:00Z",
  "externalCustomerId": "customer-42",
  "data": { "purchaseRef": "sale-1842", "netAmountVnd": "6000", "currency": "VND" }
}
```

Adapter lấy merchant và nguồn từ credential của integration, tra mapping sang membership rồi gọi cùng `applyLoyaltyEvent(tx, event)` như Commerce. Kiểu nội bộ chỉ nhận event đã chuẩn hóa. Kết quả gồm receipt, tham chiếu giao dịch, delta điểm chính xác dạng chuỗi và tác động đã ghi. Commerce tiếp tục trả DTO order/payment/refund hiện có. Với giao dịch ngoại, `orderId` để null và activity cùng bút toán truy ngược được về receipt.

**Quyết định nghiệp vụ cần chốt**

- Trước khi tính điểm thật của đối tác, Loyalty owner và merchant chọn thời điểm lấy policy, quy tắc cho giao dịch đến muộn và nguồn nào được quyền báo mỗi giao dịch. Bản thử dùng một nguồn, một policy cố định và hai kênh bán có tập đơn rời nhau. Nếu cùng đơn đi qua hai kênh, cần mã giao dịch chuẩn chung hoặc chỉ định một nguồn có thẩm quyền trước khi bật cả hai.
- Trước pilot refund, Commerce và đối tác xác nhận tín hiệu nào chứng minh đã hoàn tiền. Nếu có hoàn một phần, chốt quy tắc phân bổ delta, làm tròn lũy kế và xử lý thưởng nhiệm vụ. Cho tới khi có quy tắc, API từ chối yêu cầu hoàn một phần với mã lỗi rõ ràng và giữ nguyên sổ.
- Trước nhiệm vụ ngoài, merchant xác nhận bằng chứng hợp lệ, cách đếm hành động lặp và xử lý hủy hành động. Với referral cần chốt người nhận thưởng, điều kiện chuyển đổi và tự giới thiệu. Giữ các loại chưa duyệt ở trạng thái chưa kích hoạt.

## Thứ Bảy 21/11 · Giữ một đơn thanh toán và một lần ghi nhận Loyalty

- [ ] **Chụp hành vi hiện tại.** Chạy các suite hiện có trên test DB local đã migrate. Lập bảng caller → transaction → tác động cho mock paid, đơn 0 đồng, VNPay IPN thành công/thất bại và hoàn mock. Dùng hai đơn cho cùng hội viên, mỗi đơn sinh 0,6 điểm. Đối chiếu số dư 1,2, số dùng được 1, carry 0,2 và đúng hai bút toán earn. Nếu đã lệch trước refactor, sửa và xác minh sai lệch trước khi mở API ngoài.
- [ ] **Chốt contract nội bộ cho confirm và refund.** Thêm `apps/backend/src/contracts/commerce-events.ts` và `apps/backend/src/modules/loyalty/loyalty.events.ts`. Đưa điều phối `completePaidOrder` sang `apps/backend/src/modules/orders/orders.settlement.ts`. Commerce sở hữu order, inventory, phí và điều phối sử dụng voucher qua nghiệp vụ voucher. Loyalty nhận số tiền, identity, thời điểm, nguồn và điều kiện tính điểm. Commerce lưu snapshot kết quả vào order. Adapter hoàn truyền tác động gốc đã lưu kể cả với đơn trước migration.
- [ ] **Tách thao tác ghi sổ cho đường đang dùng.** Tạo `apps/backend/src/modules/loyalty/loyalty.ledger.ts` nhận transaction, ví đúng membership, delta balance/lifetime, source, eventRef và liên kết nghiệp vụ. Giữ Decimal 12 chữ số, HALF_UP, giới hạn/reservation, cập nhật có điều kiện và retry toàn transaction. Chuyển earning, rồi reversal của đơn. Giữ `order-earn-<id>`, các tham chiếu cũ và hành vi zero earn. Engine nhận dữ kiện mua hàng từ adapter. Lõi Loyalty không truy vấn Order/PaymentAttempt hay import DTO Commerce.
- [ ] **Nghiệm thu.** Hai IPN thành công đồng thời chỉ tạo một lần earn, một activity cho đơn, một tác động phí và tồn kho. IPN thất bại/return URL không cộng điểm. Mô phỏng lỗi sau khi bắt đầu ghi ví phải rollback cả đơn và ví. Đơn cũ hoàn sau nâng cấp đảo đúng delta gốc. Kiểm tra cả policy snapshot, release reservation, voucher và response cũ. Commit ranh giới thanh toán sau khi các test này xanh. Nếu hết ngày mới đạt confirm, hoàn thiện refund nội bộ ở tuần 1 và công bố rõ phạm vi demo.

## Chủ nhật 22/11 · Một website ngoài tích điểm được vào ví thật trên local

- [ ] **Migration bổ sung.** Trong `apps/backend/prisma/schema.prisma` và `apps/backend/prisma/migrations/`, thêm integration thuộc merchant, mapping unique theo integration + externalCustomerId, và receipt unique theo integration + eventId. Ràng buộc nghiệp vụ riêng theo integration + loại + mã giao dịch/lần thực hiện. Khóa ghi ổn định theo integration kể cả khi xoay credential. Receipt giữ fingerprint dữ liệu chuẩn hóa, membership, tham chiếu gốc, snapshot và kết quả đã áp dụng. Bổ sung nguồn ledger đối tác, liên kết nullable cho history hiện có và kiểm tra kích thước các khóa. Không backfill bằng cách phát lại đơn đã trả.
- [ ] **Xác thực và ánh xạ.** Tạo `apps/backend/src/modules/loyalty/integrations/external-events.routes.ts` và `customer-mapping.ts`, mount route trong `app.ts`. POC dùng credential server-to-server riêng cho integration, chỉ lưu hash token, có thể thu hồi. Tạo credential và mapping local cho membership đã xác minh qua bước thiết lập quản trị cục bộ. Kiểm tra membership thuộc đúng merchant ở cả bước tạo mapping và bước ingest. Thiếu mapping trả mã lỗi để người vận hành xử lý. Không đoán danh tính qua email hoặc cho payload tự chọn ví.
- [ ] **Nhận `purchase.confirmed`.** Validate version, event type, định dạng thời gian, ID và giới hạn VND trước khi gọi service. Ghi receipt và toàn bộ tác động trong một transaction. Đề xuất 201 khi mới ghi, 200 và cùng receipt khi retry giống hệt, 409 khi tái dùng khóa với dữ liệu khác, 422 khi sai schema/chưa map, 401 khi key sai hoặc bị thu hồi. Event ID mới cho cùng giao dịch cũng phải được so bằng nội dung nghiệp vụ và chỉ có một lần earn. Sự kiện chưa hỗ trợ trả lỗi tường minh.
- [ ] **Demo cuối ngày bằng Postman và UI.** Với policy test 10.000 VND/điểm, hệ số 1 và ví 0, gửi mẫu 6.000 VND → ví 0,6. Gửi lại cùng payload, rồi cùng purchaseRef với eventId khác → vẫn 0,6 và một earn. Gửi giao dịch thứ hai 6.000 VND → ví 1,2. Member refresh ví, merchant đọc lịch sử. Kiểm tra không phát sinh Order, PaymentAttempt, phí hoặc tồn kho. Lặp với key sai, mapping thiếu và merchant B có cùng externalCustomerId. Lưu kết quả vào test mới `tests/backend/integration/external-loyalty-events.integration.test.ts`. Commit bản thử riêng sau xác minh.

## Sáu tuần sau bản thử

| Mốc | Phần triển khai và nơi sửa | Điều kiện hoàn tất |
|---|---|---|
| **Tuần 1 · 23–29/11. Hoàn thiện ledger và vòng đời giao dịch** | Chuyển các lần ghi ví còn lại trong `challenges.engine.ts` và `vouchers.repository.ts` sang ledger chung, từng luồng một. Thêm refund đối tác vào service sự kiện. Tra purchase theo merchant, nguồn và membership, đối chiếu số tiền, đảo delta/snapshot gốc và tiến độ đã đóng góp. Với refund đến trước purchase, trả lỗi có thể retry và ghi audit, cho phép gửi lại sau khi purchase đã commit. | Gửi hai refund đồng thời cho cùng một lần hoàn chỉ đảo một lần. Khi đã tiêu điểm, ví thể hiện đúng debt/carry, hạng theo lifetime sau đảo. Grant chỉ đảo nếu tụt dưới ngưỡng theo hành vi hiện có. Redeem và hủy reward bảo toàn lifetime, voucher, tồn kho và fulfillment. Đơn nội bộ cũ vẫn hoàn được. |
| **Tuần 2 · 30/11–06/12. Merchant vận hành tích hợp** | Trong `modules/loyalty/integrations/` và trang Loyalty của merchant, thêm cấp/thu hồi/xoay key, liên kết khách hàng đã xác minh, tra kết quả theo receipt và sửa mapping thiếu để đối tác gửi lại. Tách quyền cấu hình khỏi quyền gửi event. Bổ sung giới hạn lưu lượng, audit tối thiểu và hướng dẫn request/retry cho đối tác ở `docs/backend`. | Merchant A tự cấu hình một nguồn, trace được giao dịch tới bút toán. Merchant B không xem/đổi mapping hoặc receipt của A. Sau xoay key, event cũ vẫn không cộng lại. Timeout sau commit rồi retry vẫn trả đúng kết quả. Mapping đổi không chuyển lịch sử sang ví khác. |
| **Tuần 3 · 07–13/12. Nhiệm vụ ngoài từ cấu hình đến nhận thưởng** | Bổ sung loại hành động ngoài vào schema, validation và engine `modules/challenges`. Mở `mission.action.completed` cho nguồn và action đã đăng ký của merchant. Thêm lựa chọn tương ứng tại `features/merchant/challenges` và hiển thị tiến độ qua `features/challenges`. Dùng lại grant, cycle, budget và hàng đợi hiện hành. | Merchant cấu hình chiến dịch và kích hoạt. Hai callback cho cùng hành động chỉ tăng một lượt. Sai nguồn, sai merchant hoặc ngoài kỳ không tăng tiến độ. Đủ mục tiêu nhận thưởng một lần. Hết ngân sách hiện `WAITING_BUDGET`, bổ sung ngân sách chỉ phát đúng một grant, refresh member thấy kết quả đã lưu. |
| **Tuần 4 · 14–20/12. Pilot với một đối tác** | Dùng các khóa, mapping, receipt và nhật ký ở tuần 2 để chạy chuỗi mua → nhiệm vụ → đổi voucher/quà → hoàn. Đối soát theo mã giao dịch của hai phía. Nếu đối tác cần tracking link/referral, tạo mã gắn nguồn, liên kết lượt chuyển đổi đã xác minh với activity. Click chỉ là dữ liệu theo dõi. Webhook **gửi ra** là hạng mục có điều kiện nếu đối tác cần thông báo kết quả bất đồng bộ, khi đó ghi outbox cùng transaction và retry theo delivery ID. | Hai phía đối soát được từng purchase/refund, tổng earn/reversal và các chênh lệch mapping. Dừng pilot bằng thu hồi key mà lịch sử còn tra được. Với referral được duyệt, kiểm tra self-referral, callback lặp và sai merchant theo policy đã chốt. |
| **Tuần 5 · 21–27/12. Báo cáo Loyalty dùng được trước AI** | Thêm `modules/loyalty/analytics/loyalty-analytics.service.ts`. Dùng lại quyền merchant và bộ lọc thời gian của analytics hiện tại. Trả số liệu tổng hợp theo merchant/kỳ từ ledger, progress và grant. Chốt định nghĩa với merchant cho điểm phát hành, đảo, đã đổi, số hội viên đạt mục tiêu, đã thưởng và chờ ngân sách. | Với bộ dữ liệu có hai merchant, một lần hoàn và một lần hủy đổi thưởng, merchant chọn kỳ trên trang analytics và đối soát được từng KPI với query nguồn. Thống nhất múi giờ, khoảng đầu bao gồm/cuối loại trừ, ngày không phát sinh và cách trình bày số âm. |
| **Tuần 6 · 28/12–03/01/2027. AI Analytics qua tool calling** | Thêm tool chỉ đọc như `getLoyaltySummary(range)` và `getChallengePerformance(challengeId, range)` dưới `modules/loyalty/ai/`. Backend gắn merchant từ phiên, validate tham số rồi gọi service tuần 5. Merchant hỏi trên trang analytics. Câu trả lời kèm kỳ báo cáo, thời điểm dữ liệu và số do tool trả về. | Hỏi “Tuần này có bao nhiêu hội viên đạt mục tiêu nhưng chưa nhận thưởng?” và so câu trả lời với báo cáo cùng kỳ. Kiểm tra merchant khác, kỳ trống và tool lỗi. Khi thiếu dữ liệu, UI thể hiện lý do. AI không có quyền ghi ví, cấp thưởng, đổi policy hay chạy SQL tùy ý. |

## Kiểm tra và bàn giao từng mốc

- [ ] Viết test hành vi trước khi thay đường ghi. Chạy `npm test`, `npm run typecheck` và `npm run build` từ root. Với migration/transaction, chạy `npm run test:db` trên MySQL **test local** đã migrate. Kiểm tra migration cả trên dữ liệu cũ có payment attempt và receipt/order mới. Với lỗi migration, giữ dữ liệu, chẩn đoán trước khi thử lại.
- [ ] Với màn hình thay đổi, chạy `npm run dev`, dùng Orca nếu có để đăng nhập merchant và member trên frontend nối API thật, thử luồng thành công và một lỗi phân quyền/validation, refresh và đối chiếu ví, ledger, activity/grant. Nếu Orca không khả dụng, ghi blocker và dùng API/integration; chỉ dùng `npm run test:e2e` làm browser fallback khi phù hợp.
- [ ] Trước khi mở cho đối tác thật, xác nhận chính sách ở trên, credential qua HTTPS, khóa riêng cho từng nguồn, quy trình thu hồi và đối soát. Có thể khóa ingest của một integration mà không ảnh hưởng thanh toán nội bộ. Nếu tạm dừng phát hành, giữ receipts, khóa chống trùng và bút toán đã commit để chạy tiếp an toàn.
- [ ] Mỗi lát cắt đã chạy độc lập có một commit chọn lọc, kèm test đã chạy, kết quả đối soát và điểm còn mở. Điều kiện chuyển sang AI là pilot đối soát được và API analytics cho kết quả lặp lại trên cùng dữ liệu.
