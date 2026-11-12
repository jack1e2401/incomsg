import type { AppliedLoyaltyPolicySnapshot } from "../../api/commerce-types";

export type OrderLoyaltyPolicySnapshotProps = {
  policy: AppliedLoyaltyPolicySnapshot | null;
};

export function OrderLoyaltyPolicySnapshot({ policy }: OrderLoyaltyPolicySnapshotProps) {
  if (!policy) {
    return (
      <section aria-label="Chính sách loyalty của đơn hàng" className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">Đơn hàng cũ</h3>
        <p className="mt-1 text-sm text-slate-600">Đơn hàng không có bản chụp chính sách loyalty; thông tin áp dụng không khả dụng.</p>
      </section>
    );
  }

  return (
    <section aria-label="Chính sách loyalty của đơn hàng" className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">Chính sách áp dụng · phiên bản {policy.version}</h3>
      <p className="mt-2 text-sm text-slate-700">
        Hạng {policy.tierLevel} · hệ số x{policy.multiplier} · {policy.vndPerPoint.toLocaleString("vi-VN")} VND / điểm
      </p>
      <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        {policy.tiers.map((tier) => (
          <li key={tier.level}>
            {tier.level} · từ {tier.minLifetimePoints.toLocaleString("vi-VN")} điểm · x{tier.multiplier}
          </li>
        ))}
      </ul>
    </section>
  );
}
