import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  AdminAuditAction,
  AdminAuditLogDto,
  AdminAuditTargetType,
} from "../../api/commerce-types";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { AdminAuditLogsFilter } from "./AdminAuditLogsFilter";
import { AdminAuditLogsTable } from "./AdminAuditLogsTable";
import { pastYearRange, vietnamDateBounds } from "../../lib/vietnam-date";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function AdminAuditLogs() {
  const { accessToken } = useAuthSession();
  const [logs, setLogs] = useState<AdminAuditLogDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<AdminAuditAction | "ALL">("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState<AdminAuditTargetType | "ALL">("ALL");
  const [actorIdInput, setActorIdInput] = useState("");
  const [targetIdInput, setTargetIdInput] = useState("");
  const [defaultRange] = useState(pastYearRange);
  const [fromDateInput, setFromDateInput] = useState(defaultRange.from);
  const [toDateInput, setToDateInput] = useState(defaultRange.to);

  // Applied query filters
  const [appliedFilters, setAppliedFilters] = useState<{
    action?: AdminAuditAction;
    targetType?: AdminAuditTargetType;
    actorId?: number;
    targetId?: number;
    from?: string;
    to?: string;
  }>(() => vietnamDateBounds(defaultRange.from, defaultRange.to));

  // Expanded row IDs for before/after view
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      if (!accessToken) return;
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setFetchError(null);
      }

      try {
        const query: {
          action?: AdminAuditAction;
          targetType?: AdminAuditTargetType;
          actorId?: number;
          targetId?: number;
          from?: string;
          to?: string;
          cursor?: string;
          limit?: number;
        } = {
          limit: 25,
          ...appliedFilters,
        };
        if (cursor) query.cursor = cursor;

        const response = await commerce.listAdminAuditLogs(query, accessToken);
        if (cursor) {
          setLogs((prev) => [...prev, ...response.items]);
        } else {
          setLogs(response.items);
        }
        setNextCursor(response.nextCursor);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Không tải được nhật ký kiểm toán.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, appliedFilters],
  );

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    const filters: {
      action?: AdminAuditAction;
      targetType?: AdminAuditTargetType;
      actorId?: number;
      targetId?: number;
      from?: string;
      to?: string;
    } = {};

    if (actionFilter !== "ALL") filters.action = actionFilter;
    if (targetTypeFilter !== "ALL") filters.targetType = targetTypeFilter;
    if (actorIdInput.trim() && /^\d+$/.test(actorIdInput.trim())) {
      filters.actorId = Number(actorIdInput.trim());
    }
    if (targetIdInput.trim() && /^\d+$/.test(targetIdInput.trim())) {
      filters.targetId = Number(targetIdInput.trim());
    }
    setAppliedFilters({ ...filters, ...vietnamDateBounds(fromDateInput, toDateInput) });
  }

  function handleResetFilters() {
    setActionFilter("ALL");
    setTargetTypeFilter("ALL");
    setActorIdInput("");
    setTargetIdInput("");
    const range = pastYearRange();
    setFromDateInput(range.from);
    setToDateInput(range.to);
    setAppliedFilters(vietnamDateBounds(range.from, range.to));
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Nhật ký kiểm toán"
        description="Theo dõi toàn bộ lịch sử thao tác kiểm duyệt trên người dùng, cửa hàng và danh sách đen."
      />

      <AdminAuditLogsFilter
        actionFilter={actionFilter}
        onActionFilterChange={setActionFilter}
        targetTypeFilter={targetTypeFilter}
        onTargetTypeFilterChange={setTargetTypeFilter}
        actorIdInput={actorIdInput}
        onActorIdInputChange={setActorIdInput}
        targetIdInput={targetIdInput}
        onTargetIdInputChange={setTargetIdInput}
        fromDateInput={fromDateInput}
        onFromDateInputChange={setFromDateInput}
        toDateInput={toDateInput}
        onToDateInputChange={setToDateInput}
        onSubmit={handleFilterSubmit}
        onReset={handleResetFilters}
      />

      {loading ? (
        <LoadingState cards={3} />
      ) : fetchError ? (
        <ErrorState message={fetchError} retry={() => fetchLogs()} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="Không có bản ghi nhật ký"
          description="Chưa có bản ghi kiểm toán nào phù hợp với bộ lọc."
          action={
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Đặt lại bộ lọc
            </Button>
          }
        />
      ) : (
        <AdminAuditLogsTable
          logs={logs}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={() => nextCursor && fetchLogs(nextCursor)}
        />
      )}
    </>
  );
}
