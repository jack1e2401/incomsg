import { Link } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import type { PlatformFeeSummary } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, LoadingState, StatCard } from "../../components/ui";
import {
  currentWeekRange,
  feeMoney,
  feeRateLabel,
  financeDateTime,
  merchantTierLabels,
} from "./finance-format";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function PlatformFeeStats({ summary }: { summary: PlatformFeeSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Phí ghi nhận" value={feeMoney(summary.chargedVnd)} />
      <StatCard label="Phí đã hoàn" value={feeMoney(summary.reversedVnd)} />
      <StatCard label="Phí thực tế" value={feeMoney(summary.netVnd)} />
    </div>
  );
}

export function MerchantFinanceOverview({ token }: { token: string }) {
  const range = currentWeekRange();
  const finance = useResource(() => api.getMerchantFinance(token, range), [token, range.from, range.to]);
  if (finance.loading)
    return (
      <section className="mt-5">
        <LoadingState cards={1} />
      </section>
    );
  if (finance.error)
    return (
      <section className="mt-5">
        <ErrorState message={finance.error} retry={finance.reload} />
      </section>
    );
  if (!finance.data) return null;

  const { tier, summary, sales } = finance.data;
  const revenue = BigInt(tier.revenueVnd);
  const threshold = tier.nextThresholdVnd ? BigInt(tier.nextThresholdVnd) : null;
  const progress = threshold && revenue < threshold ? Number((revenue * 100n) / threshold) : 100;
  return (
    <Card className="mt-5 space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#294833]">Hạng cửa hàng · {tier.year}</h2>
          <p className="mt-1 text-sm muted">
            {tier.lastEvaluatedAt
              ? `Xét hạng gần nhất: ${financeDateTime(tier.lastEvaluatedAt)}`
              : "Chưa có lần xét hạng trong năm"}
          </p>
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm muted">Hạng hiện tại</dt>
          <dd className="mt-1 text-xl font-extrabold">{merchantTierLabels[tier.level]}</dd>
        </div>
        <div>
          <dt className="text-sm muted">Tỷ lệ phí bán hàng</dt>
          <dd className="mt-1 text-xl font-extrabold">{feeRateLabel(tier.feeRate)}</dd>
        </div>
        <div>
          <dt className="text-sm muted">Doanh thu xét hạng trong năm</dt>
          <dd className="mt-1 text-xl font-extrabold tabular-nums">{feeMoney(tier.revenueVnd)}</dd>
        </div>
      </dl>
      {tier.nextTier && threshold !== null ? (
        <div>
          <p className="mb-1.5 text-sm muted">
            Mốc {merchantTierLabels[tier.nextTier]}: {feeMoney(tier.nextThresholdVnd!)}
          </p>
          <progress
            aria-label={`Tiến độ lên hạng ${merchantTierLabels[tier.nextTier]}`}
            value={progress}
            max={100}
            className="h-2.5 w-full accent-[#376743]"
          />
        </div>
      ) : (
        <p className="text-sm muted">Đã đạt hạng cao nhất.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e9e0] pt-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-sm muted">Tiền sau phí · 7 ngày gần nhất</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums">{feeMoney(sales.merchantReceivesVnd)}</p>
            <p className="mt-1 text-xs muted">Đơn có ghi phí · đã trừ hoàn tiền</p>
          </div>
          <div>
            <p className="text-sm muted">Phí sàn · 7 ngày gần nhất</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums">{feeMoney(summary.netVnd)}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/merchant/orders?tab=fees">Xem sổ phí</Link>
        </Button>
      </div>
    </Card>
  );
}
