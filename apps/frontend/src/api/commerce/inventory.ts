import type { InventoryAdjustmentResponse, InventoryResponse } from "../contracts/inventory";
import { requestJson } from "./shared";

export function createInventoryClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    getProductInventory(productId: number, token: string) {
      return requestJson<InventoryResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/products/${productId}/stock/movements`,
        { token },
      );
    },
    adjustProductInventory(
      productId: number,
      direction: "in" | "out",
      body: { quantity: number; reason: string; returnToStock?: boolean },
      token: string,
      requestKey: string,
    ) {
      return requestJson<InventoryAdjustmentResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/products/${productId}/stock/${direction}`,
        {
          method: "POST",
          token,
          body,
          headers: { "Idempotency-Key": requestKey },
        },
      );
    },
    getRewardInventory(productId: number, token: string) {
      return requestJson<InventoryResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/rewards/${productId}/stock/movements`,
        { token },
      );
    },
    adjustRewardInventory(
      productId: number,
      direction: "in" | "out",
      body: { quantity: number; reason: string; returnToStock?: boolean },
      token: string,
      requestKey: string,
    ) {
      return requestJson<InventoryAdjustmentResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/rewards/${productId}/stock/${direction}`,
        {
          method: "POST",
          token,
          body,
          headers: { "Idempotency-Key": requestKey },
        },
      );
    },
    getVoucherInventory(definitionId: number, token: string) {
      return requestJson<InventoryResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/vouchers/${definitionId}/stock/movements`,
        { token },
      );
    },
    adjustVoucherInventory(
      definitionId: number,
      direction: "in" | "out",
      body: { quantity: number; reason: string },
      token: string,
      requestKey: string,
    ) {
      return requestJson<InventoryAdjustmentResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/vouchers/${definitionId}/stock/${direction}`,
        {
          method: "POST",
          token,
          body,
          headers: { "Idempotency-Key": requestKey },
        },
      );
    },
  };
}
