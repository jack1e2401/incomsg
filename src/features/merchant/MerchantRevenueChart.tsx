import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import type { OrderDto } from "../../api/commerce-types";
import { Button, Card, Skeleton } from "../../components/ui";

const RevenuePlot = lazy(() => import("./MerchantRevenuePlot"));
const timeZone = "Asia/Ho_Chi_Minh";
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabel = new Intl.DateTimeFormat("vi-VN", { timeZone, month: "2-digit", day: "2-digit" });
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dayMs = 24 * 60 * 60 * 1000;

function RevenueBars({ orders }: { orders: readonly OrderDto[] }) {
  const now = Date.now();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * dayMs);
    return { key: dayKey.format(date), label: dayLabel.format(date), amount: 0n };
  });
  const daysByKey = new Map(days.map((day) => [day.key, day]));
  let paidOrderCount = 0;
  for (const order of orders) {
    if (order.status !== "PAID" || !order.paidAt) continue;
    const day = daysByKey.get(dayKey.format(new Date(order.paidAt)));
    if (!day) continue;
    day.amount += BigInt(order.total);
    paidOrderCount += 1;
  }

  if (paidOrderCount === 0) {
    return <p className="mt-6 text-sm muted">Chưa có đơn đã thanh toán trong 7 ngày qua.</p>;
  }

  const total = days.reduce((sum, day) => sum + day.amount, 0n);
  return (
    <>
      <p className="mt-5 break-all text-3xl font-extrabold tabular-nums text-[#294833]">
        {vnd.format(total)}
      </p>
      <div className="mt-5">
        <Suspense fallback={<Skeleton className="h-56 motion-reduce:animate-none" />}>
          <RevenuePlot days={days.map((day) => ({ label: day.label, amount: Number(day.amount) }))} />
        </Suspense>
      </div>
      <ol className="sr-only" aria-label="Tổng tiền theo ngày">
        {days.map((day) => (
          <li key={day.key}>{`${day.label}: ${vnd.format(day.amount)}`}</li>
        ))}
      </ol>
    </>
  );
}

export function MerchantRevenueChart({
  orders,
  loading,
  error,
  retry,
}: {
  orders: OrderDto[] | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  return (
    <Card role="region" aria-labelledby="merchant-revenue-title" className="mt-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="merchant-revenue-title" className="text-lg font-extrabold text-[#294833]">
            Tiền từ đơn đã thanh toán
          </h2>
          <p className="mt-1 text-sm muted">7 ngày gần nhất · Giờ Việt Nam</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/merchant/orders">Xem đơn hàng</Link>
        </Button>
      </div>
      {loading ? (
        <div role="status" className="mt-5">
          <span className="sr-only">Đang tải số liệu đơn hàng</span>
          <Skeleton className="h-56 motion-reduce:animate-none" />
        </div>
      ) : error ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm muted">
            Không tải được số liệu đơn hàng.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            Thử lại
          </Button>
        </div>
      ) : (
        <RevenueBars orders={orders ?? []} />
      )}
    </Card>
  );
}
