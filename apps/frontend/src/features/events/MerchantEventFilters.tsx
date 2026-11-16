import type { FormEvent } from "react";
import type { EventStatus } from "../../api/events-types";
import { Button, Card, Input, Select } from "../../components/ui";

export interface MerchantEventFiltersProps {
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  statusFilter: EventStatus | "";
  onStatusFilterChange: (val: EventStatus | "") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function MerchantEventFilters({
  searchInput,
  onSearchInputChange,
  statusFilter,
  onStatusFilterChange,
  onSubmit,
}: MerchantEventFiltersProps) {
  return (
    <Card className="mb-6 p-4 sm:p-5">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <Input
          aria-label="Tìm kiếm sự kiện"
          placeholder="Tìm theo tiêu đề, địa điểm hoặc slug..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
        />
        <Select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as EventStatus | "")}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="PUBLISHED">Đã xuất bản</option>
        </Select>
        <Button type="submit" variant="outline">
          Tìm kiếm
        </Button>
      </form>
    </Card>
  );
}
