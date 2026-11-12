import type {
  CreateOrderInput,
  AdminDashboardResponse,
  FulfillRewardInput,
  LoyaltyConfigInput,
  LoyaltyConfigResponse,
  MemberVouchersResponse,
  MemberVoucherResponse,
  MerchantRewardResponse,
  MerchantRewardsResponse,
  OrderResponse,
  MerchantOrdersResponse,
  OrdersResponse,
  MerchantDirectoryResponse,
  PaymentStatusDto,
  VnpayPaymentResponse,
  OwnMerchantResponse,
  ProductInput,
  ProductPatch,
  ProductResponse,
  ProductsResponse,
  VoucherDefinitionInput,
  VoucherDefinitionPatch,
  VoucherDefinitionResponse,
  VoucherDefinitionsResponse,
  WalletResponse,
  CancelOrderResponse,
  MemberEarningPreviewResponse,
  MerchantLoyaltyPreviewInput,
  MerchantLoyaltyPreviewResponse,
  MerchantTransactionsResponse,
  MerchantTransactionsQuery,
  RefundPreviewDto,
  RefundResponseDto,
  RewardCancelResponseDto,
} from "./commerce-types";

type FetchLike = typeof fetch;

async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT";
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key, value);
    }
  }
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Yêu cầu thất bại (${response.status})`;
    throw new Error(error);
  }
  return payload as T;
}

/** Only endpoints currently mounted by apps/backend/src/app.ts. */
export function createCommerceClient(baseUrl = "", fetcher: FetchLike = fetch) {
  return {
    listMerchants() {
      return requestJson<MerchantDirectoryResponse>(fetcher, baseUrl, "/api/merchants");
    },
    getAdminDashboard(token: string) {
      return requestJson<AdminDashboardResponse>(fetcher, baseUrl, "/api/admin/dashboard", { token });
    },
    listAdminMerchants(token: string) {
      return requestJson<MerchantDirectoryResponse>(fetcher, baseUrl, "/api/admin/merchants", { token });
    },
    getOwnMerchant(token: string) {
      return requestJson<OwnMerchantResponse>(fetcher, baseUrl, "/api/merchant/me", { token });
    },
    listOwnProducts(token: string) {
      return requestJson<ProductsResponse>(fetcher, baseUrl, "/api/merchant/products", { token });
    },
    createProduct(input: ProductInput, token: string) {
      return requestJson<ProductResponse>(fetcher, baseUrl, "/api/merchant/products", {
        method: "POST",
        token,
        body: input,
      });
    },
    updateProduct(productId: number, patch: ProductPatch, token: string) {
      return requestJson<ProductResponse>(fetcher, baseUrl, `/api/merchant/products/${productId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
    },
    listPublicProducts(merchantId: number) {
      return requestJson<ProductsResponse>(fetcher, baseUrl, `/api/merchants/${merchantId}/products`);
    },
    createOrder(input: CreateOrderInput, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, "/api/orders", {
        method: "POST",
        token,
        body: input,
      });
    },
    payMockOrder(orderId: number, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, `/api/orders/${orderId}/pay`, {
        method: "POST",
        token,
      });
    },
    createVnpayPayment(orderId: number, token: string) {
      return requestJson<VnpayPaymentResponse>(fetcher, baseUrl, `/api/orders/${orderId}/payments/vnpay`, {
        method: "POST",
        token,
      });
    },
    getPaymentStatus(orderId: number, token: string) {
      return requestJson<PaymentStatusDto>(fetcher, baseUrl, `/api/orders/${orderId}/payment-status`, {
        token,
      });
    },
    listMemberOrders(merchantId: number, token: string) {
      return requestJson<OrdersResponse>(fetcher, baseUrl, `/api/member/orders?merchantId=${merchantId}`, {
        token,
      });
    },
    getMemberOrder(orderId: number, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, `/api/member/orders/${orderId}`, { token });
    },
    listMerchantOrders(token: string) {
      return requestJson<MerchantOrdersResponse>(fetcher, baseUrl, "/api/merchant/orders", { token });
    },
    getLoyaltyConfig(token: string) {
      return requestJson<LoyaltyConfigResponse>(fetcher, baseUrl, "/api/merchant/loyalty", { token });
    },
    putLoyaltyConfig(input: LoyaltyConfigInput, token: string) {
      return requestJson<LoyaltyConfigResponse>(fetcher, baseUrl, "/api/merchant/loyalty", {
        method: "PUT",
        token,
        body: input,
      });
    },
    getMemberWallet(merchantId: number, token: string) {
      return requestJson<WalletResponse>(fetcher, baseUrl, `/api/member/merchants/${merchantId}/wallet`, {
        token,
      });
    },
    listMerchantVoucherDefinitions(token: string) {
      return requestJson<VoucherDefinitionsResponse>(fetcher, baseUrl, "/api/merchant/vouchers", { token });
    },
    createVoucherDefinition(input: VoucherDefinitionInput, token: string) {
      return requestJson<VoucherDefinitionResponse>(fetcher, baseUrl, "/api/merchant/vouchers", {
        method: "POST",
        token,
        body: input,
      });
    },
    updateVoucherDefinition(id: number, patch: VoucherDefinitionPatch, token: string) {
      return requestJson<VoucherDefinitionResponse>(fetcher, baseUrl, `/api/merchant/vouchers/${id}`, {
        method: "PATCH",
        token,
        body: patch,
      });
    },
    listPublicVoucherDefinitions(merchantId: number) {
      return requestJson<VoucherDefinitionsResponse>(
        fetcher,
        baseUrl,
        `/api/merchants/${merchantId}/vouchers`,
      );
    },
    listMemberVouchers(merchantId: number, token: string) {
      return requestJson<MemberVouchersResponse>(
        fetcher,
        baseUrl,
        `/api/member/merchants/${merchantId}/vouchers`,
        { token },
      );
    },
    cancelOrder(orderId: number, token: string) {
      return requestJson<CancelOrderResponse>(fetcher, baseUrl, `/api/orders/${orderId}/cancel`, {
        method: "POST",
        token,
      });
    },
    previewMemberEarning(merchantId: number, netOrderAmountVnd: string, token: string) {
      return requestJson<MemberEarningPreviewResponse>(
        fetcher,
        baseUrl,
        `/api/member/merchants/${merchantId}/loyalty/preview`,
        {
          method: "POST",
          token,
          body: { netOrderAmountVnd },
        },
      );
    },
    async redeemVoucher(definitionId: number, token: string, idempotencyKey: string) {
      const trimmedKey = idempotencyKey?.trim();
      if (!trimmedKey) {
        throw new Error("Idempotency key is required to redeem a voucher");
      }
      return requestJson<MemberVoucherResponse>(
        fetcher,
        baseUrl,
        `/api/member/vouchers/${definitionId}/redeem`,
        {
          method: "POST",
          token,
          headers: {
            "Idempotency-Key": trimmedKey,
          },
        },
      );
    },
    previewMerchantLoyalty(input: MerchantLoyaltyPreviewInput, token: string) {
      return requestJson<MerchantLoyaltyPreviewResponse>(fetcher, baseUrl, "/api/merchant/loyalty/preview", {
        method: "POST",
        token,
        body: input,
      });
    },
    listMerchantTransactions(params: MerchantTransactionsQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.memberId !== undefined) searchParams.set("memberId", String(params.memberId));
      if (params.orderId !== undefined) searchParams.set("orderId", String(params.orderId));
      if (params.type !== undefined) searchParams.set("type", params.type);
      if (params.from !== undefined) searchParams.set("from", params.from);
      if (params.to !== undefined) searchParams.set("to", params.to);
      if (params.cursor !== undefined) searchParams.set("cursor", params.cursor);
      if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/merchant/loyalty/transactions${queryString ? `?${queryString}` : ""}`;
      return requestJson<MerchantTransactionsResponse>(fetcher, baseUrl, path, { token });
    },
    getRefundPreview(orderId: number, token: string) {
      return requestJson<RefundPreviewDto>(
        fetcher,
        baseUrl,
        `/api/merchant/orders/${orderId}/refund-preview`,
        { token },
      );
    },
    refundOrder(orderId: number, body: { reason: string }, token: string) {
      return requestJson<RefundResponseDto>(fetcher, baseUrl, `/api/merchant/orders/${orderId}/refund`, {
        method: "POST",
        token,
        body,
      });
    },
    listMerchantRewards(token: string) {
      return requestJson<MerchantRewardsResponse>(fetcher, baseUrl, "/api/merchant/rewards", { token });
    },
    fulfillReward(memberVoucherId: number, input: FulfillRewardInput, token: string) {
      return requestJson<MerchantRewardResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/rewards/${memberVoucherId}/fulfill`,
        { method: "POST", token, body: input },
      );
    },
    cancelReward(memberVoucherId: number, body: { reason: string }, token: string) {
      return requestJson<RewardCancelResponseDto>(
        fetcher,
        baseUrl,
        `/api/merchant/rewards/${memberVoucherId}/cancel`,
        {
          method: "POST",
          token,
          body,
        },
      );
    },
  };
}
