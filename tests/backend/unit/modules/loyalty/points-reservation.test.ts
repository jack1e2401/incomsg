import assert from "node:assert/strict";
import { test } from "node:test";
import { canReservePoints } from "../../../../../apps/backend/src/modules/loyalty/points-reservation.js";

test("reserves capacity against both spendable balance and lifetime points", () => {
  assert.equal(canReservePoints({ available: 10, lifetime: 20, reserved: 5, requested: 7 }), true);
  assert.equal(canReservePoints({ available: 2_147_483_640, lifetime: 20, reserved: 2, requested: 6 }), false);
  assert.equal(canReservePoints({ available: 20, lifetime: 2_147_483_640, reserved: 2, requested: 6 }), false);
});
