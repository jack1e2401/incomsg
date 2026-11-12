import { useState, useEffect, useCallback, type FormEvent } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  AccountStatus,
  AdminUserDto,
  AdminUserRole,
} from "../../api/commerce-types";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { AdminReasonDialog } from "./AdminReasonDialog";
import { AdminUsersFilter } from "./AdminUsersFilter";
import { AdminUsersTable } from "./AdminUsersTable";

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

      <AdminUsersFilter
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        onSubmit={handleSearchSubmit}
        onReset={handleResetFilters}
      />

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
        <AdminUsersTable
          users={users}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={() => nextCursor && fetchUsers(nextCursor)}
          onSelectAction={(user, targetStatus) => setActionTarget({ user, targetStatus })}
        />
      )}

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
