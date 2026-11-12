import { useState, useEffect, useCallback, type FormEvent } from "react";
import { MagnifyingGlass, ShieldWarning, Prohibit, CheckCircle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  AccountStatus,
  AdminUserDto,
  AdminUserRole,
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
import { AdminReasonDialog } from "./AdminReasonDialog";
import { shortDate } from "../../lib/utils";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function explainUserError(errorMsg: string) {
  if (errorMsg === "INVALID_STATE_TRANSITION") {
    return "Chuyển đổi trạng thái không hợp lệ hoặc tài khoản đã ở trạng thái này.";
  }
  if (errorMsg === "USER_NOT_FOUND") {
    return "Không tìm thấy người dùng.";
  }
  if (errorMsg === "FORBIDDEN") {
    return "Bạn không có quyền thực hiện thao tác kiểm duyệt này.";
  }
  if (errorMsg === "INVALID_INPUT") {
    return "Dữ liệu nhập vào không hợp lệ. Vui lòng kiểm tra lý do (1–255 ký tự).";
  }
  return errorMsg || "Đã xảy ra lỗi khi cập nhật trạng thái.";
}

function AccountStatusBadge({ status }: { status: AccountStatus }) {
  switch (status) {
    case "ACTIVE":
      return <StatusText tone="green">Hoạt động</StatusText>;
    case "SUSPENDED":
      return <StatusText tone="amber">Tạm khóa</StatusText>;
    case "BANNED":
      return <StatusText tone="red">Bị cấm</StatusText>;
    case "PENDING_APPROVAL":
      return <StatusText tone="purple">Chờ duyệt</StatusText>;
    case "REJECTED":
      return <StatusText tone="red">Từ chối</StatusText>;
    default:
      return <StatusText tone="neutral">{status}</StatusText>;
  }
}

function RoleBadge({ role }: { role: AdminUserRole }) {
  const label = role === "ADMIN" ? "Admin" : role === "MERCHANT" ? "Merchant" : "Member";
  const tone = role === "ADMIN" ? "purple" : role === "MERCHANT" ? "green" : "neutral";
  return <StatusText tone={tone}>{label}</StatusText>;
}

export function AdminUsers() {
  const { accessToken } = useAuthSession();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "ALL">("ALL");
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "ALL">("ALL");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Action dialog state
  const [actionTarget, setActionTarget] = useState<{
    user: AdminUserDto;
    targetStatus: "ACTIVE" | "SUSPENDED" | "BANNED";
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchUsers = useCallback(
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
          status?: AccountStatus;
          role?: AdminUserRole;
          cursor?: string;
          limit?: number;
        } = { limit: 25 };

        if (appliedSearch.trim()) queryParams.search = appliedSearch.trim();
        if (statusFilter !== "ALL") queryParams.status = statusFilter;
        if (roleFilter !== "ALL") queryParams.role = roleFilter;
        if (cursor) queryParams.cursor = cursor;

        const response = await commerce.listAdminUsers(queryParams, accessToken);
        if (cursor) {
          setUsers((prev) => [...prev, ...response.items]);
        } else {
          setUsers(response.items);
        }
        setNextCursor(response.nextCursor);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Không tải được danh sách người dùng.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, appliedSearch, statusFilter, roleFilter],
  );

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setAppliedSearch(searchTerm);
  }

  function handleResetFilters() {
    setSearchTerm("");
    setAppliedSearch("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
  }

  async function handleConfirmStatusChange(reason: string) {
    if (!actionTarget || !accessToken) return;
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await commerce.changeAdminUserStatus(
        actionTarget.user.id,
        { status: actionTarget.targetStatus, reason },
        accessToken,
      );

      // Update in local list
      setUsers((prev) =>
        prev.map((u) => (u.id === actionTarget.user.id ? response.user : u)),
      );

      const statusLabels = {
        ACTIVE: "Mở khóa",
        SUSPENDED: "Tạm khóa",
        BANNED: "Cấm",
      };
      setActionNotice(
        `Đã ${statusLabels[actionTarget.targetStatus]} tài khoản ${response.user.email} thành công.`,
      );
      setActionTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Thao tác thất bại.";
      setActionError(explainUserError(msg));
    } finally {
      setActionBusy(false);
    }
  }

  const dialogDetails = actionTarget
    ? {
        title:
          actionTarget.targetStatus === "BANNED"
            ? "Cấm tài khoản?"
            : actionTarget.targetStatus === "SUSPENDED"
              ? "Tạm khóa tài khoản?"
              : "Mở khóa tài khoản?",
        description:
          actionTarget.targetStatus === "BANNED"
            ? `Cấm ${actionTarget.user.email} sẽ chặn đăng nhập và từ chối các yêu cầu cho đến khi Admin mở khóa.`
            : actionTarget.targetStatus === "SUSPENDED"
              ? `Tạm khóa ${actionTarget.user.email} sẽ tạm thời vô hiệu hóa quyền truy cập.`
              : `Mở khóa ${actionTarget.user.email} sẽ cho phép tài khoản hoạt động trở lại.`,
        confirmLabel:
          actionTarget.targetStatus === "BANNED"
            ? "Xác nhận cấm"
            : actionTarget.targetStatus === "SUSPENDED"
              ? "Xác nhận tạm khóa"
              : "Xác nhận mở khóa",
        destructive: actionTarget.targetStatus !== "ACTIVE",
      }
    : null;

  return (
    <>
      <PageHeader
        title="Quản lý người dùng"
        description="Tìm kiếm, theo dõi trạng thái và kiểm duyệt tài khoản hệ thống."
      />

      {actionNotice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between rounded-2xl bg-[#edf4e9] p-4 text-sm font-semibold text-[#376743]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs underline hover:no-underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter toolbar */}
      <Card className="mb-6 p-4 sm:p-5">
        <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="user-search" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Tìm theo email
            </label>
            <div className="relative">
              <Input
                id="user-search"
                type="text"
                maxLength={191}
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
            <label htmlFor="status-filter" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Trạng thái
            </label>
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "ALL")}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="SUSPENDED">Tạm khóa (SUSPENDED)</option>
              <option value="BANNED">Bị cấm (BANNED)</option>
              <option value="PENDING_APPROVAL">Chờ duyệt (PENDING_APPROVAL)</option>
              <option value="REJECTED">Từ chối (REJECTED)</option>
            </Select>
          </div>

          <div>
            <label htmlFor="role-filter" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Vai trò
            </label>
            <Select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AdminUserRole | "ALL")}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="MEMBER">Member</option>
              <option value="MERCHANT">Merchant</option>
              <option value="ADMIN">Admin</option>
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

      {/* Main content */}
      {loading ? (
        <LoadingState cards={3} />
      ) : fetchError ? (
        <ErrorState message={explainUserError(fetchError)} retry={() => fetchUsers()} />
      ) : users.length === 0 ? (
        <EmptyState
          title="Không tìm thấy người dùng"
          description="Không có tài khoản nào phù hợp với tiêu chí tìm kiếm hiện tại."
          action={
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Xóa bộ lọc
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden grid-cols-[3rem_minmax(0,1.5fr)_7rem_7rem_9rem_14rem] items-center gap-4 border-b border-[#edf1ea] bg-[#f7f9f5] px-6 py-4 text-xs font-bold text-[#5b6e60] md:grid">
            <span>ID</span>
            <span>Email</span>
            <span>Vai trò</span>
            <span>Trạng thái</span>
            <span>Ngày tạo</span>
            <span className="text-right">Thao tác</span>
          </div>

          {/* List items */}
          <div className="divide-y divide-[#edf1ea]">
            {users.map((user) => {
              const canSuspend = user.accountStatus !== "SUSPENDED" && user.accountStatus !== "BANNED";
              const canBan = user.accountStatus !== "BANNED";
              const canUnban = user.accountStatus === "SUSPENDED" || user.accountStatus === "BANNED";

              return (
                <article
                  key={user.id}
                  className="grid gap-3 p-5 transition-colors hover:bg-[#fafbf8] sm:px-6 md:grid-cols-[3rem_minmax(0,1.5fr)_7rem_7rem_9rem_14rem] md:items-center md:gap-4"
                >
                  <span className="text-xs font-semibold muted">#{user.id}</span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#233829]">{user.email}</p>
                    <p className="mt-1 text-xs muted md:hidden">
                      {shortDate(user.createdAt)} · <RoleBadge role={user.role} />
                    </p>
                  </div>

                  <div className="hidden md:block">
                    <RoleBadge role={user.role} />
                  </div>

                  <div className="flex items-center justify-between md:justify-start">
                    <span className="text-xs muted md:hidden">Trạng thái:</span>
                    <AccountStatusBadge status={user.accountStatus} />
                  </div>

                  <div className="hidden text-xs muted md:block">{shortDate(user.createdAt)}</div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 md:pt-0">
                    {/* Unban / Unsuspend button */}
                    {canUnban && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setActionTarget({ user, targetStatus: "ACTIVE" })
                        }
                        title={`Mở khóa tài khoản ${user.email}`}
                      >
                        <CheckCircle size={15} /> Mở khóa
                      </Button>
                    )}

                    {/* Suspend button */}
                    {canSuspend && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setActionTarget({ user, targetStatus: "SUSPENDED" })
                        }
                        title={`Tạm khóa tài khoản ${user.email}`}
                      >
                        <ShieldWarning size={15} /> Tạm khóa
                      </Button>
                    )}

                    {/* Ban button */}
                    {canBan && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setActionTarget({ user, targetStatus: "BANNED" })
                        }
                        title={`Cấm tài khoản ${user.email}`}
                      >
                        <Prohibit size={15} /> Cấm
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Load more / Pagination */}
          {nextCursor && (
            <div className="border-t border-[#edf1ea] p-4 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => fetchUsers(nextCursor)}
              >
                {loadingMore ? "Đang tải thêm..." : "Tải thêm"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Confirmation & Reason Dialog */}
      {actionTarget && dialogDetails && (
        <AdminReasonDialog
          open={actionTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActionTarget(null);
              setActionError(null);
            }
          }}
          title={dialogDetails.title}
          description={dialogDetails.description}
          confirmLabel={dialogDetails.confirmLabel}
          destructive={dialogDetails.destructive}
          busy={actionBusy}
          error={actionError ?? undefined}
          onConfirm={handleConfirmStatusChange}
        />
      )}
    </>
  );
}
