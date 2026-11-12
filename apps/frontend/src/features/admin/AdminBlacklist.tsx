import { useState, useEffect, useCallback, type FormEvent } from "react";
import { MagnifyingGlass, Plus, CheckCircle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { AdminBlacklistEntryDto } from "../../api/commerce-types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "../../components/ui";
import { AdminReasonDialog } from "./AdminReasonDialog";
import { AddBlacklistDialog } from "./AddBlacklistDialog";
import { AdminBlacklistTable } from "./AdminBlacklistTable";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function explainBlacklistError(errorMsg: string) {
  if (errorMsg === "EMAIL_BLACKLIST_ACTIVE") {
    return "Email này đã nằm trong danh sách đen và đang hoạt động.";
  }
  if (errorMsg === "BLACKLIST_ENTRY_NOT_FOUND") {
    return "Không tìm thấy mục danh sách đen.";
  }
  if (errorMsg === "INVALID_STATE_TRANSITION") {
    return "Mục này đã bị hủy chặn trước đó.";
  }
  if (errorMsg === "INVALID_INPUT") {
    return "Dữ liệu không hợp lệ. Vui lòng kiểm tra định dạng email và lý do (1–255 ký tự).";
  }
  if (errorMsg === "FORBIDDEN") {
    return "Bạn không có quyền quản lý danh sách đen.";
  }
  return errorMsg || "Đã xảy ra lỗi khi xử lý danh sách đen.";
}

export function AdminBlacklist() {
  const { accessToken } = useAuthSession();
  const [entries, setEntries] = useState<AdminBlacklistEntryDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "true" | "false">("ALL");

  // Add Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Deactivate Dialog State
  const [deactivateTarget, setDeactivateTarget] = useState<AdminBlacklistEntryDto | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const fetchEntries = useCallback(
    async (cursor?: string) => {
      if (!accessToken) return;
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setFetchError(null);
      }

      try {
        const queryParams: {
          search?: string;
          active?: boolean;
          cursor?: string;
          limit?: number;
        } = { limit: 25 };

        if (appliedSearch.trim()) queryParams.search = appliedSearch.trim();
        if (activeFilter !== "ALL") queryParams.active = activeFilter === "true";
        if (cursor) queryParams.cursor = cursor;

        const response = await commerce.listAdminBlacklist(queryParams, accessToken);
        if (cursor) {
          setEntries((prev) => [...prev, ...response.items]);
        } else {
          setEntries(response.items);
        }
        setNextCursor(response.nextCursor);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Không tải được danh sách đen.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, appliedSearch, activeFilter],
  );

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setAppliedSearch(searchTerm);
  }

  function handleResetFilters() {
    setSearchTerm("");
    setAppliedSearch("");
    setActiveFilter("ALL");
  }

  async function handleAddConfirm(input: { email: string; reason: string }) {
    if (!accessToken) return;
    setAddBusy(true);
    setAddError(null);

    try {
      const response = await commerce.addAdminBlacklist(input, accessToken);
      setNotice(`Đã thêm ${response.entry.email} vào danh sách đen.`);
      setAddDialogOpen(false);
      void fetchEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể thêm vào danh sách đen.";
      setAddError(explainBlacklistError(msg));
    } finally {
      setAddBusy(false);
    }
  }

  async function handleConfirmDeactivate(reason: string) {
    if (!deactivateTarget || !accessToken) return;
    setDeactivateBusy(true);
    setDeactivateError(null);

    try {
      const response = await commerce.deactivateAdminBlacklist(
        deactivateTarget.id,
        { reason },
        accessToken,
      );
      setEntries((prev) =>
        prev.map((item) => (item.id === deactivateTarget.id ? response.entry : item)),
      );
      setNotice(`Đã hủy chặn email ${response.entry.email}.`);
      setDeactivateTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Thao tác hủy chặn thất bại.";
      setDeactivateError(explainBlacklistError(msg));
    } finally {
      setDeactivateBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Danh sách đen Email"
        description="Quản lý các địa chỉ email bị chặn đăng ký và đăng nhập hệ thống."
        action={
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus size={16} /> Thêm email chặn
          </Button>
        }
      />

      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between rounded-2xl bg-[#edf4e9] p-4 text-sm font-semibold text-[#376743]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline hover:no-underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter toolbar */}
      <Card className="mb-6 p-4 sm:p-5">
        <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="blacklist-search" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Tìm email
            </label>
            <div className="relative">
              <Input
                id="blacklist-search"
                type="text"
                placeholder="Nhập email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
              <MagnifyingGlass
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8f82]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="active-filter" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Trạng thái chặn
            </label>
            <Select
              id="active-filter"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as "ALL" | "true" | "false")}
            >
              <option value="ALL">Tất cả</option>
              <option value="true">Đang chặn (Active)</option>
              <option value="false">Đã hủy chặn (Inactive)</option>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" size="default" className="flex-1">
              Tìm kiếm
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
        </form>
      </Card>

      {/* Table / List */}
      {loading ? (
        <LoadingState cards={3} />
      ) : fetchError ? (
        <ErrorState message={explainBlacklistError(fetchError)} retry={() => fetchEntries()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Không có mục danh sách đen"
          description="Chưa có email nào trong danh sách đen hoặc không khớp với bộ lọc."
          action={
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              Thêm email chặn đầu tiên
            </Button>
          }
        />
      ) : (
        <AdminBlacklistTable
          entries={entries}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={() => nextCursor && fetchEntries(nextCursor)}
          onDeactivate={(entry) => setDeactivateTarget(entry)}
        />
      )}

      {/* Add to Blacklist Dialog */}
      <AddBlacklistDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setAddError(null);
        }}
        busy={addBusy}
        error={addError}
        onConfirm={handleAddConfirm}
      />

      {/* Deactivate Reason Dialog */}
      {deactivateTarget && (
        <AdminReasonDialog
          open={deactivateTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeactivateTarget(null);
              setDeactivateError(null);
            }
          }}
          title="Hủy chặn email?"
          description={`Email ${deactivateTarget.email} sẽ được gỡ khỏi trạng thái chặn và có thể đăng ký/đăng nhập lại.`}
          confirmLabel="Xác nhận hủy chặn"
          destructive={false}
          busy={deactivateBusy}
          error={deactivateError ?? undefined}
          onConfirm={handleConfirmDeactivate}
        />
      )}
    </>
  );
}
