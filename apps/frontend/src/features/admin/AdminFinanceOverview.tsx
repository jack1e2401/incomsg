import { lazy, Suspense, useState } from "react";
import { createCommerceClient } from "../../api/commerce-http";
import type { AdminFinancePeriod, AdminFinanceReport } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Skeleton,
  StatusText,
} from "../../components/ui";
import { feeMoney } from "../finance/finance-format";
import { PlatformFeeStats } from "../finance/MerchantFinanceOverview";
import { AdminFeeDialog } from "./AdminMerchantsModeration";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const RevenuePlot = lazy(() => import("../merchant/MerchantRevenuePlot"));
const periods = [
  ["7d", "7 ngày"],
  ["30d", "30 ngày"],
  ["year", "Năm nay"],
] as const;
const rankings = [
  ["revenueVnd", "Theo doanh thu"],
  ["netVnd", "Theo phí đóng góp"],
] as const;
const displayDate = (date: string) => date.split("-").reverse().join("/");
type Ranking = (typeof rankings)[number][0];

export function AdminFinanceOverview({ token }: { token: string }) {
  const [period, setPeriod] = useState<AdminFinancePeriod>("year");
  const [ranking, setRanking] = useState<Ranking>("netVnd");
  const report = useResource(() => api.getAdminFinance(period, token), [period, token]);
  return (
    <section className="mt-6 space-y-4" aria-labelledby="admin-finance-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="admin-finance-title" className="text-xl font-extrabold text-[#294833]">
          Doanh thu và phí nền tảng
        </h2>
        <div role="group" aria-label="Kỳ báo cáo" className="flex flex-wrap gap-2">
          {periods.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={period === value ? "default" : "outline"}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      {report.loading ? (
        <LoadingState cards={2} />
      ) : report.error ? (
        <ErrorState message={report.error} retry={report.reload} />
      ) : (
        report.data && (
          <>
            <p className="text-xs muted">
              {displayDate(report.data.from)} – {displayDate(report.data.to)} · Giờ Việt Nam
            </p>
            <PlatformFeeStats summary={report.data.summary} />
            <PlatformRevenueChart report={report.data} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <h3 className="text-lg font-extrabold text-[#294833]">Xếp hạng cửa hàng</h3>
              <div role="group" aria-label="Tiêu chí xếp hạng" className="flex flex-wrap gap-2">
                {rankings.map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={ranking === value ? "default" : "outline"}
                    aria-pressed={ranking === value}
                    onClick={() => setRanking(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <MerchantRanking report={report.data} ranking={ranking} token={token} />
          </>
        )
      )}
    </section>
  );
}

function PlatformRevenueChart({ report }: { report: AdminFinanceReport }) {
  const amounts = report.series.map(({ bucket, netVnd }) => ({
    label: report.granularity === "month" ? `T${Number(bucket.slice(5))}` : displayDate(bucket.slice(5)),
    amount: netVnd,
  }));
  const hasFees = report.summary.chargedVnd !== "0" || report.summary.reversedVnd !== "0";
  const hasNonzeroBucket = report.series.some(({ netVnd }) => BigInt(netVnd) !== 0n);
  return (
    <Card role="region" aria-labelledby="platform-revenue-chart-title" className="p-5 sm:p-7">
      <h3 id="platform-revenue-chart-title" className="text-lg font-extrabold text-[#294833]">
        Doanh thu ròng của sàn
      </h3>
      <p className="mt-1 text-sm muted">
        Phí dựa trên doanh thu sau giảm giá, trừ phí hoàn. Chưa tính chi phí vận hành.
      </p>
      <p className="mt-4 break-words text-3xl font-extrabold tabular-nums text-[#294833]">
        {feeMoney(report.summary.netVnd)}
      </p>
      {hasFees && hasNonzeroBucket ? (
        <>
          <p className="mt-1 text-sm muted">
            {report.granularity === "month" ? "Theo tháng" : "Theo ngày"} · Phí ghi nhận trừ phí đã hoàn
          </p>
          <div className="mt-4">
            <Suspense fallback={<Skeleton className="h-56 motion-reduce:animate-none" />}>
              <RevenuePlot days={amounts.map(({ label, amount }) => ({ label, amount: Number(amount) }))} />
            </Suspense>
          </div>
          <ol className="sr-only" aria-label="Phí ròng theo kỳ">
            {amounts.map(({ label, amount }) => (
              <li key={label}>
                {label}: {feeMoney(amount)}
              </li>
            ))}
          </ol>
        </>
      ) : hasFees ? (
        <p className="mt-3 text-sm muted">
          Doanh thu ròng trong kỳ là {feeMoney(report.summary.netVnd)}: đã ghi{" "}
          {feeMoney(report.summary.chargedVnd)} và hoàn {feeMoney(report.summary.reversedVnd)} phí.
        </p>
      ) : (
        <p className="mt-3 text-sm muted">Chưa có phí được ghi nhận trong kỳ này.</p>
      )}
    </Card>
  );
}

function MerchantRanking({
  report,
  ranking,
  token,
}: {
  report: AdminFinanceReport;
  ranking: Ranking;
  token: string;
}) {
  const rows = report.merchants
    .map((merchant) => ({ merchant, score: BigInt(merchant[ranking]) }))
    .sort((left, right) => {
      if (ranking === "netVnd" && Boolean(left.merchant.feeCount) !== Boolean(right.merchant.feeCount)) {
        return left.merchant.feeCount ? -1 : 1;
      }
      return left.score === right.score
        ? left.merchant.id - right.merchant.id
        : left.score > right.score
          ? -1
          : 1;
    });
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Chưa có cửa hàng phát sinh"
        description="Cửa hàng có đơn thanh toán hoặc giao dịch phí trong kỳ sẽ xuất hiện ở đây."
      />
    );
  }
  let rank = 1;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label="Xếp hạng cửa hàng">
        <thead className="bg-[#f7f9f5] text-xs muted">
          <tr>
            {[
              "Hạng",
              "Cửa hàng",
              "Doanh thu bán hàng",
              "Phí ghi nhận",
              "Phí đã hoàn",
              "Phí ròng đóng góp",
              "Thao tác",
            ].map((heading) => (
              <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ merchant, score }, index) => {
            const unranked = ranking === "netVnd" && merchant.feeCount === 0;
            if (index > 0 && score !== rows[index - 1]!.score) rank = index + 1;
            return (
              <tr key={merchant.id} className="border-t border-[#edf2eb]">
                <td className="px-4 py-3 font-bold tabular-nums">{unranked ? "—" : rank}</td>
                <th scope="row" className="min-w-36 px-4 py-3 font-semibold">
                  {merchant.name}
                  <span className="mt-1 block text-xs font-normal muted">#{merchant.id}</span>
                  {!merchant.isActive && (
                    <StatusText className="mt-1 block text-xs" tone="amber">
                      Tạm ngưng
                    </StatusText>
                  )}
                </th>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{feeMoney(merchant.revenueVnd)}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{feeMoney(merchant.chargedVnd)}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{feeMoney(merchant.reversedVnd)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums">
                  {merchant.feeCount > 0 ? (
                    <StatusText tone={merchant.netVnd.startsWith("-") ? "red" : "green"}>
                      {feeMoney(merchant.netVnd)}
                    </StatusText>
                  ) : (
                    <span className="font-normal muted">Chưa ghi phí</span>
                  )}
                  {merchant.unrecordedOrderCount > 0 && (
                    <span className="mt-1 block whitespace-normal text-xs font-normal muted">
                      {merchant.unrecordedOrderCount} đơn cũ chưa ghi phí
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <AdminFeeDialog
                    token={token}
                    merchantId={merchant.id}
                    merchantName={merchant.name}
                    buttonLabel="Xem sổ phí"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
