import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../../../../apps/backend/src/generated/prisma/client.js";
import { calculateDiscountedTotal } from "../../../../../apps/backend/src/modules/orders/order-pricing.js";

test("caps discount at subtotal and returns nonnegative payable total", () => {
  assert.deepEqual(calculateDiscountedTotal(new Prisma.Decimal("200000"), new Prisma.Decimal("20000")), {
    discountAmount: new Prisma.Decimal("20000"), total: new Prisma.Decimal("180000"),
  });
  assert.deepEqual(calculateDiscountedTotal(new Prisma.Decimal("200000"), new Prisma.Decimal("250000")), {
    discountAmount: new Prisma.Decimal("200000"), total: new Prisma.Decimal("0"),
  });
});
