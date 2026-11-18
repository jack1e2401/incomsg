import type { ReactNode } from "react";
import { Empty, Table, type TableProps } from "antd";

type CmsDataTableProps<T extends object> = Omit<
  TableProps<T>,
  "dataSource" | "loading" | "locale"
> & {
  label: string;
  rows: T[];
  loading?: boolean;
  emptyText?: ReactNode;
};

export function CmsDataTable<T extends object>({
  label,
  rows,
  loading = false,
  emptyText,
  pagination,
  scroll = { x: "max-content" },
  ...tableProps
}: CmsDataTableProps<T>) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[#e3e9e2] bg-white">
      <Table<T>
        {...tableProps}
        aria-label={label}
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: emptyText ?? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" /> }}
        pagination={pagination ?? false}
        scroll={scroll}
        size="middle"
      />
    </div>
  );
}
