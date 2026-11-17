import { Link } from "react-router-dom";
import { ArrowRight, Gift, Medal, Package, Receipt, TrendUp } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusText,
} from "../../../components/ui";
import { money, number, shortDate } from "../../../lib/utils";
import { useMerchantId } from "./useMerchantId";

export function MerchantOverview() {
  const id = useMerchantId();
  const api = useApi();
  const merchant = useResource(() => api.getMerchant(id), [id]);
  const products = useResource(() => api.listProducts(id), [id]);
  const orders = useResource(() => api.listOrders(id), [id]);
  const rewards = useResource(() => api.listRewardFulfillments(id), [id]);
  const loyalty = useResource(() => api.getLoyaltyConfig(id), [id]);
  if (merchant.loading || products.loading || orders.loading || rewards.loading || loyalty.loading)
    return <LoadingState cards={4} />;
  if (merchant.error || products.error || orders.error || rewards.error || loyalty.error)
    return (
      <ErrorState
        message={
          merchant.error ??
          products.error ??
          orders.error ??
          rewards.error ??
          loyalty.error ??
          "Lỗi tải dữ liệu"
        }
        retry={() => {
          merchant.reload();
          products.reload();
          orders.reload();
          rewards.reload();
          loyalty.reload();
        }}
      />
    );
  const paid = orders.data?.filter((o) => o.status === "PAID") ?? [];
  return (
    <>
      <PageHeader
        title={merchant.data?.name ?? "Cửa hàng"}
        action={
          <Button asChild>
            <Link to={`/member/${id}`}>
              Xem gian hàng <ArrowRight size={17} />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh số đã thanh toán"
          value={money(paid.reduce((n, o) => n + o.total, 0))}
          icon={<TrendUp size={20} />}
        />
        <StatCard
          label="Đơn hàng"
          value={orders.data?.length ?? 0}
          icon={<Receipt size={20} />}
          note={`${orders.data?.filter((o) => o.status === "PENDING").length ?? 0} đang chờ`}
        />
        <StatCard
          label="Sản phẩm"
          value={products.data?.filter((p) => p.active).length ?? 0}
          icon={<Package size={20} />}
        />
        <StatCard
          label="Quà chờ trao"
          value={rewards.data?.filter((r) => r.status === "PENDING_FULFILLMENT").length ?? 0}
          icon={<Gift size={20} />}
        />
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Đơn gần đây</h2>
              <p className="mt-1 text-xs muted">Tình trạng đơn tại cửa hàng</p>
            </div>
            <Link className="text-xs font-bold accent" to={`/merchant/${id}/orders`}>
              Xem tất cả →
            </Link>
          </div>
          {orders.data?.length ? (
            <div className="divide-y divide-[#edf1ea]">
              {orders.data.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center gap-3 py-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf4e9] accent">
                    <Receipt size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{o.id}</p>
                    <p className="mt-1 text-xs muted">
                      {o.memberName} · {shortDate(o.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold">{money(o.total)}</p>
                  <StatusText tone={o.status === "PAID" ? "green" : "amber"}>
                    {o.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
                  </StatusText>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có đơn hàng" description="Đơn mới sẽ xuất hiện tại đây." />
          )}
        </Card>
        <Card className="h-fit p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold">Hạng thành viên</h2>
              <p className="mt-1 text-sm muted">1 điểm cơ bản mỗi {number(loyalty.data!.baseAmount)} ₫</p>
            </div>
            <Medal size={23} weight="light" className="shrink-0 text-[#5d8055]" />
          </div>
          <div className="mt-5 divide-y divide-[#edf1ea]">
            {loyalty.data!.tiers.map((tier) => (
              <div key={tier.tier} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-semibold">{tier.tier}</span>
                <span className="text-right text-xs muted">
                  {number(tier.threshold)} điểm · ×{tier.multiplier}
                </span>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to={`/merchant/${id}/loyalty`}>
              Cấu hình điểm <ArrowRight size={16} />
            </Link>
          </Button>
        </Card>
      </div>
    </>
  );
}
