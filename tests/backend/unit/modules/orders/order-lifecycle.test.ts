import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../../../../apps/backend/src/generated/prisma/client.js";
import {
  computeOrderActions,
  isStalePaymentAttempt,
  toOrderDto,
} from "../../../../../apps/backend/src/modules/orders/orders.serialization.js";

test("isStalePaymentAttempt flags CREATED attempts older than 15 minutes", () => {
  const freshAttempt = { status: "CREATED", createdAt: new Date(Date.now() - 5 * 60 * 1000) };
  assert.equal(isStalePaymentAttempt(freshAttempt), false);

  const staleAttempt = { status: "CREATED", createdAt: new Date(Date.now() - 16 * 60 * 1000) };
  assert.equal(isStalePaymentAttempt(staleAttempt), true);

  const nonCreatedStale = { status: "FAILED", createdAt: new Date(Date.now() - 60 * 60 * 1000) };
  assert.equal(isStalePaymentAttempt(nonCreatedStale), false);

  assert.equal(isStalePaymentAttempt(null), false);
  assert.equal(isStalePaymentAttempt(undefined), false);
});

test("computeOrderActions determines cancel and refund eligibility safely", () => {
  // Fresh pending order without payment attempt -> can cancel, cannot refund
  const noAttempt = computeOrderActions("PENDING", null, null);
  assert.equal(noAttempt.canCancel, true);
  assert.equal(noAttempt.canRefund, false);
  assert.equal(noAttempt.requiresReconciliation, false);

  // Pending order with CREATED VNPay attempt -> CANNOT cancel, cannot refund
  const createdAttempt = computeOrderActions("PENDING", { status: "CREATED", createdAt: new Date() }, null);
  assert.equal(createdAttempt.canCancel, false);
  assert.equal(createdAttempt.canRefund, false);
  assert.equal(createdAttempt.requiresReconciliation, false);

  // Pending order with stale CREATED attempt -> cannot cancel, requiresReconciliation true
  const staleCreated = computeOrderActions(
    "PENDING",
    { status: "CREATED", createdAt: new Date(Date.now() - 20 * 60 * 1000) },
    null,
  );
  assert.equal(staleCreated.canCancel, false);
  assert.equal(staleCreated.canRefund, false);
  assert.equal(staleCreated.requiresReconciliation, true);

  // Pending order with terminal FAILED payment attempt -> CAN safely cancel
  const failedAttempt = computeOrderActions(
    "PENDING",
    { status: "FAILED", createdAt: new Date(Date.now() - 5 * 60 * 1000) },
    null,
  );
  assert.equal(failedAttempt.canCancel, true);
  assert.equal(failedAttempt.canRefund, false);

  // PAID order -> CANNOT cancel, CAN refund
  const paid = computeOrderActions("PAID", { status: "SUCCEEDED", createdAt: new Date() }, null);
  assert.equal(paid.canCancel, false);
  assert.equal(paid.canRefund, true);

  // PAID order with completed refund -> cannot cancel, cannot refund
  const refunded = computeOrderActions(
    "REFUNDED",
    { status: "SUCCEEDED", createdAt: new Date() },
    { status: "COMPLETED" },
  );
  assert.equal(refunded.canCancel, false);
  assert.equal(refunded.canRefund, false);
});

test("toOrderDto formats loyalty events, refundStatus, and computed actions", () => {
  const mockOrder = {
    id: 10,
    merchantId: 1,
    memberId: 2,
    status: "PAID",
    subtotal: new Prisma.Decimal("100000"),
    discountAmount: new Prisma.Decimal("20000"),
    total: new Prisma.Decimal("80000"),
    paidAt: new Date("2026-11-11T10:00:00Z"),
    earnedPointsExact: new Prisma.Decimal("8.500000000000"),
    items: [
      {
        productId: 1,
        productName: "Coffee",
        unitPrice: new Prisma.Decimal("100000"),
        quantity: 1,
        lineTotal: new Prisma.Decimal("100000"),
      },
    ],
    paymentAttempt: { status: "SUCCEEDED", createdAt: new Date("2026-11-11T09:59:00Z") },
    refund: null,
    pointTransactions: [
      {
        id: 101,
        type: "EARN",
        delta: new Prisma.Decimal("8.500000000000"),
        balanceAfter: new Prisma.Decimal("8.500000000000"),
        reason: "Earned from order #10",
        source: "MOCK_PAYMENT",
        actorId: 2,
        createdAt: new Date("2026-11-11T10:00:00Z"),
      },
    ],
  };

  const dto = toOrderDto(mockOrder);
  assert.equal(dto.id, 10);
  assert.equal(dto.subtotal, "100000");
  assert.equal(dto.discountAmount, "20000");
  assert.equal(dto.total, "80000");
  assert.equal(dto.earnedPointsExact, "8.5");
  assert.equal(dto.paymentStatus, "SUCCEEDED");
  assert.equal(dto.refundStatus, null);
  assert.equal(dto.actions?.canCancel, false);
  assert.equal(dto.actions?.canRefund, true);
  assert.equal(dto.loyaltyEvents?.length, 1);
  assert.equal(dto.loyaltyEvents?.[0]?.delta, "8.5");
  assert.equal(dto.loyaltyEvents?.[0]?.type, "EARN");
});
