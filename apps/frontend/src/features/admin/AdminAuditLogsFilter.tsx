import type { FormEvent } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import type { AdminAuditAction, AdminAuditTargetType } from "../../api/commerce-types";
import { Button, Card, Input, Select } from "../../components/ui";

interface AdminAuditLogsFilterProps {
  actionFilter: AdminAuditAction | "ALL";
  onActionFilterChange: (action: AdminAuditAction | "ALL") => void;
  targetTypeFilter: AdminAuditTargetType | "ALL";
  onTargetTypeFilterChange: (targetType: AdminAuditTargetType | "ALL") => void;
  actorIdInput: string;
  onActorIdInputChange: (val: string) => void;
  targetIdInput: string;
  onTargetIdInputChange: (val: string) => void;
  fromDateInput: string;
  onFromDateInputChange: (val: string) => void;
  toDateInput: string;
  onToDateInputChange: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
}

export function AdminAuditLogsFilter({
  actionFilter,
  onActionFilterChange,
  targetTypeFilter,
  onTargetTypeFilterChange,
  actorIdInput,
  onActorIdInputChange,
  targetIdInput,
  onTargetIdInputChange,
  fromDateInput,
  onFromDateInputChange,
  toDateInput,
  onToDateInputChange,
  onSubmit,
  onReset,
}: AdminAuditLogsFilterProps) {
  return (
    <Card className="mb-6 p-4 sm:p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="audit-action" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Hành động
            </label>
            <Select
              id="audit-action"
              value={actionFilter}
              onChange={(e) => onActionFilterChange(e.target.value as AdminAuditAction | "ALL")}
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="USER_STATUS_CHANGED">Đổi trạng thái tài khoản</option>
              <option value="MERCHANT_STATUS_CHANGED">Đổi trạng thái cửa hàng</option>
              <option value="EMAIL_BLACKLISTED">Chặn email</option>
              <option value="EMAIL_BLACKLIST_DEACTIVATED">Hủy chặn email</option>
            </Select>
          </div>

          <div>
            <label htmlFor="audit-target" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Đối tượng
            </label>
            <Select
              id="audit-target"
              value={targetTypeFilter}
              onChange={(e) => onTargetTypeFilterChange(e.target.value as AdminAuditTargetType | "ALL")}
            >
              <option value="ALL">Tất cả đối tượng</option>
              <option value="USER">Tài khoản (USER)</option>
              <option value="MERCHANT">Cửa hàng (MERCHANT)</option>
              <option value="EMAIL_BLACKLIST">Danh sách đen (EMAIL_BLACKLIST)</option>
            </Select>
          </div>

          <div>
            <label htmlFor="actor-id" className="mb-1.5 block text-xs font-bold text-[#506154]">
              ID Người thực hiện
            </label>
            <Input
              id="actor-id"
              type="number"
              min={1}
              placeholder="Ví dụ: 1"
              value={actorIdInput}
              onChange={(e) => onActorIdInputChange(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="target-id" className="mb-1.5 block text-xs font-bold text-[#506154]">
              ID Mục tiêu
            </label>
            <Input
              id="target-id"
              type="number"
              min={1}
              placeholder="Ví dụ: 5"
              value={targetIdInput}
              onChange={(e) => onTargetIdInputChange(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="from-date" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Từ ngày
            </label>
            <Input
              id="from-date"
              type="date"
              value={fromDateInput}
              onChange={(e) => onFromDateInputChange(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="to-date" className="mb-1.5 block text-xs font-bold text-[#506154]">
              Đến ngày
            </label>
            <Input
              id="to-date"
              type="date"
              value={toDateInput}
              onChange={(e) => onToDateInputChange(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <Button type="submit" size="default" className="flex-1">
              Lọc nhật ký
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
        </div>
      </form>
    </Card>
  );
}
