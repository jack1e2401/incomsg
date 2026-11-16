import { lazy, Suspense, useState, type FormEvent } from "react";
import { createAnalyticsClient } from "../../api/analytics-client";
import type { AnalyticsGranularity } from "../../api/analytics-types";
import { useAuthSession } from "../../api/auth-session";
import { useResource } from "../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
} from "../../components/ui";
import { money } from "../../lib/utils";
import { AnalyticsProductTables } from "./AnalyticsProductTables";

const MerchantRevenuePlot = lazy(() => import("../merchant/MerchantRevenuePlot"));
const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function defaultRange(days = 30) {
  const now = new Date();
  const to = vnDateFormatter.format(now);
  const toStart = new Date(`${to}T00:00:00+07:00`);
  const from = vnDateFormatter.format(new Date(toStart.getTime() - (days - 1) * 86_400_000));
  return { from, to };
}

export function MerchantAnalyticsPage() {
  const { accessToken } = useAuthSession();
  const initial = defaultRange(30);
  const [draftFrom, setDraftFrom] = useState(initial.from);
  const [draftTo, setDraftTo] = useState(initial.to);
  const [draftGranularity, setDraftGranularity] = useState<AnalyticsGranularity>("day");
  const [applied, setApplied] = useState<{
    from: string;
    to: string;
    granularity: AnalyticsGranularity;
  }>({ ...initial, granularity: "day" });
  const [validationError, setValidationError] = useState<string | null>(null);

  const resource = useResource(
    () => analyticsApi.getMerchantAnalytics(applied, accessToken!),
    [accessToken, applied.from, applied.to, applied.granularity],
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftFrom || !draftTo) {
      setValidationError("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
      return;
    }
    const start = new Date(`${draftFrom}T00:00:00+07:00`);
    const end = new Date(`${draftTo}T00:00:00+07:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setValidationError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
      return;
    }
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 366) {
      setValidationError("Khoảng thời gian tối đa là 366 ngày.");
      return;
    }
    setValidationError(null);
    setApplied({ from: draftFrom, to: draftTo, granularity: draftGranularity });
  }

  const data = resource.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phân tích cửa hàng"
        description="Doanh thu, đơn hàng, khách hàng và cảnh báo tồn kho theo giờ Việt Nam."
      />

      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_11rem_auto] sm:items-end"
        onSubmit={applyFilters}
      >
        <Field label="Từ ngày">
          <Input
            type="date"
            aria-label="Từ ngày"
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
          />
        </Field>
        <Field label="Đến ngày">
          <Input
            type="date"
            aria-label="Đến ngày"
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
          />
        </Field>
        <Field label="Độ phân giải">
          <Select
            aria-label="Độ phân giải"
            value={draftGranularity}
            onChange={(event) => setDraftGranularity(event.target.value as AnalyticsGranularity)}
          >
            <option value="day">Theo ngày</option>
            <option value="month">Theo tháng</option>
          </Select>
        </Field>
        <Button type="submit" className="h-11">
          Xem báo cáo
        </Button>
      </form>

      {validationError && (
        <p role="alert" className="text-sm font-semibold text-[#a4473a]">
          {validationError}
        </p>
      )}

      {resource.loading ? (
        <LoadingState cards={4} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Doanh thu ròng"
                value={money(Number(data.kpis.netRevenueVnd))}
                note={
                  data.kpis.refundPendingOrderCount > 0
                    ? `Đã thu ${money(Number(data.kpis.paidOnlyRevenueVnd))} · Chờ hoàn ${money(Number(data.kpis.refundPendingRevenueVnd))}`
                    : `Đã hoàn: ${money(Number(data.kpis.refundedRevenueVnd))}`
                }
              />
              <StatCard
                label="Đơn hàng hợp lệ"
                value={data.kpis.paidOrderCount}
                note={`${data.kpis.refundPendingOrderCount} chờ hoàn · ${data.kpis.refundedOrderCount} đã hoàn`}
              />
              <StatCard
                label="Giá trị đơn trung bình"
                value={money(Number(data.kpis.averageOrderValueVnd))}
              />
              <StatCard
                label="Thành viên / Quay lại"
                value={`${data.kpis.totalMembers} · ${data.kpis.returningCustomers}`}
                note={`+${data.kpis.newMembers} thành viên mới trong kỳ`}
              />
            </div>

            <Card role="region" aria-labelledby="analytics-revenue-heading" className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="analytics-revenue-heading" className="text-lg font-extrabold text-[#294833]">
                    Biểu đồ doanh thu
                  </h2>
                  <p className="mt-1 text-xs muted">
                    {data.range.from} → {data.range.to} · {data.range.granularity === "day" ? "Theo ngày" : "Theo tháng"} · {data.range.timezone}
                  </p>
                </div>
              </div>
              {data.kpis.paidOrderCount === 0 ? (
                <div className="mt-5">
                  <EmptyState
                    title="Chưa có đơn hàng trong kỳ"
                    description="Không có đơn PAID hoặc REFUND_PENDING trong khoảng thời gian đã chọn."
                  />
                </div>
              ) : (
                <>
                  <div className="mt-5">
                    <Suspense fallback={<Skeleton className="h-56 motion-reduce:animate-none" />}>
                      <MerchantRevenuePlot
                        days={data.revenueSeries.map((point) => ({
                          label: point.label,
                          amount: Number(point.revenueVnd),
                        }))}
                      />
                    </Suspense>
                  </div>
                  <ol className="sr-only" aria-label="Chuỗi doanh thu">
                    {data.revenueSeries.map((point) => (
                      <li key={point.bucket}>
                        {`${point.label}: ${money(Number(point.revenueVnd))} (${point.orderCount} đơn)`}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Card>

            <AnalyticsProductTables
              topProducts={data.topProducts}
              slowMovingProducts={data.slowMovingProducts}
              noSales90DaysProducts={data.noSales90DaysProducts}
              lowStockProducts={data.lowStockProducts}
            />
          </>
        )
      )}
    </div>
  );
}
