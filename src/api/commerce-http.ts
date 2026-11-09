import type {
  CreateOrderInput,
  LoyaltyConfigInput,
  LoyaltyConfigResponse,
  MemberVouchersResponse,
  OrderResponse,
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
} from "./commerce-types";

type FetchLike = typeof fetch;

async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "PUT"; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
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
  };
}
