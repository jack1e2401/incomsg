import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type {
  AdminAuditAction,
  AdminAuditLogDto,
  AdminAuditTargetType,
} from "../../api/commerce-types";
import { Button, Card, StatusText } from "../../components/ui";
import { shortDate } from "../../lib/utils";

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

interface AdminAuditLogsTableProps {
  logs: AdminAuditLogDto[];
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function AdminAuditLogsTable({
  logs,
  expandedIds,
  onToggleExpand,
  nextCursor,
  loadingMore,
  onLoadMore,
}: AdminAuditLogsTableProps) {
  return (
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
                  {shortDate(log.createdAt)}{" "}
                  {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
                    onClick={() => onToggleExpand(log.id)}
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
            onClick={onLoadMore}
          >
            {loadingMore ? "Đang tải thêm..." : "Tải thêm"}
          </Button>
        </div>
      )}
    </Card>
  );
}
