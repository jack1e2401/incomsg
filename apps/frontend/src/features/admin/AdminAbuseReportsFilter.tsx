import type { FormEvent } from "react";
import { ArrowCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { Button, Card, Input } from "../../components/ui";

interface AdminAbuseReportsFilterProps {
  merchantIdInput: string;
  onMerchantIdInputChange: (value: string) => void;
  memberIdInput: string;
  onMemberIdInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
}

export function AdminAbuseReportsFilter({
  merchantIdInput,
  onMerchantIdInputChange,
  memberIdInput,
  onMemberIdInputChange,
  onSubmit,
  onReset,
}: AdminAbuseReportsFilterProps) {
  return (
    <Card className="mb-6 p-4 sm:p-5">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="filter-merchant-id" className="mb-1.5 block text-xs font-bold text-[#506154]">
            ID Cửa hàng
          </label>
          <div className="relative">
            <Input
              id="filter-merchant-id"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="VD: 1"
              value={merchantIdInput}
              onChange={(e) => onMerchantIdInputChange(e.target.value)}
              className="pr-9"
            />
            <MagnifyingGlass
              size={17}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8f82]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="filter-member-id" className="mb-1.5 block text-xs font-bold text-[#506154]">
            ID Thành viên
          </label>
          <div className="relative">
            <Input
              id="filter-member-id"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="VD: 2"
              value={memberIdInput}
              onChange={(e) => onMemberIdInputChange(e.target.value)}
              className="pr-9"
            />
            <MagnifyingGlass
              size={17}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8f82]"
            />
          </div>
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
