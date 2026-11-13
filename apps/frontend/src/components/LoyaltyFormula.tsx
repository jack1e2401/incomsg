import type { LoyaltyConfigDto } from "../api/commerce-types";

export function LoyaltyFormula({ config }: { config?: Pick<LoyaltyConfigDto, "vndPerPoint" | "isActive"> }) {
  const rate = config ? `${config.vndPerPoint.toLocaleString("vi-VN")} ₫` : "mức VND cho 1 điểm";

  return (
    <section className="rounded-2xl border border-[#e5ece3] bg-[#f7f9f5] p-5">
      <h2 className="font-extrabold">Cách tính điểm Loyalty</h2>
      {config?.isActive === false && <p className="mt-2 text-sm font-semibold">Tích điểm đang tạm dừng.</p>}
      <div className="mt-2 space-y-1 text-sm leading-6">
        <p>
          <strong>Điểm nhận</strong> = (tiền sau giảm giá ÷ {rate}) × hệ số hạng.
        </p>
        <p>Điểm lẻ được cộng dồn qua các đơn sau.</p>
      </div>
      <p className="mt-2 text-sm leading-6 muted">
        Khi bật tích điểm, chỉ đơn đã thanh toán được cộng điểm. Đơn đầu tại mỗi cửa hàng dùng hệ số Bronze.
      </p>
    </section>
  );
}
