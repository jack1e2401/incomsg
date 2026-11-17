import { useState } from "react";
import { Select, Typography, type TableColumnsType } from "antd";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import type { Order } from "../../../api/types";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { money, shortDate } from "../../../lib/utils";
import { CmsDataTable, CmsFilterBar, CmsPageHeader, CmsStatusTag } from "../cms";
import { useMerchantId } from "./useMerchantId";

type OrderFilter = "ALL" | "PENDING" | "PAID";

export function MerchantOrders() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listOrders(id), [id]);
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const orders = resource.data?.filter((order) => filter === "ALL" || order.status === filter) ?? [];
  const columns: TableColumnsType<Order> = [
    {
      title: "Đơn hàng",
      dataIndex: "id",
      key: "id",
      render: (id: string) => <Typography.Text strong>Đơn {id}</Typography.Text>,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: shortDate,
    },
    { title: "Thành viên", dataIndex: "memberName", key: "memberName" },
    {
      title: "Sản phẩm",
      key: "items",
      render: (_: unknown, order) => order.items.map((item) => `${item.name} × ${item.quantity}`).join(", "),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: Order["status"]) => (
        <CmsStatusTag label={status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"} tone={status === "PAID" ? "success" : "warning"} />
      ),
    },
    {
      title: "Điểm đã xác nhận",
      dataIndex: "earnedPoints",
      key: "earnedPoints",
      align: "right",
      render: (points: number, order) => order.status === "PAID" ? `+${points} điểm` : "—",
    },
    {
      title: "Tổng tiền",
      dataIndex: "total",
      key: "total",
      align: "right",
      render: money,
    },
  ];

  return (
    <>
      <CmsPageHeader title="Đơn hàng" />
      <CmsFilterBar label="Lọc đơn hàng">
        <label className="min-w-52 text-sm">
          <span className="mb-1 block text-xs text-[#59685e]">Trạng thái thanh toán</span>
          <Select
            aria-label="Trạng thái thanh toán"
            className="w-full"
            value={filter}
            onChange={(value: OrderFilter) => setFilter(value)}
            options={[
              { value: "ALL", label: "Tất cả trạng thái" },
              { value: "PENDING", label: "Chờ thanh toán" },
              { value: "PAID", label: "Đã thanh toán" },
            ]}
          />
        </label>
      </CmsFilterBar>
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !orders.length ? (
        <EmptyState title="Không có đơn hàng" description="Thử chọn trạng thái khác hoặc quay lại sau." />
      ) : (
        <CmsDataTable label="Đơn hàng" rows={orders} columns={columns} rowKey="id" />
      )}
    </>
  );
}
