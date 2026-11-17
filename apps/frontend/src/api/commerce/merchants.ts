import type { MerchantDirectoryResponse, OwnMerchantResponse } from "../contracts/merchants";
import { requestJson } from "./shared";

export function createMerchantsClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    listMerchants({ includeCover = false }: { includeCover?: boolean } = {}) {
      return requestJson<MerchantDirectoryResponse>(
        fetcher,
        baseUrl,
        includeCover ? "/api/merchants?include=cover" : "/api/merchants",
      );
    },
    getOwnMerchant(token: string) {
      return requestJson<OwnMerchantResponse>(fetcher, baseUrl, "/api/merchant/me", { token });
    },
  };
}
