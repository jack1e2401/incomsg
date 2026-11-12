import { useState, useEffect, useCallback, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MagnifyingGlass, Plus, CheckCircle, WarningCircle, X, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { AdminBlacklistEntryDto } from "../../api/commerce-types";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusText,
  Textarea,
} from "../../components/ui";
import { AdminReasonDialog } from "./AdminReasonDialog";
import { shortDate } from "../../lib/utils";

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
  const [addEmail, setAddEmail] = useState("");
  const [addReason, setAddReason] = useState("");
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

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;

    const emailTrimmed = addEmail.trim().toLowerCase();
    const reasonTrimmed = addReason.trim();

    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setAddError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    if (reasonTrimmed.length < 1 || reasonTrimmed.length > 255) {
      setAddError("Lý do là bắt buộc (từ 1 đến 255 ký tự).");
      return;
    }

    setAddBusy(true);
    setAddError(null);

    try {
      const response = await commerce.addAdminBlacklist(
        { email: emailTrimmed, reason: reasonTrimmed },
        accessToken,
      );
      setNotice(`Đã thêm ${response.entry.email} vào danh sách đen.`);
      setAddDialogOpen(false);
      setAddEmail("");
      setAddReason("");
      // Refresh list
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
                      onClick={() => setDeactivateTarget(entry)}
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
                onClick={() => fetchEntries(nextCursor)}
              >
                {loadingMore ? "Đang tải thêm..." : "Tải thêm"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Add to Blacklist Dialog */}
      <Dialog.Root open={addDialogOpen} onOpenChange={(open) => !addBusy && setAddDialogOpen(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
            <div className="flex items-start justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fae7e3] text-[#a4473a]">
                <WarningCircle size={24} weight="light" />
              </span>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Đóng hộp thoại"
                  disabled={addBusy}
                  className="rounded-xl p-1.5 text-[#5e7264] hover:bg-[#edf2ea] disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Title className="mt-5 text-xl font-extrabold text-[#20392a]">
              Thêm email vào danh sách đen
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 muted">
              Email bị chặn sẽ không thể đăng ký tài khoản mới hoặc đăng nhập vào hệ thống.
            </Dialog.Description>

            <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
              <Field label="Địa chỉ email *">
                <Input
                  type="email"
                  required
                  maxLength={191}
                  placeholder="spam@example.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  disabled={addBusy}
                />
              </Field>

              <Field label="Lý do chặn *" hint={`${addReason.trim().length}/255 ký tự`}>
                <Textarea
                  required
                  maxLength={255}
                  rows={3}
                  placeholder="Nhập lý do chặn email này..."
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  disabled={addBusy}
                  className="min-h-24 resize-none"
                />
              </Field>

              {addError && (
                <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-xs leading-5 text-[#a4473a]">
                  {addError}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" disabled={addBusy}>
                    Hủy
                  </Button>
                </Dialog.Close>
                <Button type="submit" variant="danger" disabled={addBusy}>
                  {addBusy ? <BusyLabel>Đang thêm</BusyLabel> : "Thêm vào danh sách"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
