import type { LoyaltyTierDto, WalletDto } from "../../api/commerce-types";
import { Card } from "../../components/ui";
import { buildLifetimeTierHistory, type LifetimeTierHistoryPoint } from "./lifetime-tier-history";

const width = 760;
const height = 280;
const left = 58;
const right = 132;
const top = 18;
const bottom = 44;
const tierColors: Record<string, string> = {
  BRONZE: "#a8733d",
  SILVER: "#7e8b98",
  GOLD: "#c29a27",
  PLATINUM: "#438f98",
};
const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function tierColor(level: string) {
  return tierColors[level] ?? "#738078";
}

function eventLabel(type: LifetimeTierHistoryPoint["type"]) {
  if (type === "EARN") return "Tích điểm";
  if (type === "EARN_REVERSAL") return "Thu hồi điểm";
  return "Bắt đầu";
}

function eventDate(date: string | null) {
  return date ? new Date(date).toLocaleString("vi-VN") : "Bắt đầu";
}

export function MemberLifetimeTierChart({ wallet }: { wallet: WalletDto }) {
  const history = buildLifetimeTierHistory(wallet.transactions, wallet.netLifetimeEarned);
  const tiers = [...(wallet.policy?.tiers ?? [])].sort(
    (a, b) => a.minLifetimePoints - b.minLifetimePoints,
  );

  return (
    <Card role="region" aria-labelledby="member-lifetime-chart-title" className="mt-7 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="member-lifetime-chart-title" className="text-lg font-extrabold text-[#294833]">
            Biến động điểm lifetime
          </h2>
          <p className="mt-1 text-sm muted">
            Tổng điểm tăng khi tích lũy và giảm khi bị thu hồi; đổi điểm không làm giảm hạng.
          </p>
        </div>
        <p className="rounded-full bg-[#f0f5ed] px-3 py-1 text-xs font-bold text-[#31563a]">
          Hạng hiện tại: {wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : wallet.tier}
        </p>
      </div>

      {!history.isConsistent ? (
        <p role="status" className="mt-5 rounded-xl bg-[#f7f9f5] p-4 text-sm muted">
          Biểu đồ chưa khả dụng vì lịch sử ledger chưa khớp số dư điểm hiện tại.
        </p>
      ) : history.points.length === 1 ? (
        <p role="status" className="mt-5 rounded-xl bg-[#f7f9f5] p-4 text-sm muted">
          Chưa có giao dịch tích điểm hoặc thu hồi điểm đã hoàn tất.
        </p>
      ) : (
        <LifetimeChart history={history.points} tiers={tiers} />
      )}
    </Card>
  );
}

function LifetimeChart({
  history,
  tiers,
}: {
  history: LifetimeTierHistoryPoint[];
  tiers: LoyaltyTierDto[];
}) {
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const values = history.map((point) => Number(point.total));
  const minValue = Math.min(0, ...values);
  const latestValue = values.at(-1) ?? 0;
  const nextThreshold = tiers.find((tier) => tier.minLifetimePoints > latestValue)?.minLifetimePoints;
  const dataMax = Math.max(1, ...values);
  const nearbyThreshold = nextThreshold !== undefined && nextThreshold <= dataMax * 1.5 ? nextThreshold : 0;
  const baseMax = Math.max(dataMax, nearbyThreshold);
  const maxValue = baseMax + Math.max((baseMax - minValue) * 0.08, 0.1);
  const range = maxValue - minValue;
  const xFor = (index: number) =>
    left + (history.length <= 1 ? chartWidth / 2 : (index / (history.length - 1)) * chartWidth);
  const yFor = (value: number) => top + ((maxValue - value) / range) * chartHeight;
  const path = history
    .map((point, index) => (index === 0 ? "M " : "L ") + xFor(index) + " " + yFor(Number(point.total)))
    .join(" ");
  const dateIndexes = [...new Set([1, Math.floor((history.length - 1) / 2), history.length - 1])]
    .filter((index) => index > 0)
    .filter((index, _, indexes) => {
      const currentDate = history[index]?.createdAt;
      const currentLabel = currentDate ? new Date(currentDate).toLocaleDateString("vi-VN") : "";
      return indexes.find((candidate) => {
        const candidateDate = history[candidate]?.createdAt;
        return (candidateDate ? new Date(candidateDate).toLocaleDateString("vi-VN") : "") === currentLabel;
      }) === index;
    });

  return (
    <>
      <p className="mt-4 text-xs muted">Ngưỡng tier theo chính sách hiện tại</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Ngưỡng tier">
        {tiers.map((tier) => (
          <span key={tier.level} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#53685a]">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-sm border border-black/10"
              style={{ backgroundColor: tierColor(tier.level), opacity: 0.62 }}
            />
            {tier.level} · {numberFormat.format(tier.minLifetimePoints)} điểm
          </span>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto touch-pan-x">
        <svg
          role="img"
          aria-label="Biến động điểm lifetime theo thời gian và ngưỡng hạng"
          className="block h-auto min-w-[34rem] w-full"
          viewBox={"0 0 " + width + " " + height}
        >
          <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#cfd9ce" />
          <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#cfd9ce" />
          <text
            x="15"
            y={top + chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 15 ${top + chartHeight / 2})`}
            className="fill-[#53685a] text-[11px]"
          >
            Điểm lifetime
          </text>
          {tiers.map((tier, index) => {
            const bandStart = Math.max(minValue, tier.minLifetimePoints);
            const bandEnd = Math.min(maxValue, tiers[index + 1]?.minLifetimePoints ?? maxValue);
            if (bandEnd <= bandStart) return null;
            return (
              <rect
                key={`band-${tier.level}`}
                data-tier-band={tier.level}
                x={left}
                y={yFor(bandEnd)}
                width={chartWidth}
                height={yFor(bandStart) - yFor(bandEnd)}
                fill={tierColor(tier.level)}
                fillOpacity="0.16"
              />
            );
          })}
          {Array.from({ length: 5 }, (_, index) => {
            const value = minValue + (range * index) / 4;
            const y = yFor(value);
            return (
              <g key={`axis-${index}`}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e7ede5" />
                <text x={left - 8} y={y + 4} textAnchor="end" className="fill-[#53685a] text-[11px]">
                  {numberFormat.format(value)}
                </text>
              </g>
            );
          })}
          {tiers
            .filter((tier) => tier.minLifetimePoints >= minValue && tier.minLifetimePoints <= maxValue)
            .map((tier) => {
              const y = yFor(tier.minLifetimePoints);
              return (
                <g key={tier.level}>
                  <line
                    x1={left}
                    y1={y}
                    x2={width - right}
                    y2={y}
                    stroke={tierColor(tier.level)}
                    strokeDasharray="4 5"
                  />
                </g>
              );
            })}
          <path d={path} fill="none" stroke="#335e3d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {history.slice(1).map((point, index) => {
            const chartIndex = index + 1;
            const isReversal = point.type === "EARN_REVERSAL";
            return (
              <circle
                key={point.transactionId}
                cx={xFor(chartIndex)}
                cy={yFor(Number(point.total))}
                r="4"
                fill={isReversal ? "#a4473a" : "#335e3d"}
              >
                <title>
                  {eventLabel(point.type) +
                    " · " +
                    eventDate(point.createdAt) +
                    " · " +
                    point.total +
                    " điểm lifetime" +
                    (point.orderId ? " · Đơn #" + point.orderId : "") +
                    " · " +
                    point.reason}
                </title>
              </circle>
            );
          })}
          {dateIndexes.map((index) => {
            const point = history[index];
            if (!point) return null;
            return (
              <text
                key={String(point.transactionId ?? "start") + "-" + index}
                x={xFor(index)}
                y={height - 13}
                textAnchor={index === history.length - 1 ? "end" : index === 1 ? "start" : "middle"}
                className="fill-[#53685a] text-[11px]"
              >
                {point.createdAt ? new Date(point.createdAt).toLocaleDateString("vi-VN") : ""}
              </text>
            );
          })}
          <text
            x={(left + width - right) / 2}
            y={height - 1}
            textAnchor="middle"
            className="fill-[#53685a] text-[10px]"
          >
            Thời gian giao dịch
          </text>
        </svg>
      </div>
      <ol className="sr-only" aria-label="Lịch sử điểm lifetime">
        {history.slice(1).map((point) => (
          <li key={point.transactionId}>
            {eventDate(point.createdAt)}: {eventLabel(point.type)}; tổng lifetime {point.total} điểm
            {point.orderId ? "; đơn hàng " + point.orderId : ""}; {point.reason}
          </li>
        ))}
      </ol>
    </>
  );
}
