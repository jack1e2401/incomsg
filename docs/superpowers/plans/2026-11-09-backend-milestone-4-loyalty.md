# Backend Milestone 4 — Loyalty Wallet + Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi Member có ví và tier riêng tại từng Merchant; đơn PAID phát điểm đúng một lần.

**Architecture:** Tách tính điểm thuần khỏi giao dịch ghi dữ liệu. Service thanh toán M3 gọi một hàm hoàn tất đơn dùng transaction Prisma chung với chuyển trạng thái PAID, tạo membership/wallet, ledger và cập nhật tier. M6 phải tái sử dụng hàm này cho IPN.

**Tech Stack:** Express 5, TypeScript ESM, Prisma 7, MySQL, `node:test` + `tsx`.

**Spec:** BR.md tại `C:/Users/ACER/Downloads/BR.md` (BR-02–05, AC-02–05, AC-08) và [M3 plan](./2026-11-09-backend-milestone-3.md).

## Global Constraints

- Phụ thuộc M3 đã triển khai và test xanh: `POST /api/orders`, `POST /api/orders/:orderId/pay` và Catalog chạy thật.
- Không thay đổi đơn PAID cũ hoặc tính lại điểm khi Merchant đổi cấu hình. Tiền VND là Decimal/string ở biên HTTP; điểm là số nguyên không âm.
- Unranked là `MerchantMembership.tierId=null`. Đơn đầu dùng hệ số Bronze trước khi xếp tier. Tier dựa trên lifetime, không dựa trên available.
- Ước lượng 45–75 phút là mục tiêu khi M3, MySQL và môi trường test đã sẵn sàng; nếu còn làm M3 hoặc migration thì tính riêng.

## Review Focus

1. Hai request pay cùng đơn chỉ có một `PointTransaction` và một lần tăng ví.
2. Member chưa mua tại Merchant B vẫn Unranked dù đã mua tại A.
3. Đơn có `total < vndPerPoint` vẫn PAID và Bronze với 0 điểm.
4. Cấu hình lỗi (ngưỡng đảo chiều, hệ số không dương, `vndPerPoint <= 0`) bị từ chối trước khi ghi.
5. Đọc lịch sử và ví của Member khác hoặc Merchant khác không lộ dữ liệu.

---

## File map

| File | Trách nhiệm |
| --- | --- |
| `src/modules/loyalty/loyalty.calculation.ts` | `calculateEarnedPoints(totalVnd: Decimal, vndPerPoint: number, multiplier: Decimal): number`; chọn tier từ lifetime |
| `src/modules/loyalty/loyalty.{repository,service,controller,routes}.ts` | Cấu hình của Merchant, ví/lịch sử của Member, hàm phát điểm trong transaction |
| `src/modules/orders/orders.repository.ts`, `orders.service.ts` | Gọi hoàn tất thanh toán chung trong cùng transaction |
| `src/app.ts`, `tests/backend/integration/milestone-4.integration.test.ts` | Router và nghiệm thu HTTP + MySQL |
| `prisma/seed.ts` | Seed rule và bốn tier mặc định cho Merchant demo nếu seed hiện có Merchant; không tự cấp ví/tier cho Member |

### Task 1 — Cấu hình loyalty và công thức

**Interfaces:** `getConfig(merchantId: number): Promise<LoyaltyConfigDto>` và `saveConfig(ownerId: number, input: {vndPerPoint: number; isActive: boolean; tiers: {level: TierLevel; minLifetimePoints: number; multiplier: string}[]}): Promise<LoyaltyConfigDto>`. DTO có đúng bốn tier BRONZE/SILVER/GOLD/PLATINUM. Mặc định `vndPerPoint=10000`, ngưỡng `0,1000,5000,10000`, hệ số `1.00,1.20,1.50,2.00`. Merchant active mới sửa được; chỉ cấu hình tương lai.

- [ ] Viết test công thức: `180000 / 10000` với Silver `1.20` cho `21`; đơn đầu `200000` dùng Bronze cho `20`; dưới `10000` cho `0`; tier tại lifetime `999,1000,5000,10000`. Chạy `npm test`, xác nhận đỏ.
- [ ] Viết test HTTP Merchant A sửa config của mình, Merchant B không sửa được; body thiếu tier, ngưỡng không tăng, multiplier không dương hoặc số thập phân sai định dạng nhận `400 INVALID_INPUT`. Chạy `npm exec -w apps/backend -- tsx --test ../../tests/backend/integration/milestone-4.integration.test.ts`, xác nhận đỏ.
- [ ] Tạo module và route `GET/PUT /api/merchant/loyalty` với role MERCHANT, lấy Merchant qua owner active. Dùng `prisma.$transaction` để upsert rule/tier đồng bộ; không cho xóa tier đang được membership tham chiếu. `GET` trả cấu hình đã lưu hoặc mặc định rõ ràng, không âm thầm tạo ví.
- [ ] Chạy hai suite trên, `npm run build`; mong đợi exit 0. Commit `feat: configure merchant loyalty rules`.

### Task 2 — Phát điểm khi thanh toán và đọc ví

**Interfaces:** `completePaidOrder(tx: Prisma.TransactionClient, orderId: number, memberId: number): Promise<OrderDto>` là hàm duy nhất đổi PENDING→PAID và phát điểm; M6 gọi lại cùng hàm sau khi xác minh IPN. `getWallet(memberId: number, merchantId: number): Promise<{merchantId: number; availablePoints: number; lifetimeEarnedPoints: number; tier: TierLevel | "UNRANKED"; transactions: PointTransactionDto[]}>`. `PointTransactionDto` gồm `id,type,delta,balanceAfter,reason,orderId,memberVoucherId,createdAt`.

- [ ] Viết integration test: ví chưa mua trả zero/UNRANKED; pay đơn đầu tạo membership và wallet riêng Merchant A, ledger EARN gắn order; trả tiền lần hai và hai pay song song chỉ một EARN; Merchant B vẫn zero/UNRANKED; đơn nhỏ có 0 điểm vẫn thành Bronze. Chạy test, xác nhận đỏ.
- [ ] Trong cùng DB transaction, khóa thứ tự bằng chuyển trạng thái có điều kiện `PENDING→PAID`; chỉ request thắng được tạo membership/wallet và ledger. Dùng unique `PointTransaction.orderId` làm chốt chống phát trùng; lỗi transaction rollback cả PAID. Tính trên `Order.total`, snapshot hệ số hiện hành, cộng available/lifetime và gán tier mới. Mọi cập nhật wallet phải an toàn khi các đơn khác nhau của cùng Member/Merchant hoàn tất đồng thời (atomic increment/row lock và tính tier từ lifetime cuối cùng).
- [ ] Gắn `GET /api/member/merchants/:merchantId/wallet` sau auth MEMBER; lọc theo user từ token, xếp lịch sử `createdAt desc,id desc`, chỉ trả ví của Merchant này. Dùng `404` cho Merchant không active/không tồn tại, không lộ user ID qua body.
- [ ] Chạy `npm test`, `npm run test:db`, `npm run build`, `git diff --check`; mong đợi exit 0. Commit `feat: award merchant scoped points on paid orders`.

**Exit gate:** AC-02–05 và AC-08 qua HTTP test; response PAID và ví khớp sau request đồng thời.
