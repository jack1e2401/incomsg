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
  MerchantLoyaltyMembersResponse,
  MerchantLoyaltyMemberWalletResponse,
  RefundPreviewDto,
  RefundResponseDto,
  RewardCancelResponseDto,
  AdminUsersQuery,
  AdminUsersResponse,
  ChangeUserStatusInput,
  AdminUserResponse,
  ChangeMerchantStatusInput,
  AdminMerchantModerationResponse,
  AdminBlacklistQuery,
  AdminBlacklistResponse,
  AddBlacklistInput,
  DeactivateBlacklistInput,
  AdminBlacklistEntryResponse,
  AdminAuditLogsQuery,
  AdminAuditLogsResponse,
  CreateAbuseReportInput,
  CreateAbuseReportResponse,
  AdminAbuseReportsQuery,
  AdminAbuseReportsResponse,
  InventoryAdjustmentResponse,
  InventoryResponse,
  MerchantLoyaltyHistoryResponse,
} from "./commerce-types";

export function translateApiError(code: string): string {
  const translations: Record<string, string> = {
    ACCOUNT_SUSPENDED: "Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên.",
    ACCOUNT_BANNED: "Tài khoản đã bị cấm khỏi hệ thống.",
    EMAIL_BLACKLISTED: "Địa chỉ email đã bị chặn trong danh sách đen.",
    MERCHANT_NOT_ACTIVE: "Cửa hàng đã bị tạm ngưng hoạt động.",
    UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    MEMBER_NOT_FOUND: "Không tìm thấy thành viên trong cửa hàng.",
    ORDER_NOT_FOUND: "Không tìm thấy đơn hàng tương ứng.",
    INSUFFICIENT_PRODUCT_STOCK: "Sản phẩm không còn đủ số lượng. Hãy tải lại giỏ hàng.",
    VOUCHER_OUT_OF_STOCK: "Voucher đã hết lượt phát hành.",
    REWARD_OUT_OF_STOCK: "Quà đang hết hàng, merchant chưa thể xác nhận trao.",
    INSUFFICIENT_AVAILABLE_INVENTORY: "Số lượng xuất vượt quá hàng hiện có, bao gồm hàng đã giữ chỗ.",
    ORDER_RESERVATION_EXPIRED: "Thời gian giữ hàng đã hết. Vui lòng tạo đơn mới.",
    IDEMPOTENCY_KEY_CONFLICT: "Mã yêu cầu đã được dùng cho thao tác khác. Hãy thử lại.",
  };
  return translations[code] ?? code;
}

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
    listMerchants({ includeCover = false }: { includeCover?: boolean } = {}) {
      return requestJson<MerchantDirectoryResponse>(fetcher, baseUrl, includeCover ? "/api/merchants?include=cover" : "/api/merchants");
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
    getProductInventory(productId: number, token: string) {
      return requestJson<InventoryResponse>(fetcher, baseUrl, `/api/merchant/products/${productId}/stock/movements`, { token });
    },
    adjustProductInventory(productId: number, direction: "in" | "out", body: { quantity: number; reason: string; returnToStock?: boolean }, token: string, requestKey: string) {
      return requestJson<InventoryAdjustmentResponse>(fetcher, baseUrl, `/api/merchant/products/${productId}/stock/${direction}`, {
        method: "POST", token, body, headers: { "Idempotency-Key": requestKey },
      });
    },
    getRewardInventory(productId: number, token: string) {
      return requestJson<InventoryResponse>(fetcher, baseUrl, `/api/merchant/rewards/${productId}/stock/movements`, { token });
    },
    adjustRewardInventory(productId: number, direction: "in" | "out", body: { quantity: number; reason: string; returnToStock?: boolean }, token: string, requestKey: string) {
      return requestJson<InventoryAdjustmentResponse>(fetcher, baseUrl, `/api/merchant/rewards/${productId}/stock/${direction}`, {
        method: "POST", token, body, headers: { "Idempotency-Key": requestKey },
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
    getMerchantOrder(orderId: number, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, `/api/merchant/orders/${orderId}`, { token });
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
    getLoyaltyPolicyHistory(token: string) {
      return requestJson<MerchantLoyaltyHistoryResponse>(fetcher, baseUrl, "/api/merchant/loyalty/history", { token });
    },
    getMemberWallet(merchantId: number, token: string) {
      return requestJson<WalletResponse>(fetcher, baseUrl, `/api/member/merchants/${merchantId}/wallet`, {
        token,
      });
    },
    listMerchantLoyaltyMembers(filters: { email: string; cursor: number | null }, token: string) {
      const params = new URLSearchParams();
      if (filters.email) params.set("email", filters.email);
      if (filters.cursor !== null) params.set("cursor", String(filters.cursor));
      const query = params.toString();
      return requestJson<MerchantLoyaltyMembersResponse>(fetcher, baseUrl, `/api/merchant/loyalty/members${query ? `?${query}` : ""}`, { token });
    },
    getMerchantLoyaltyMemberWallet(memberId: string, token: string) {
      return requestJson<MerchantLoyaltyMemberWalletResponse>(fetcher, baseUrl, `/api/merchant/loyalty/members/${encodeURIComponent(memberId)}/wallet`, { token });
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
    getVoucherInventory(definitionId: number, token: string) {
      return requestJson<InventoryResponse>(fetcher, baseUrl, `/api/merchant/vouchers/${definitionId}/stock/movements`, { token });
    },
    adjustVoucherInventory(definitionId: number, direction: "in" | "out", body: { quantity: number; reason: string }, token: string, requestKey: string) {
      return requestJson<InventoryAdjustmentResponse>(fetcher, baseUrl, `/api/merchant/vouchers/${definitionId}/stock/${direction}`, {
        method: "POST", token, body, headers: { "Idempotency-Key": requestKey },
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
    listAdminUsers(params: AdminUsersQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set("search", params.search);
      if (params.status) searchParams.set("status", params.status);
      if (params.role) searchParams.set("role", params.role);
      if (params.cursor !== undefined && params.cursor !== null) searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null) searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/admin/users${queryString ? `?${queryString}` : ""}`;
      return requestJson<AdminUsersResponse>(fetcher, baseUrl, path, { token });
    },
    changeAdminUserStatus(userId: number, input: ChangeUserStatusInput, token: string) {
      return requestJson<AdminUserResponse>(fetcher, baseUrl, `/api/admin/users/${userId}/status`, {
        method: "PATCH",
        token,
        body: input,
      });
    },
    changeAdminMerchantStatus(merchantId: number, input: ChangeMerchantStatusInput, token: string) {
      return requestJson<AdminMerchantModerationResponse>(
        fetcher,
        baseUrl,
        `/api/admin/merchants/${merchantId}/status`,
        {
          method: "PATCH",
          token,
          body: input,
        },
      );
    },
    listAdminBlacklist(params: AdminBlacklistQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set("search", params.search);
      if (params.active !== undefined) searchParams.set("active", String(params.active));
      if (params.cursor !== undefined && params.cursor !== null) searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null) searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/admin/email-blacklist${queryString ? `?${queryString}` : ""}`;
      return requestJson<AdminBlacklistResponse>(fetcher, baseUrl, path, { token });
    },
    addAdminBlacklist(input: AddBlacklistInput, token: string) {
      return requestJson<AdminBlacklistEntryResponse>(fetcher, baseUrl, "/api/admin/email-blacklist", {
        method: "POST",
        token,
        body: input,
      });
    },
    deactivateAdminBlacklist(id: number, input: DeactivateBlacklistInput, token: string) {
      return requestJson<AdminBlacklistEntryResponse>(
        fetcher,
        baseUrl,
        `/api/admin/email-blacklist/${id}/deactivate`,
        {
          method: "POST",
          token,
          body: input,
        },
      );
    },
    listAdminAuditLogs(params: AdminAuditLogsQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.actorId !== undefined && params.actorId !== null) searchParams.set("actorId", String(params.actorId));
      if (params.action) searchParams.set("action", params.action);
      if (params.targetType) searchParams.set("targetType", params.targetType);
      if (params.targetId !== undefined && params.targetId !== null) searchParams.set("targetId", String(params.targetId));
      if (params.from) searchParams.set("from", params.from);
      if (params.to) searchParams.set("to", params.to);
      if (params.cursor !== undefined && params.cursor !== null) searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null) searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/admin/audit-logs${queryString ? `?${queryString}` : ""}`;
      return requestJson<AdminAuditLogsResponse>(fetcher, baseUrl, path, { token });
    },
    createMerchantAbuseReport(body: CreateAbuseReportInput, token: string) {
      return requestJson<CreateAbuseReportResponse>(fetcher, baseUrl, "/api/merchant/abuse-reports", {
        method: "POST",
        token,
        body,
      });
    },
    listAdminAbuseReports(params: AdminAbuseReportsQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.merchantId !== undefined && params.merchantId !== null) searchParams.set("merchantId", String(params.merchantId));
      if (params.memberId !== undefined && params.memberId !== null) searchParams.set("memberId", String(params.memberId));
      if (params.cursor !== undefined && params.cursor !== null) searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null) searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/admin/abuse-reports${queryString ? `?${queryString}` : ""}`;
      return requestJson<AdminAbuseReportsResponse>(fetcher, baseUrl, path, { token });
    },
  };
}
