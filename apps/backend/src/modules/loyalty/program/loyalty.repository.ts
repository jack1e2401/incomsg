import { loyaltyConfigRepository } from "./loyalty.config.js";
import { completePaidOrder } from "./loyalty.earning.js";
import { reserveOrderPoints } from "./loyalty.reservation.js";
import { getWallet } from "./loyalty.read.js";

/** Existing module boundary; each operation has a focused implementation. */
export const loyaltyRepository = {
  ...loyaltyConfigRepository,
  reserveOrderPoints,
  completePaidOrder,
  getWallet,
};
