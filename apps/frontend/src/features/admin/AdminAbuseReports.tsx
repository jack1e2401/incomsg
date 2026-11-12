import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { AdminAbuseReportDto, AdminAbuseReportsQuery } from "../../api/commerce-types";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { AdminAbuseReportsFilter } from "./AdminAbuseReportsFilter";
import { AdminAbuseReportsTable } from "./AdminAbuseReportsTable";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function AdminAbuseReports() {
  const { accessToken } = useAuthSession();
  const [reports, setReports] = useState<AdminAbuseReportDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter inputs
  const [merchantIdInput, setMerchantIdInput] = useState("");
  const [memberIdInput, setMemberIdInput] = useState("");

  // Applied query filters
  const [appliedFilters, setAppliedFilters] = useState<{
    merchantId?: number;
    memberId?: number;
  }>({});

  const fetchReports = useCallback(
    async (cursor?: string) => {
      if (!accessToken) return;
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setFetchError(null);
      }

      try {
        const query: AdminAbuseReportsQuery = {
          limit: 25,
          ...appliedFilters,
        };
        if (cursor) query.cursor = cursor;

        const response = await commerce.listAdminAbuseReports(query, accessToken);
        if (cursor) {
          setReports((prev) => [...prev, ...response.items]);
        } else {
          setReports(response.items);
        }
        setNextCursor(response.nextCursor);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Không tải được danh sách báo cáo vi phạm.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, appliedFilters],
  );

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    const filters: { merchantId?: number; memberId?: number } = {};

    const trimmedMerchant = merchantIdInput.trim();
    if (trimmedMerchant && /^\d+$/.test(trimmedMerchant)) {
      filters.merchantId = Number(trimmedMerchant);
    }
    const trimmedMember = memberIdInput.trim();
    if (trimmedMember && /^\d+$/.test(trimmedMember)) {
      filters.memberId = Number(trimmedMember);
    }

    setAppliedFilters(filters);
  }

  function handleResetFilters() {
    setMerchantIdInput("");
    setMemberIdInput("");
    setAppliedFilters({});
  }

  return (
    <>
      <PageHeader
        title="Báo cáo vi phạm"
        description="Xem xét các báo cáo bất thường do cửa hàng gửi lên."
      />

      <AdminAbuseReportsFilter
        merchantIdInput={merchantIdInput}
        onMerchantIdInputChange={setMerchantIdInput}
        memberIdInput={memberIdInput}
        onMemberIdInputChange={setMemberIdInput}
        onSubmit={handleFilterSubmit}
        onReset={handleResetFilters}
      />

      {loading ? (
        <LoadingState cards={3} />
      ) : fetchError ? (
        <ErrorState message={fetchError} retry={() => fetchReports()} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="Không có báo cáo vi phạm"
          description="Chưa có báo cáo vi phạm nào phù hợp với bộ lọc."
          action={
            (appliedFilters.merchantId !== undefined || appliedFilters.memberId !== undefined) ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Đặt lại bộ lọc
              </Button>
            ) : undefined
          }
        />
      ) : (
        <AdminAbuseReportsTable
          reports={reports}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={() => nextCursor && fetchReports(nextCursor)}
        />
      )}
    </>
  );
}
