# Backend Milestone 5 — Discount + Reward Voucher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member đổi điểm lấy voucher giảm giá hoặc quyền nhận quà; mỗi thay đổi điểm và trạng thái voucher được ghi một lần, đúng Merchant.

**Architecture:** VoucherDefinition là mẫu Merchant quản lý; MemberVoucher là bản cấp riêng cho Member. Redemption ghi ledger, trừ ví và cấp voucher trong một DB transaction. Checkout chốt giảm giá trên đơn PENDING; chỉ hàm hoàn tất PAID của M4 chuyển Discount Voucher sang USED. Reward được Merchant xác nhận bằng transaction riêng.

**Tech Stack:** Express 5, TypeScript ESM, Prisma 7, MySQL, `node:test` + `tsx`.

**Spec:** BR.md tại `C:/Users/ACER/Downloads/BR.md` (BR-02, BR-05–08, AC-04–07, AC-09–12); [M4 plan](./2026-11-09-backend-milestone-4-loyalty.md).

## Global Constraints

- Phụ thuộc M3 buy now và M4 wallet/pay transaction. M3 chỉ cho một OrderItem: giữ giới hạn đó; không mở rộng giỏ hàng trong milestone này.
- Mỗi đơn tối đa một Discount Voucher. Không hết hạn, không hoàn điểm, không đổi ngược. Mẫu có thể bật/tắt; voucher đã cấp vẫn thuộc Member và Merchant ban đầu.
- Reward Voucher là quyền nhận quà, không giảm tổng đơn. `AVAILABLE` nghĩa chờ trao; `FULFILLED` sau Merchant xác nhận. FE có thể hiển thị `PENDING_FULFILLMENT` như nhãn dẫn xuất.
- Ước lượng 45–70 phút chỉ hợp lý khi M3/M4 và database test đã chạy ổn; xử lý contention/IPN có thể cần thêm thời gian.

## Review Focus

1. Hai redemption song song khi chỉ đủ điểm cho một lần: một thành công, một `409 INSUFFICIENT_POINTS`, ví không âm.
2. Mẫu DISCOUNT không được dùng như REWARD và ngược lại; voucher thuộc Merchant khác bị từ chối.
3. Cùng MemberVoucher không thể gắn vào hai đơn PENDING hoặc dùng hai lần.
4. Pay thất bại không đánh dấu voucher USED; pay thành công cập nhật voucher và EARN cùng transaction.
5. Merchant B không thể tạo/sửa/xác nhận voucher của Merchant A; Member khác không xem được voucher đã cấp.

---

## File map

| File | Trách nhiệm |
| --- | --- |
| `src/modules/vouchers/vouchers.{routes,controller,service,repository}.ts` | Mẫu voucher, danh sách của Member, redeem, fulfillment |
| `src/modules/orders/orders.{service,repository}.ts` | Gắn Discount Voucher lúc tạo PENDING; hoàn tất USED trong pay transaction |
| `src/modules/loyalty/loyalty.repository.ts` | Hàm trừ điểm có điều kiện và ghi ledger `memberVoucherId` |
| `src/app.ts`, `tests/milestone-5.integration.test.ts` | Gắn router, nghiệm thu HTTP + MySQL |

### Task 1 — Mẫu voucher của Merchant

**Interfaces:** `createDefinition(ownerId: number, input: DefinitionInput): Promise<DefinitionDto>`, `updateDefinition(ownerId: number, id: number, patch: DefinitionPatch): Promise<DefinitionDto>`, `listDefinitions(merchantId: number, activeOnly: boolean): Promise<DefinitionDto[]>`. `DefinitionInput={type:"DISCOUNT"|"REWARD";title:string;pointsCost:number;discountAmount?:string;rewardDescription?:string}`. DISCOUNT yêu cầu `discountAmount>0` và `rewardDescription=null`; REWARD yêu cầu mô tả quà và `discountAmount=null`; `pointsCost>0`.

