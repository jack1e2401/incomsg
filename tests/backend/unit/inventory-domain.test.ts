import assert from "node:assert/strict";
import test from "node:test";
import { applyInventoryMovement } from "../../../apps/backend/src/modules/inventory/inventory.domain.js";

test("sale stock reservation and payment consume on-hand exactly once", () => {
  const stocked = applyInventoryMovement({ onHand: 0, reserved: 0 }, "INITIAL_STOCK", 5);
  const reserved = applyInventoryMovement(stocked, "ORDER_RESERVE", 2);
  const paid = applyInventoryMovement(reserved, "SALE_OUT", 2);

  assert.deepEqual(stocked, { onHand: 5, reserved: 0 });
  assert.deepEqual(reserved, { onHand: 5, reserved: 2 });
  assert.deepEqual(paid, { onHand: 3, reserved: 0 });
});

test("manual stock out cannot consume units reserved for an order", () => {
  assert.throws(
    () => applyInventoryMovement({ onHand: 5, reserved: 4 }, "MANUAL_OUT", 2),
    /available inventory/i,
  );
});

test("concurrent reservation cannot exceed available stock", () => {
  assert.throws(
    () => applyInventoryMovement({ onHand: 5, reserved: 4 }, "ORDER_RESERVE", 2),
    /available inventory/i,
  );
});

test("reward fulfillment consumes one reserved unit, while cancellation only releases it", () => {
  const reserved = { onHand: 5, reserved: 1 };
  assert.deepEqual(applyInventoryMovement(reserved, "REWARD_FULFILL_OUT", 1), {
    onHand: 4,
    reserved: 0,
  });
  assert.deepEqual(applyInventoryMovement(reserved, "REWARD_CANCEL_RELEASE", 1), {
    onHand: 5,
    reserved: 0,
  });
});

test("discount voucher redemption consumes issuance capacity without reservation", () => {
  assert.deepEqual(applyInventoryMovement({ onHand: 1, reserved: 0 }, "VOUCHER_REDEMPTION_OUT", 1), {
    onHand: 0,
    reserved: 0,
  });
});