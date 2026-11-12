import type { AdminBlacklistEntryDto } from "../../api/commerce-types";
import { Button, Card, StatusText } from "../../components/ui";
import { shortDate } from "../../lib/utils";

interface AdminBlacklistTableProps {
  entries: AdminBlacklistEntryDto[];
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDeactivate: (entry: AdminBlacklistEntryDto) => void;
}

export function AdminBlacklistTable({
  entries,
  nextCursor,
  loadingMore,
  onLoadMore,
  onDeactivate,
}: AdminBlacklistTableProps) {
  return (
    <Card className="overflow-hidden">
      {/* Desktop header */}
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_7rem_10rem_8rem] items-center gap-4 border-b border-[#edf1ea] bg-[#f7f9f5] px-6 py-4 text-xs font-bold text-[#5b6e60] md:grid">
        <span>Email</span>
        <span>Lý do</span>
        <span>Trạng thái</span>
        <span>Người thực hiện</span>
        <span className="text-right">Thao tác</span>
      </div>

      <div className="divide-y divide-[#edf1ea]">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="grid gap-3 p-5 transition-colors hover:bg-[#fafbf8] sm:px-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_7rem_10rem_8rem] md:items-center md:gap-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#233829]">{entry.email}</p>
              <p className="mt-1 text-xs muted md:hidden">Cập nhật: {shortDate(entry.updatedAt)}</p>
            </div>

            <div className="min-w-0">
              <p className="line-clamp-2 text-xs leading-5 text-[#506154]">{entry.reason}</p>
            </div>

            <div className="flex items-center justify-between md:justify-start">
              <span className="text-xs muted md:hidden">Trạng thái:</span>
              {entry.isActive ? (
                <StatusText tone="red">Đang chặn</StatusText>
              ) : (
                <StatusText tone="neutral">Đã hủy chặn</StatusText>
              )}
            </div>

            <div className="min-w-0 text-xs muted">
              <p className="truncate">{entry.lastActorEmail}</p>
              <p className="mt-0.5 text-[11px]">{shortDate(entry.updatedAt)}</p>
            </div>

            <div className="flex justify-end pt-2 md:pt-0">
              {entry.isActive ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDeactivate(entry)}
                  title={`Hủy chặn email ${entry.email}`}
                >
                  Hủy chặn
                </Button>
              ) : (
                <span className="text-xs italic text-[#8a988d]">Không khả dụng</span>
              )}
            </div>
          </article>
        ))}
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
