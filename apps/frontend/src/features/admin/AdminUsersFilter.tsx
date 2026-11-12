import type { FormEvent } from "react";
import { ArrowCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import type { AccountStatus, AdminUserRole } from "../../api/commerce-types";
import { Button, Card, Input, Select } from "../../components/ui";

interface AdminUsersFilterProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: AccountStatus | "ALL";
  onStatusFilterChange: (status: AccountStatus | "ALL") => void;
  roleFilter: AdminUserRole | "ALL";
  onRoleFilterChange: (role: AdminUserRole | "ALL") => void;
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
}

export function AdminUsersFilter({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
  onSubmit,
  onReset,
}: AdminUsersFilterProps) {
  return (
    <Card className="mb-6 p-4 sm:p-5">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              onChange={(e) => onSearchTermChange(e.target.value)}
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
            onChange={(e) => onStatusFilterChange(e.target.value as AccountStatus | "ALL")}
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
            onChange={(e) => onRoleFilterChange(e.target.value as AdminUserRole | "ALL")}
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
            onClick={onReset}
            title="Đặt lại bộ lọc"
          >
            <ArrowCounterClockwise size={16} />
          </Button>
        </div>
      </form>
    </Card>
  );
}
