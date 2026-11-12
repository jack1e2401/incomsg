import type { AdminAbuseReportDto } from "../../api/commerce-types";
import { Button, Card, StatusText } from "../../components/ui";
import { money, shortDate } from "../../lib/utils";

function orderStatusBadge(status: string) {
  switch (status) {
    case "PAID":
      return <StatusText tone="green">Đã thanh toán</StatusText>;
    case "PENDING":
    case "REFUND_PENDING":
      return <StatusText tone="amber">{status === "PENDING" ? "Chờ thanh toán" : "Đang hoàn tiền"}</StatusText>;
    case "REFUNDED":
      return <StatusText tone="purple">Đã hoàn tiền</StatusText>;
    case "FAILED":
      return <StatusText tone="red">Thất bại</StatusText>;
    case "CANCELLED":
      return <StatusText tone="neutral">Đã hủy</StatusText>;
    default:
      return <StatusText tone="neutral">{status}</StatusText>;
  }
}

interface AdminAbuseReportsTableProps {
  reports: AdminAbuseReportDto[];
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function AdminAbuseReportsTable({
  reports,
  nextCursor,
  loadingMore,
  onLoadMore,
}: AdminAbuseReportsTableProps) {
  return (
    <Card className="overflow-hidden">
      {/* Desktop table header */}
      <div className="hidden grid-cols-[4rem_9rem_11rem_12rem_12rem_11rem_minmax(0,1fr)] items-center gap-4 border-b border-[#edf1ea] bg-[#f7f9f5] px-6 py-4 text-xs font-bold text-[#5b6e60] xl:grid">
        <span>ID</span>
        <span>Thời gian</span>
        <span>Cửa hàng</span>
        <span>Người báo cáo</span>
        <span>Thành viên</span>
        <span>Đơn hàng</span>
        <span>Lý do</span>
      </div>

      {/* List items */}
      <div className="divide-y divide-[#edf1ea]">
        {reports.map((report) => (
          <article
            key={report.id}
            className="grid gap-3 p-5 transition-colors hover:bg-[#fafbf8] sm:px-6 xl:grid-cols-[4rem_9rem_11rem_12rem_12rem_11rem_minmax(0,1fr)] xl:items-start xl:gap-4"
          >
            <span className="text-xs font-semibold muted">#{report.id}</span>

            <div className="text-xs muted">
              <p className="font-medium text-[#2f4233]">{shortDate(report.createdAt)}</p>
              <p className="text-[11px]">
                {new Date(report.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="min-w-0 text-xs">
              <span className="font-bold text-[#233829]">{report.merchant?.name ?? "Cửa hàng"}</span>
              <p className="muted text-[11px]">ID: #{report.merchantId}</p>
            </div>

            <div className="min-w-0 text-xs">
              <p className="truncate font-medium text-[#2f4233]">{report.reporter?.email ?? "—"}</p>
              <p className="muted text-[11px]">ID: #{report.reporterId}</p>
            </div>

            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold text-[#294833]">{report.member?.email ?? "—"}</p>
              <p className="muted text-[11px]">ID: #{report.memberId}</p>
            </div>

            <div className="text-xs">
              {report.orderId ? (
                <div>
                  <p className="font-semibold text-[#294833]">Đơn #{report.orderId}</p>
                  {report.order && (
                    <div className="mt-1 space-y-0.5">
                      <p className="muted text-[11px]">{money(Number(report.order.total))}</p>
                      <div>{orderStatusBadge(report.order.status)}</div>
                    </div>
                  )}
                </div>
              ) : (
                <span className="muted">—</span>
              )}
            </div>

            <div className="min-w-0">
              <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[#3b4e40]">
                {report.reason}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Pagination / Cursor */}
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