- [ ] Viết HTTP test Merchant A tạo DISCOUNT 20.000đ/200 điểm và REWARD ly/500 điểm; Merchant B PATCH ID A nhận `404`; payload sai type/amount/cost nhận `400`; disable mẫu không hiện trong public list. Chạy `npx tsx --test tests/milestone-5.integration.test.ts`, xác nhận đỏ.
- [ ] Tạo routes `GET/POST /api/merchant/vouchers`, `PATCH /api/merchant/vouchers/:id`, `GET /api/merchants/:merchantId/vouchers`; quản trị dùng active owner lookup, public chỉ active definitions. Serializer tiền dạng chuỗi VND như M3.
- [ ] Chạy test, `npm run build`; mong đợi exit 0. Commit `feat: manage merchant voucher definitions`.

### Task 2 — Đổi điểm và kho voucher

**Interfaces:** `redeemVoucher(memberId: number, definitionId: number): Promise<{voucher: MemberVoucherDto; wallet: WalletDto}>`, `listOwnedVouchers(memberId: number, merchantId: number): Promise<MemberVoucherDto[]>`. Response trạng thái `AVAILABLE`; ledger `REDEEM_DISCOUNT` hoặc `REDEEM_REWARD`, `delta=-pointsCost`, gắn `memberVoucherId`.

- [ ] Viết HTTP test ví 500 điểm đổi DISCOUNT thành 300; đổi REWARD 500 điểm nhận `409 INSUFFICIENT_POINTS`; hai request đổi song song khi còn 200 điểm chỉ một thành công; Merchant A/B tách biệt; Member khác không đọc được voucher. Chạy test, xác nhận đỏ.
- [ ] Gắn `POST /api/member/vouchers/:definitionId/redeem` và `GET /api/member/merchants/:merchantId/vouchers` với MEMBER guard. Trong một transaction, đọc definition active, tạo/tra membership+wallet, trừ `availablePoints` bằng update có điều kiện `>= pointsCost`, tạo MemberVoucher và ledger. Chỉ trả success sau commit; không có endpoint hoàn tác.
- [ ] Chạy test, `npm run build`; mong đợi exit 0. Commit `feat: redeem points for member vouchers`.

### Task 3 — Dùng giảm giá và trao thưởng

**Interfaces:** Mở rộng M3 `createOrder(memberId, {productId,quantity,voucherId?:number})`. Tính `discountAmount=min(subtotal, definition.discountAmount)`, `total=subtotal-discountAmount`; không tính điểm trên subtotal. `fulfillReward(ownerId: number, memberVoucherId: number, note?: string): Promise<MemberVoucherDto>`.

- [ ] Viết test: voucher A áp dụng cho order A, tổng không âm; voucher B/reward/voucher của Member khác nhận `404` hoặc `409`; cùng voucher không gắn hai order; PENDING vẫn AVAILABLE; pay đổi USED, ghi `usedAt`, chỉ cộng điểm trên `total`; pay lặp không đổi tiếp. Reward nhận `FULFILLED` sau Merchant A xác nhận; lặp/B xác nhận nhận `409`/`404`. Chạy test, xác nhận đỏ.
- [ ] Trong create order transaction, kiểm voucher type/owner/merchant/status, reserve bằng unique `Order.voucherId`, lưu snapshot discount/total. Nếu đơn PENDING không được thanh toán, voucher vẫn bị giữ bởi đơn đó trong MVP; nêu rõ trên UI. Trong `completePaidOrder` của M4, chuyển voucher `AVAILABLE→USED` bằng update có điều kiện cùng transaction với PAID và EARN.
- [ ] Gắn `GET /api/merchant/rewards` và `POST /api/merchant/rewards/:memberVoucherId/fulfill`; lọc Reward của chính Merchant, ghi RewardFulfillment unique và đổi trạng thái `FULFILLED` trong transaction. Không dùng endpoint này cho DISCOUNT.
- [ ] Chạy `npm test`, `npm run test:db`, `npm run build`, `git diff --check`; mong đợi exit 0. Commit `feat: apply discount vouchers and fulfill rewards`.

**Exit gate:** AC-04, AC-06–07, AC-09–12; hai luồng redeem và fulfillment quan sát được qua API.
