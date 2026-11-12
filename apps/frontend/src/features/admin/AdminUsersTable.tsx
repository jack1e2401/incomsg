import { CheckCircle, Prohibit, ShieldWarning } from "@phosphor-icons/react";
import type { AccountStatus, AdminUserDto, AdminUserRole } from "../../api/commerce-types";
import { Button, Card, StatusText } from "../../components/ui";
import { shortDate } from "../../lib/utils";

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

interface AdminUsersTableProps {
  users: AdminUserDto[];
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelectAction: (user: AdminUserDto, targetStatus: "ACTIVE" | "SUSPENDED" | "BANNED") => void;
}

export function AdminUsersTable({
  users,
  nextCursor,
  loadingMore,
  onLoadMore,
  onSelectAction,
}: AdminUsersTableProps) {
  return (
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
                    onClick={() => onSelectAction(user, "ACTIVE")}
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
                    onClick={() => onSelectAction(user, "SUSPENDED")}
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
                    onClick={() => onSelectAction(user, "BANNED")}
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
            onClick={onLoadMore}
          >
            {loadingMore ? "Đang tải thêm..." : "Tải thêm"}
          </Button>
        </div>
      )}
    </Card>
  );
}
