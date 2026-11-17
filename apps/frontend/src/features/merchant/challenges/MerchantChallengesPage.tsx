import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createChallengesClient } from "../../../api/challenges-client";
import type { ChallengeEffectiveStatus, ChallengeType, ListMerchantChallengesParams, MerchantChallengeDto } from "../../../api/challenges-types";
import { useResource } from "../../../api/useResource";
import { useToken } from "../merchant-page-support";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Select, Input } from "../../../components/ui";
import { challengeStatusLabel, challengeTypeLabel } from "./challenge-labels";
import { MerchantChallengeCard } from "./MerchantChallengeCard";
import type { MerchantChallengeAction } from "./MerchantChallengeActions";

const api = createChallengesClient();
const statuses: Array<ChallengeEffectiveStatus | "ALL"> = ["ALL", "DRAFT", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"];
const types: Array<ChallengeType | "ALL"> = ["ALL", "ORDER_COUNT", "DAILY_CHECKIN", "SPEND_TOTAL"];

export function MerchantChallengesPage() {
  const token = useToken();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ChallengeEffectiveStatus | "ALL">("ALL");
  const [type, setType] = useState<ChallengeType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const filters = useMemo<ListMerchantChallengesParams>(() => ({
    q,
    status: status === "ALL" ? "" : status,
    type: type === "ALL" ? "" : type,
    page,
    limit: 20,
  }), [q, status, type, page]);
  const resource = useResource(() => api.listMerchantChallenges(filters, token), [filters, token, revision]);

  async function action(challenge: MerchantChallengeDto, operation: MerchantChallengeAction) {
    setError("");
    try {
      if (operation === "activate") await api.activateMerchantChallenge(challenge.id, token);
      if (operation === "pause") await api.pauseMerchantChallenge(challenge.id, token);
      if (operation === "archive") await api.archiveMerchantChallenge(challenge.id, token);
      if (operation === "feature") await api.updateMerchantChallenge(challenge.id, { isFeatured: !challenge.isFeatured }, token);
      if (operation === "delete") await api.deleteMerchantChallenge(challenge.id, token);
      setRevision((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật nhiệm vụ.");
    }
  }

  const pageCount = Math.max(1, resource.data?.pagination.totalPages ?? 1);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Nhiệm vụ"
        description="Tạo chiến dịch, theo dõi tiến độ và quản lý ngân sách điểm thưởng."
        action={<Button asChild><Link to="/merchant/challenges/new">Tạo nhiệm vụ</Link></Button>}
      />

      <div className="surface rounded-3xl p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1.3fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]">
          <Input aria-label="Tìm nhiệm vụ" placeholder="Tìm theo tên nhiệm vụ…" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
          <Select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
            <option value="ALL">Tất cả trạng thái</option>
            {statuses.filter((value): value is ChallengeEffectiveStatus => value !== "ALL").map((value) => <option key={value} value={value}>{challengeStatusLabel(value)}</option>)}
          </Select>
          <Select aria-label="Lọc loại nhiệm vụ" value={type} onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }}>
            <option value="ALL">Tất cả loại</option>
            {types.filter((value): value is ChallengeType => value !== "ALL").map((value) => <option key={value} value={value}>{challengeTypeLabel(value)}</option>)}
          </Select>
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {resource.loading && !resource.data ? <LoadingState cards={3} /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !resource.data?.items.length ? (
        <EmptyState title="Chưa có nhiệm vụ" description="Tạo nhiệm vụ đầu tiên để bắt đầu thu hút thành viên quay lại cửa hàng." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <p className="font-semibold text-[#526457]">{resource.data.pagination.totalItems.toLocaleString("vi-VN")} chiến dịch</p>
            <p className="text-xs muted">Điểm thưởng chỉ được ghi nhận khi thành viên hoàn thành mục tiêu.</p>
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {resource.data.items.map((item) => (
              <MerchantChallengeCard key={item.id} challenge={item} onAction={(operation) => void action(item, operation)} />
            ))}
          </div>
          <nav aria-label="Phân trang nhiệm vụ" className="flex flex-wrap items-center justify-end gap-3 border-t border-[#e8ede5] pt-4">
            <span className="mr-auto text-sm muted">Trang {resource.data.pagination.page} / {pageCount}</span>
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button>
            <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Sau</Button>
          </nav>
        </>
      )}
    </section>
  );
}
