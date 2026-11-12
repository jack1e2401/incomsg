import type { ReactNode } from "react";
import { Wallet } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { PointTransactionType, WalletDto } from "../../api/commerce-types";
import { LoyaltyFormula } from "../../components/LoyaltyFormula";
import { Card, EmptyState } from "../../components/ui";
import { MemberLifetimeTierChart } from "./MemberLifetimeTierChart";

export function pointTransactionLabel(type: PointTransactionType) {
  const labels: Partial<Record<PointTransactionType, string>> = {
    EARN: "Tích điểm",
    REDEEM_DISCOUNT: "Đổi ưu đãi",
    REDEEM_REWARD: "Đổi quà",
    EARN_REVERSAL: "Thu hồi tích điểm",
    REDEMPTION_REVERSAL: "Hoàn điểm đổi thưởng",
    ADMIN_ADJUSTMENT: "Điều chỉnh quản trị",
    LEGACY_BACKFILL: "Khởi tạo ban đầu",
  };
  return labels[type] ?? type;
}

export function formatPointDelta(delta: string) {
  return delta === "0" || delta.startsWith("-") ? delta : `+${delta}`;
}

function WalletReference({ to, children }: { to?: string; children: ReactNode }) {
  return (
    <p className="mt-1 text-xs">
      {to ? (
        <Link
          to={to}
          className="rounded font-medium underline hover:text-[#2f583a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
        >
          {children}
        </Link>
      ) : (
        children
      )}
    </p>
  );
}

export function LoyaltyWalletContent({
  wallet,
  tierArtwork,
  emptyAction,
  orderLink,
  voucherLink,
}: {
  wallet: WalletDto;
  tierArtwork?: ReactNode;
  emptyAction?: ReactNode;
  orderLink?: (id: number) => string;
  voucherLink?: string;
}) {
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <Card
          className="relative overflow-hidden p-5 text-white sm:p-8"
          style={{ backgroundColor: "#2f583a", color: "white" }}
        >
          <p className="text-sm font-semibold text-white/70">Điểm có thể sử dụng</p>
          <p className="mt-2 break-words text-3xl font-extrabold tracking-[-.05em] sm:text-5xl lg:text-6xl">
            <span className="tabular-nums">{wallet.availablePoints.toLocaleString("vi-VN")}</span>
            <span className="ml-2 text-base font-bold tracking-normal text-[#c5e89b]">điểm</span>
          </p>
          <p className="mt-2 break-words text-sm text-white/80">
            Phần lẻ:{" "}
            <span className="font-semibold tabular-nums text-[#c5e89b]">{wallet.fractionalCarry}</span>
          </p>
          {wallet.pointDebt !== "0" && (
            <p className="mt-1 break-words text-sm text-[#fca5a5]">
              Nợ điểm: <span className="font-semibold tabular-nums">{wallet.pointDebt}</span>
            </p>
          )}
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/15 pt-4 sm:mt-8 sm:pt-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/65">Tổng điểm đã tích lũy</p>
              <p className="mt-1 break-words text-lg font-bold tabular-nums sm:text-xl">
                {wallet.netLifetimeEarned}
              </p>
            </div>
            <Wallet aria-hidden="true" size={24} weight="light" className="shrink-0 text-[#c5e89b]" />
          </div>
        </Card>
        <Card className="member-gradient relative min-h-48 overflow-hidden p-5 sm:min-h-56 sm:p-8">
          <div className={tierArtwork ? "relative z-1 max-w-[68%] sm:max-w-[65%]" : undefined}>
            <p className="text-sm font-semibold text-[#6c8168]">Hạng thành viên</p>
            <h2 className="serif mt-2 break-words text-2xl leading-tight text-[#294a32] sm:mt-3 sm:text-3xl">
              {wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : wallet.tier}
            </h2>
            <p className="mt-2 break-words text-xs leading-5 text-[#647a68] sm:mt-3 sm:text-sm sm:leading-6">
              {wallet.tier === "UNRANKED"
                ? "Đơn đã thanh toán đầu tiên sẽ xác lập hạng theo tổng điểm tích lũy."
                : "Hạng dựa trên tổng điểm đã tích lũy; tiêu điểm không làm giảm hạng."}
            </p>
          </div>
          {tierArtwork && (
            <div className="pointer-events-none absolute -bottom-3 -right-3 h-28 w-28 sm:h-48 sm:w-48">
              {tierArtwork}
            </div>
          )}
        </Card>
      </div>
      <MemberLifetimeTierChart wallet={wallet} />
      {!wallet.policy && (
        <div className="mt-7">
          <LoyaltyFormula />
        </div>
      )}
      <section className="mt-7">
        <h2 className="mb-4 text-xl font-extrabold">Lịch sử điểm</h2>
        {wallet.transactions.length === 0 ? (
          <EmptyState
            title="Chưa có giao dịch điểm"
            description="Giao dịch sẽ xuất hiện sau hoạt động tại cửa hàng này."
            action={emptyAction}
          />
        ) : (
          <div className="surface divide-y divide-[#edf1ea] overflow-hidden rounded-[1.5rem]">
            {wallet.transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold">{transaction.reason}</p>
                  <p className="mt-1 break-words text-xs muted">
                    {new Date(transaction.createdAt).toLocaleString("vi-VN")} ·{" "}
                    {pointTransactionLabel(transaction.type)}
                  </p>
                  {transaction.orderId != null && (
                    <WalletReference to={orderLink?.(transaction.orderId)}>
                      Đơn hàng #{transaction.orderId}
                    </WalletReference>
                  )}
                  {transaction.memberVoucherId != null && (
                    <WalletReference to={voucherLink}>Voucher #{transaction.memberVoucherId}</WalletReference>
                  )}
                </div>
                <div className="flex items-center justify-between sm:block sm:text-right">
                  <p
                    className={`break-words font-extrabold tabular-nums ${transaction.delta.startsWith("-") ? "text-[#a4473a]" : "text-[#357044]"}`}
                  >
                    {formatPointDelta(transaction.delta)}
                  </p>
                  <p className="break-words text-xs tabular-nums muted sm:mt-1">
                    Số dư {transaction.balanceAfter}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
