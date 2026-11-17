import type {
  AdminDashboardResponse,
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
} from "../contracts/admin";
import type { MerchantDirectoryResponse } from "../contracts/merchants";
import { requestJson } from "./shared";

export function createAdminClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    getAdminDashboard(token: string) {
      return requestJson<AdminDashboardResponse>(fetcher, baseUrl, "/api/admin/dashboard", { token });
    },
    listAdminMerchants(token: string) {
      return requestJson<MerchantDirectoryResponse>(fetcher, baseUrl, "/api/admin/merchants", { token });
    },
    listAdminUsers(params: AdminUsersQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set("search", params.search);
      if (params.status) searchParams.set("status", params.status);
      if (params.role) searchParams.set("role", params.role);
      if (params.cursor !== undefined && params.cursor !== null)
        searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null)
        searchParams.set("limit", String(params.limit));
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
      if (params.cursor !== undefined && params.cursor !== null)
        searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null)
        searchParams.set("limit", String(params.limit));
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
      if (params.actorId !== undefined && params.actorId !== null)
        searchParams.set("actorId", String(params.actorId));
      if (params.action) searchParams.set("action", params.action);
      if (params.targetType) searchParams.set("targetType", params.targetType);
      if (params.targetId !== undefined && params.targetId !== null)
        searchParams.set("targetId", String(params.targetId));
      if (params.from) searchParams.set("from", params.from);
      if (params.to) searchParams.set("to", params.to);
      if (params.cursor !== undefined && params.cursor !== null)
        searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null)
        searchParams.set("limit", String(params.limit));
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
      if (params.merchantId !== undefined && params.merchantId !== null)
        searchParams.set("merchantId", String(params.merchantId));
      if (params.memberId !== undefined && params.memberId !== null)
        searchParams.set("memberId", String(params.memberId));
      if (params.cursor !== undefined && params.cursor !== null)
        searchParams.set("cursor", String(params.cursor));
      if (params.limit !== undefined && params.limit !== null)
        searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/admin/abuse-reports${queryString ? `?${queryString}` : ""}`;
      return requestJson<AdminAbuseReportsResponse>(fetcher, baseUrl, path, { token });
    },
  };
}
