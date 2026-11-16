import { ArrowCounterClockwise } from "@phosphor-icons/react";
import type { StorefrontVersionSummaryDto } from "../../api/storefront-types";
import { BusyLabel, Button, Card, StatusText } from "../../components/ui";

function sourceLabel(source: StorefrontVersionSummaryDto["source"]): string {
  switch (source) {
    case "DEFAULT_INIT":
      return "Khởi tạo mặc định";
    case "PUBLISH":
      return "Xuất bản";
    case "ROLLBACK":
      return "Khôi phục";
    default:
      return source;
  }
}

export function StorefrontVersionHistory({
  versions,
  busyVersionId,
  onRollback,
}: {
  versions: StorefrontVersionSummaryDto[];
  busyVersionId: number | null;
  onRollback: (versionId: number) => void;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-[#20392a]">Lịch sử phiên bản</h2>
      {!versions.length ? (
        <p className="mt-3 text-sm muted">Chưa có phiên bản nào được xuất bản.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#e8ece5]">
          {versions.map((version) => (
            <li key={version.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-[#24452f]">Phiên bản v{version.version}</span>
                  <StatusText tone={version.isPublished ? "green" : "neutral"}>
                    {version.isPublished ? "Đang hiển thị" : sourceLabel(version.source)}
                  </StatusText>
                </div>
                {version.note && <p className="mt-1 text-sm text-[#405b47] break-words">{version.note}</p>}
                <p className="mt-1 text-xs muted">
                  {new Date(version.publishedAt).toLocaleString("vi-VN")}
                </p>
              </div>
              {!version.isPublished && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyVersionId !== null}
                  onClick={() => onRollback(version.id)}
                >
                  {busyVersionId === version.id ? (
                    <BusyLabel>Đang khôi phục</BusyLabel>
                  ) : (
                    <>
                      <ArrowCounterClockwise aria-hidden="true" size={15} /> Khôi phục phiên bản này
                    </>
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
