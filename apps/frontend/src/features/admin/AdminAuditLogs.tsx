import { useState, useEffect, useCallback, type FormEvent } from "react";
import { CaretDown, CaretUp, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  AdminAuditAction,
  AdminAuditLogDto,
  AdminAuditTargetType,
} from "../../api/commerce-types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusText,
} from "../../components/ui";
import { shortDate } from "../../lib/utils";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function actionLabel(action: AdminAuditAction) {
  switch (action) {
    case "USER_STATUS_CHANGED":
      return { text: "Đổi trạng thái tài khoản", tone: "amber" as const };
    case "EMAIL_BLACKLISTED":
      return { text: "Chặn email", tone: "red" as const };
    case "EMAIL_BLACKLIST_DEACTIVATED":
      return { text: "Hủy chặn email", tone: "green" as const };
    case "MERCHANT_STATUS_CHANGED":
      return { text: "Đổi trạng thái cửa hàng", tone: "purple" as const };
    default:
      return { text: action, tone: "neutral" as const };
  }
}

function targetLabel(targetType: AdminAuditTargetType) {
  switch (targetType) {
    case "USER":
      return "Tài khoản";
    case "EMAIL_BLACKLIST":
      return "Danh sách đen";
    case "MERCHANT":
      return "Cửa hàng";
    default:
      return targetType;
  }
}

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
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");

  // Applied query filters
  const [appliedFilters, setAppliedFilters] = useState<{
    action?: AdminAuditAction;
    targetType?: AdminAuditTargetType;
    actorId?: number;
    targetId?: number;
    from?: string;
    to?: string;
  }>({});

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
    if (fromDateInput) {
      filters.from = new Date(fromDateInput).toISOString();
    }
    if (toDateInput) {
      // End of day
      const toDate = new Date(toDateInput);
      toDate.setHours(23, 59, 59, 999);
      filters.to = toDate.toISOString();
    }

    setAppliedFilters(filters);
  }

  function handleResetFilters() {
    setActionFilter("ALL");
    setTargetTypeFilter("ALL");
    setActorIdInput("");
    setTargetIdInput("");
    setFromDateInput("");
    setToDateInput("");
    setAppliedFilters({});
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

      {/* Filter toolbar */}
      <Card className="mb-6 p-4 sm:p-5">
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="audit-action" className="mb-1.5 block text-xs font-bold text-[#506154]">
                Hành động
              </label>
              <Select
                id="audit-action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as AdminAuditAction | "ALL")}
              >
                <option value="ALL">Tất cả hành động</option>
                <option value="USER_STATUS_CHANGED">Đổi trạng thái tài khoản</option>
                <option value="MERCHANT_STATUS_CHANGED">Đổi trạng thái cửa hàng</option>
                <option value="EMAIL_BLACKLISTED">Chặn email</option>
                <option value="EMAIL_BLACKLIST_DEACTIVATED">Hủy chặn email</option>
              </Select>
            </div>

            <div>
              <label htmlFor="audit-target" className="mb-1.5 block text-xs font-bold text-[#506154]">
                Đối tượng
              </label>
              <Select
                id="audit-target"
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value as AdminAuditTargetType | "ALL")}
              >
                <option value="ALL">Tất cả đối tượng</option>
                <option value="USER">Tài khoản (USER)</option>
                <option value="MERCHANT">Cửa hàng (MERCHANT)</option>
                <option value="EMAIL_BLACKLIST">Danh sách đen (EMAIL_BLACKLIST)</option>
              </Select>
            </div>

            <div>
              <label htmlFor="actor-id" className="mb-1.5 block text-xs font-bold text-[#506154]">
                ID Người thực hiện
              </label>
              <Input
                id="actor-id"
                type="number"
                min={1}
                placeholder="Ví dụ: 1"
                value={actorIdInput}
                onChange={(e) => setActorIdInput(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="target-id" className="mb-1.5 block text-xs font-bold text-[#506154]">
                ID Mục tiêu
              </label>
              <Input
                id="target-id"
                type="number"
                min={1}
                placeholder="Ví dụ: 5"
                value={targetIdInput}
                onChange={(e) => setTargetIdInput(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="from-date" className="mb-1.5 block text-xs font-bold text-[#506154]">
                Từ ngày
              </label>
              <Input
                id="from-date"
                type="date"
                value={fromDateInput}
                onChange={(e) => setFromDateInput(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="to-date" className="mb-1.5 block text-xs font-bold text-[#506154]">
                Đến ngày
              </label>
              <Input
                id="to-date"
                type="date"
                value={toDateInput}
                onChange={(e) => setToDateInput(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" size="default" className="flex-1">
                Lọc nhật ký
              </Button>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleResetFilters}
                title="Đặt lại bộ lọc"
              >
                <ArrowCounterClockwise size={16} />
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Main content */}
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
        <Card className="overflow-hidden">
          {/* Desktop Table Header */}
          <div className="hidden grid-cols-[10rem_13rem_9rem_11rem_minmax(0,1fr)_5rem] items-center gap-4 border-b border-[#edf1ea] bg-[#f7f9f5] px-6 py-4 text-xs font-bold text-[#5b6e60] lg:grid">
            <span>Thời gian</span>
            <span>Hành động</span>
            <span>Đối tượng</span>
            <span>Người thực hiện</span>
            <span>Lý do</span>
            <span className="text-right">Chi tiết</span>
          </div>

          <div className="divide-y divide-[#edf1ea]">
            {logs.map((log) => {
              const act = actionLabel(log.action);
              const isExpanded = expandedIds.has(log.id);

              return (
                <article key={log.id} className="p-5 sm:px-6">
                  <div className="grid gap-3 lg:grid-cols-[10rem_13rem_9rem_11rem_minmax(0,1fr)_5rem] lg:items-center lg:gap-4">
                    <span className="text-xs muted">
                      {shortDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    <div>
                      <StatusText tone={act.tone}>{act.text}</StatusText>
                    </div>

                    <div className="text-xs">
                      <span className="font-semibold text-[#324536]">{targetLabel(log.targetType)}</span>
                      <span className="ml-1 muted">#{log.targetId}</span>
                    </div>

                    <div className="min-w-0 text-xs muted">
                      <p className="truncate font-medium text-[#2f4233]">{log.actorEmail}</p>
                      <p className="text-[11px]">ID: #{log.actorId}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs leading-5 text-[#506154]">{log.reason}</p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#486b4f] hover:bg-[#edf3eb]"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <>
                            Ẩn <CaretUp size={14} />
                          </>
                        ) : (
                          <>
                            Xem <CaretDown size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Before / After details */}
                  {isExpanded && (
                    <div className="mt-4 rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4 text-xs">
                      <div className="mb-2 font-bold text-[#354839]">
                        Chi tiết thay đổi (Bản ghi kiểm toán #{log.id})
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3 shadow-xs">
                          <p className="mb-1.5 font-bold text-[#83453b]">Trạng thái trước (Before)</p>
                          <pre className="overflow-x-auto font-mono text-[11px] leading-4 text-[#506154]">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-xl bg-white p-3 shadow-xs">
                          <p className="mb-1.5 font-bold text-[#376943]">Trạng thái sau (After)</p>
                          <pre className="overflow-x-auto font-mono text-[11px] leading-4 text-[#506154]">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {nextCursor && (
            <div className="border-t border-[#edf1ea] p-4 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => fetchLogs(nextCursor)}
              >
                {loadingMore ? "Đang tải thêm..." : "Tải thêm"}
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
