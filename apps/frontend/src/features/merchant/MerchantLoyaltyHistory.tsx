import type { MerchantLoyaltyPolicyVersionDto } from "../../api/commerce-types";

export type MerchantLoyaltyHistoryProps = {
  versions: MerchantLoyaltyPolicyVersionDto[];
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function MerchantLoyaltyHistory({ versions }: MerchantLoyaltyHistoryProps) {
  if (versions.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có chính sách loyalty được phát hành.</p>;
  }

  return (
    <section aria-label="Lịch sử chính sách loyalty" className="space-y-3">
      {versions.map((policy) => (
        <article key={policy.id} className="rounded-xl border border-slate-200 p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Phiên bản {policy.version}</h3>
            {policy.isCurrent && <span className="text-sm text-emerald-700">Đang áp dụng</span>}
          </header>
          <p className="mt-2 text-sm text-slate-600">
            Phát hành {formatDate(policy.publishedAt)} · {policy.publishedByEmail ?? (policy.source === "LEGACY_BACKFILL" ? "Bản chuyển đổi dữ liệu" : "Người phát hành không còn hoạt động")}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Tỷ lệ: {policy.vndPerPoint.toLocaleString("vi-VN")} VND / điểm
          </p>
          <ul className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
            {policy.tiers.map((tier) => (
              <li key={tier.level}>
                {tier.level} · từ {tier.minLifetimePoints.toLocaleString("vi-VN")} điểm · x{tier.multiplier}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
