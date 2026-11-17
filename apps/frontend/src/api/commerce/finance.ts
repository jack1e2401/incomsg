import type {
  AdminFinancePeriod,
  AdminFinanceReport,
  MerchantFinanceResponse,
  PlatformFeeFilters,
} from "../contracts/finance";
import { requestJson, financePath } from "./shared";

export function createFinanceClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    getAdminFinance(period: AdminFinancePeriod, token: string) {
      return requestJson<AdminFinanceReport>(fetcher, baseUrl, `/api/admin/finance?period=${period}`, {
        token,
      });
    },
    getMerchantFinance(token: string, filters: PlatformFeeFilters = {}) {
      return requestJson<MerchantFinanceResponse>(
        fetcher,
        baseUrl,
        financePath("/api/merchant/finance", filters),
        { token },
      );
    },
    getAdminMerchantFees(merchantId: number, token: string, filters: PlatformFeeFilters = {}) {
      return requestJson<MerchantFinanceResponse>(
        fetcher,
        baseUrl,
        financePath(`/api/admin/merchants/${merchantId}/fees`, filters),
        { token },
      );
    },
  };
}
