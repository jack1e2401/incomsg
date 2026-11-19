import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createChallengesClient, translateChallengeError } from "../../../api/challenges-client";
import type {
  ChallengeEffectiveStatus,
  ChallengeType,
  ListMerchantChallengesParams,
  MerchantChallengeDto,
} from "../../../api/challenges-types";
import { useResource } from "../../../api/useResource";
import { useToken } from "../merchant-page-support";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  Input,
} from "../../../components/ui";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { challengeStatusLabel, challengeTypeLabel } from "./challenge-labels";
import { MerchantChallengeCard } from "./MerchantChallengeCard";
import type { MerchantChallengeAction } from "./MerchantChallengeActions";

const api = createChallengesClient();
const statuses: Array<ChallengeEffectiveStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ENDED",
  "ARCHIVED",
];
const types: Array<ChallengeType | "ALL"> = ["ALL", "ORDER_COUNT", "DAILY_CHECKIN", "SPEND_TOTAL"];
type ConfirmableChallengeAction = Extract<MerchantChallengeAction, "archive" | "delete">;
type PendingChallengeAction = { challenge: MerchantChallengeDto; operation: ConfirmableChallengeAction };

export function MerchantChallengesPage() {
  const token = useToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status");
  const status = statuses.includes(rawStatus as ChallengeEffectiveStatus)
    ? (rawStatus as ChallengeEffectiveStatus)
    : "ALL";
  const rawType = searchParams.get("type");
  const type = types.includes(rawType as ChallengeType) ? (rawType as ChallengeType) : "ALL";
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingChallengeAction | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  function updateSearchParam(key: "q" | "status" | "type" | "page", value: string) {
    const next = new URLSearchParams(searchParams);
    const normalized = value === "ALL" ? "" : value;
    if (normalized) next.set(key, normalized);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  }

  const filters = useMemo<ListMerchantChallengesParams>(
    () => ({
      q,
      status: status === "ALL" ? "" : status,
      type: type === "ALL" ? "" : type,
      page,
      limit: 20,
    }),
    [q, status, type, page],
  );
  const resource = useResource(() => api.listMerchantChallenges(filters, token), [filters, token, revision]);

  async function action(challenge: MerchantChallengeDto, operation: MerchantChallengeAction) {
    setError("");
    if (operation === "archive" || operation === "delete") {
      setConfirmError("");
      setPendingAction({ challenge, operation });
      return;
    }
    try {
      await api.updateMerchantChallenge(challenge.id, { isFeatured: !challenge.isFeatured }, token);
      setRevision((current) => current + 1);
    } catch (reason) {
      setError(translateChallengeError(reason instanceof Error ? reason.message : "INVALID_INPUT"));
    }
  }

  async function confirmArchiveOrDelete() {
    if (!pendingAction || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError("");
    try {
      if (pendingAction.operation === "archive")
        await api.archiveMerchantChallenge(pendingAction.challenge.id, token);
      else await api.deleteMerchantChallenge(pendingAction.challenge.id, token);
      setPendingAction(null);
      setRevision((current) => current + 1);
    } catch (reason) {
      setConfirmError(translateChallengeError(reason instanceof Error ? reason.message : "INVALID_INPUT"));
    } finally {
      setConfirmBusy(false);
    }
  }

  const pageCount = Math.max(1, resource.data?.pagination.totalPages ?? 1);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Nhiệm vụ"
        description="Tạo chiến dịch, theo dõi tiến độ và quản lý ngân sách điểm thưởng."
        action={
          <Button asChild>
            <Link to="/merchant/challenges/new">Tạo nhiệm vụ</Link>
          </Button>
        }
      />

      {pendingAction && (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingAction(null);
              setConfirmError("");
            }
          }}
          title={pendingAction.operation === "delete" ? "Xóa nhiệm vụ?" : "Lưu trữ nhiệm vụ?"}
          description={
            pendingAction.operation === "delete"
              ? "Nhiệm vụ sẽ bị xóa vĩnh viễn khỏi cửa hàng. Thao tác này không thể hoàn tác."
              : "Nhiệm vụ sẽ ngừng nhận tiến độ mới. Tiến độ hiện tại và lịch sử thưởng vẫn được giữ lại."
          }
          confirmLabel={pendingAction.operation === "delete" ? "Xóa nhiệm vụ" : "Lưu trữ"}
          destructive={pendingAction.operation === "delete"}
          busy={confirmBusy}
          error={confirmError}
          onConfirm={() => void confirmArchiveOrDelete()}
        />
      )}

      <div className="surface rounded-3xl p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1.3fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]">
          <Input
            aria-label="Tìm nhiệm vụ"
            placeholder="Tìm theo tên nhiệm vụ…"
            value={q}
            onChange={(event) => updateSearchParam("q", event.target.value)}
          />
          <Select
            aria-label="Lọc trạng thái"
            value={status}
            onChange={(event) => updateSearchParam("status", event.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {statuses
              .filter((value): value is ChallengeEffectiveStatus => value !== "ALL")
              .map((value) => (
                <option key={value} value={value}>
                  {challengeStatusLabel(value)}
                </option>
              ))}
          </Select>
          <Select
            aria-label="Lọc loại nhiệm vụ"
            value={type}
            onChange={(event) => updateSearchParam("type", event.target.value)}
          >
            <option value="ALL">Tất cả loại</option>
            {types
              .filter((value): value is ChallengeType => value !== "ALL")
              .map((value) => (
                <option key={value} value={value}>
                  {challengeTypeLabel(value)}
                </option>
              ))}
          </Select>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {resource.loading && !resource.data ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.items.length ? (
        <EmptyState
          title="Chưa có nhiệm vụ"
          description="Tạo nhiệm vụ đầu tiên để bắt đầu thu hút thành viên quay lại cửa hàng."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <p className="font-semibold text-[#526457]">
              {resource.data.pagination.totalItems.toLocaleString("vi-VN")} chiến dịch
            </p>
            <p className="text-xs muted">Điểm thưởng chỉ được ghi nhận khi thành viên hoàn thành mục tiêu.</p>
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {resource.data.items.map((item) => (
              <MerchantChallengeCard
                key={item.id}
                challenge={item}
                token={token}
                onAction={(operation) => void action(item, operation)}
                onStatusChange={() => setRevision((current) => current + 1)}
              />
            ))}
          </div>
          <nav
            aria-label="Phân trang nhiệm vụ"
            className="flex flex-wrap items-center justify-end gap-3 border-t border-[#e8ede5] pt-4"
          >
            <span className="mr-auto text-sm muted">
              Trang {resource.data.pagination.page} / {pageCount}
            </span>
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => updateSearchParam("page", String(page - 1))}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => updateSearchParam("page", String(page + 1))}
            >
              Sau
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
