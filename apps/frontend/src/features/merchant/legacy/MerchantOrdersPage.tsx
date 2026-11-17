import { useState } from "react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatusText,
} from "../../../components/ui";
import { money, shortDate } from "../../../lib/utils";
import { useMerchantId } from "./useMerchantId";

export function MerchantOrders() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listOrders(id), [id]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const orders = resource.data?.filter((o) => filter === "ALL" || o.status === filter) ?? [];
  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description="Lọc theo trạng thái thanh toán."
        action={
          <Select
            className="w-44"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
          </Select>
        }
      />
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !orders.length ? (
        <EmptyState title="Không có đơn hàng" description="Thử chọn trạng thái khác hoặc quay lại sau." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs muted">
                    {shortDate(o.createdAt)} · {o.memberName}
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold">Đơn {o.id}</h2>
                </div>
                <StatusText tone={o.status === "PAID" ? "green" : "amber"}>
                  {o.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
                </StatusText>
              </div>
              <div className="mt-5 border-y border-[#edf1ea] py-3">
                {o.items.map((i) => (
                  <div key={i.productId} className="flex justify-between gap-4 py-2 text-sm">
                    <span className="muted">
                      {i.name} × {i.quantity}
                    </span>
                    <span className="font-semibold">{money(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs muted">
                  {o.status === "PAID"
                    ? `+${o.earnedPoints} điểm đã xác nhận`
                    : "Chưa phát điểm khi đơn PENDING"}
                </p>
                <p className="text-lg font-extrabold">{money(o.total)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
