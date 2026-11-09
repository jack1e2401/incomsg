import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { Gift, Sparkle, Ticket, Wallet } from "@phosphor-icons/react";
import { useApi } from "../../api/client";
import { useResource } from "../../api/useResource";
import type { VoucherDefinition } from "../../api/types";
import {
  Badge,
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { money, number, shortDate } from "../../lib/utils";
import type { MemberOutlet } from "../../layouts/MemberLayout";
import { MemberMascot } from "./MemberMascot";

export function MemberWallet() {
  const { merchant } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const wallet = useResource(() => api.getWallet(merchant.id), [merchant.id]);
  const config = useResource(() => api.getLoyaltyConfig(merchant.id), [merchant.id]);
  if (wallet.loading || config.loading) return <LoadingState cards={2} />;
  if (wallet.error || config.error)
    return (
      <ErrorState
        message={wallet.error ?? config.error ?? "Lỗi tải ví"}
        retry={() => {
          wallet.reload();
          config.reload();
        }}
      />
    );
  if (!wallet.data || !config.data) return null;
  const levels = config.data.tiers;
  const next = levels.find((t) => t.threshold > wallet.data!.lifetimeEarnedPoints);
  const currentThreshold =
    levels.filter((t) => t.threshold <= wallet.data!.lifetimeEarnedPoints).at(-1)?.threshold ?? 0;
  const progress =
    wallet.data.tier === "Unranked"
      ? 0
      : next
        ? Math.min(
            100,
            ((wallet.data.lifetimeEarnedPoints - currentThreshold) /
              Math.max(1, next.threshold - currentThreshold)) *
              100,
          )
        : 100;
  return (
    <>
      <PageHeader
        eyebrow={`Member / ${merchant.name}`}
        title="Ví điểm của bạn"
        description="Số dư và hạng thành viên được quản lý riêng tại mỗi cửa hàng."
      />
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="relative overflow-hidden bg-[#2f583a] p-6 text-white sm:p-8">
          <div className="absolute -right-8 -top-12 h-56 w-56 rounded-full bg-[#537950]/35 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-white/65">ĐIỂM CÓ THỂ SỬ DỤNG</p>
              <p className="mt-3 text-5xl font-extrabold tracking-[-.07em]">
                {number(wallet.data.availablePoints)}
                <span className="ml-2 text-lg font-bold tracking-normal text-[#c5e89b]">điểm</span>
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#d8eeae]">
              <Wallet size={24} weight="light" />
            </span>
          </div>
          <div className="relative mt-8 flex items-center justify-between border-t border-white/15 pt-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Hạng tại {merchant.name}
              </p>
              <p className="mt-1 text-xl font-extrabold">{wallet.data.tier}</p>
            </div>
            <Badge className="bg-[#d8eeae] text-[#31543a]">
              {wallet.data.tier === "Unranked"
                ? "Bắt đầu hành trình"
                : `${number(wallet.data.lifetimeEarnedPoints)} lifetime pts`}
            </Badge>
          </div>
        </Card>
        <Card className="member-gradient relative overflow-hidden p-6 sm:p-8">
          <div className="relative z-1 max-w-[62%]">
            <Badge tone="green">Tiến trình hạng</Badge>
            <h2 className="serif mt-5 text-3xl leading-tight text-[#2e5037]">
              {wallet.data.tier === "Unranked"
                ? "Chuyến đi đầu tiên đang chờ bạn."
                : next
                  ? `Còn ${number(Math.max(0, next.threshold - wallet.data.lifetimeEarnedPoints))} điểm tới ${next.tier}.`
                  : "Bạn đã đạt hạng cao nhất."}
            </h2>
            <p className="mt-3 text-xs leading-6 text-[#647a68]">
              Điểm đã tiêu không làm giảm hạng. Hạng dựa trên tổng điểm từng kiếm được.
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/75">
              <div
                className="h-full rounded-full bg-[#5b8d56] transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] font-bold text-[#6e856f]">
              {number(wallet.data.lifetimeEarnedPoints)} / {next ? number(next.threshold) : "MAX"} lifetime
              points
            </p>
          </div>
          <div className="absolute -bottom-3 -right-3 h-44 w-44">
            <MemberMascot mood="hello" />
          </div>
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edf1ea] p-5 sm:p-6">
          <div>
            <h2 className="font-extrabold">Lịch sử điểm</h2>
            <p className="mt-1 text-xs muted">Giao dịch của riêng {merchant.name}</p>
          </div>
          <Badge tone="green">Lifetime {number(wallet.data.lifetimeEarnedPoints)}</Badge>
        </div>
        {wallet.data.transactions.length ? (
          <div className="divide-y divide-[#edf1ea]">
            {wallet.data.transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${t.amount > 0 ? "bg-[#e8f1e2] text-[#548057]" : "bg-[#f8ebe5] text-[#a46d59]"}`}
                >
                  {t.amount > 0 ? <Sparkle size={18} /> : <Ticket size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t.reason}</p>
                  <p className="mt-1 text-[11px] muted">
                    {shortDate(t.date)} · {t.reference}
                  </p>
                </div>
                <p className={`text-sm font-extrabold ${t.amount > 0 ? "text-[#4d7a50]" : "text-[#a46d59]"}`}>
                  {t.amount > 0 ? "+" : ""}
                  {number(t.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="Chưa có giao dịch"
              description="Đơn đầu tiên được thanh toán thành công sẽ bắt đầu hành trình tích điểm."
              action={
                <Button asChild>
                  <Link to={`/member/${merchant.id}`}>Khám phá gian hàng</Link>
                </Button>
              }
            />
          </div>
        )}
      </Card>
    </>
  );
}

function Benefits({ kind }: { kind: "DISCOUNT" | "REWARD" }) {
  const { merchant } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const wallet = useResource(() => api.getWallet(merchant.id), [merchant.id]);
  const definitions = useResource(() => api.listVoucherDefinitions(merchant.id), [merchant.id]);
  const owned = useResource(() => api.listMemberVouchers(merchant.id), [merchant.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function redeem(definition: VoucherDefinition) {
    if (busy) return;
    setBusy(definition.id);
    setError("");
    setSuccess("");
    try {
      const result = await api.redeemVoucher(definition.id, merchant.id);
      wallet.setData(result.wallet);
      owned.setData((prev) => (prev ? [result.voucher, ...prev] : [result.voucher]));
      setSuccess(
        `${result.voucher.title} đã được cấp. Số dư mới: ${number(result.wallet.availablePoints)} điểm.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi ưu đãi");
      wallet.reload();
    } finally {
      setBusy(null);
    }
  }
  const list = definitions.data?.filter((v) => v.kind === kind && v.active) ?? [];
  const title = kind === "DISCOUNT" ? "Đổi voucher" : "Đổi quà";
  if (wallet.loading || definitions.loading || owned.loading) return <LoadingState />;
  if (wallet.error || definitions.error || owned.error)
    return (
      <ErrorState
        message={wallet.error ?? definitions.error ?? owned.error ?? "Lỗi tải ưu đãi"}
        retry={() => {
          wallet.reload();
          definitions.reload();
          owned.reload();
        }}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow={`Member / ${merchant.name}`}
        title={title}
        description={
          kind === "DISCOUNT"
            ? "Dùng điểm để nhận voucher giảm giá cho đơn tại cửa hàng này."
            : "Đổi điểm để sở hữu quyền nhận quà. Merchant sẽ xác nhận khi trao quà."
        }
        action={
          <Link
            to={`/member/${merchant.id}/wallet`}
            className="flex items-center gap-2 rounded-full bg-[#e8f1e2] px-4 py-2.5 text-xs font-bold accent"
          >
            <Wallet size={16} />
            {number(wallet.data?.availablePoints ?? 0)} điểm
          </Link>
        }
      />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mb-4 rounded-xl bg-[#e8f1e2] p-4 text-sm text-[#376743]">
          {success}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((v) => (
          <Card key={v.id} className="card-hover flex flex-col overflow-hidden">
            <div className="member-gradient p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-[#66865c]">
                  {kind === "DISCOUNT" ? (
                    <Ticket size={24} weight="light" />
                  ) : (
                    <Gift size={24} weight="light" />
                  )}
                </span>
                <Badge tone={wallet.data!.availablePoints >= v.pointsCost ? "green" : "neutral"}>
                  {number(v.pointsCost)} điểm
                </Badge>
              </div>
              <h2 className="serif mt-5 text-2xl text-[#2e5037]">{v.title}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 text-[#66786a]">{v.description}</p>
            </div>
            <div className="flex flex-1 items-center justify-between gap-3 p-5">
              <div>
                {v.kind === "DISCOUNT" && <p className="text-xs muted">Giảm tới</p>}
                <p className="text-lg font-extrabold accent">
                  {v.discountAmount ? money(v.discountAmount) : "Quyền nhận quà"}
                </p>
              </div>
              <Button
                disabled={wallet.data!.availablePoints < v.pointsCost || busy === v.id || !!busy}
                onClick={() => redeem(v)}
              >
                {busy === v.id ? <BusyLabel>Đang đổi</BusyLabel> : "Đổi ngay"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {!list.length && <EmptyState title="Chưa có ưu đãi" description="Merchant chưa tạo ưu đãi loại này." />}
      <section className="mt-9">
        <h2 className="mb-4 text-lg font-extrabold">Voucher của bạn</h2>
        {owned.data?.filter((v) => v.kind === kind).length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {owned.data
              .filter((v) => v.kind === kind)
              .map((v) => (
                <Card key={v.id} className="flex items-center gap-4 p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf4e9] accent">
                    {kind === "DISCOUNT" ? <Ticket size={20} /> : <Gift size={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{v.title}</p>
                    <p className="mt-1 text-xs muted">Mã {v.id}</p>
                  </div>
                  <Badge
                    tone={
                      v.status === "AVAILABLE"
                        ? "green"
                        : v.status === "FULFILLED"
                          ? "green"
                          : v.status === "USED"
                            ? "neutral"
                            : "amber"
                    }
                  >
                    {v.status === "AVAILABLE"
                      ? "Sẵn sàng"
                      : v.status === "USED"
                        ? "Đã sử dụng"
                        : v.status === "FULFILLED"
                          ? "Đã nhận quà"
                          : "Chờ trao quà"}
                  </Badge>
                </Card>
              ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-[#f2f5ef] p-5 text-sm muted">
            Bạn chưa có voucher nào tại {merchant.name}.
          </p>
        )}
      </section>
    </>
  );
}
export const MemberVouchers = () => <Benefits kind="DISCOUNT" />;
export const MemberRewards = () => <Benefits kind="REWARD" />;

export function MemberOrders() {
  const { merchant } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const resource = useResource(() => api.listMemberOrders(merchant.id), [merchant.id]);
  return (
    <>
      <PageHeader
        eyebrow="Member / Hoạt động"
        title="Đơn hàng của bạn"
        description={`Lịch sử mua sắm tại ${merchant.name}.`}
      />
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn hàng của bạn sẽ xuất hiện ở đây."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Khám phá cửa hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {resource.data.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs muted">
                    {shortDate(o.createdAt)} · {o.id}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-extrabold">{money(o.total)}</p>
                    <p className="text-[11px] muted">
                      {o.status === "PAID" ? `+${o.earnedPoints} điểm` : "Chưa phát điểm"}
                    </p>
                  </div>
                  <Badge tone={o.status === "PAID" ? "green" : "amber"}>
                    {o.status === "PAID" ? "PAID" : "PENDING"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MemberOrderResult() {
  const { merchant } = useOutletContext<MemberOutlet>();
  const { orderId } = useParams();
  const api = useApi();
  const resource = useResource(() => api.listMemberOrders(merchant.id), [merchant.id]);
  const order = resource.data?.find((o) => o.id === orderId);
  return (
    <>
      {resource.loading ? (
        <LoadingState cards={1} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !order ? (
        <EmptyState
          title="Không tìm thấy đơn"
          description="Có thể đơn thuộc cửa hàng khác."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="mx-auto max-w-2xl">
          <Card className="overflow-hidden text-center">
            <div className={`p-8 sm:p-12 ${order.status === "PAID" ? "bg-[#eaf5e2]" : "bg-[#fff4df]"}`}>
              <div className="mx-auto h-36 w-36">
                <MemberMascot mood={order.status === "PAID" ? "success" : "idle"} />
              </div>
              <Badge tone={order.status === "PAID" ? "green" : "amber"}>
                {order.status === "PAID" ? "Đã thanh toán" : "Đơn đang chờ xử lý"}
              </Badge>
              <h1 className="serif mt-4 text-3xl text-[#294a32]">
                {order.status === "PAID" ? "Cảm ơn bạn đã mua sắm!" : "Đơn hàng đã được tạo"}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 muted">
                {order.status === "PAID"
                  ? `Bạn nhận ${number(order.earnedPoints)} điểm tại ${merchant.name}.`
                  : "Thanh toán thật chưa kết nối. Điểm và tier chỉ cập nhật khi backend xác nhận đơn PAID."}
              </p>
            </div>
            <div className="p-6 text-left">
              <div className="flex justify-between border-b border-[#edf1ea] pb-4 text-sm">
                <span className="muted">Mã đơn</span>
                <span className="font-extrabold">{order.id}</span>
              </div>
              {order.items.map((i) => (
                <div key={i.productId} className="flex justify-between py-3 text-sm">
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <span className="font-bold">{money(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#edf1ea] pt-4 text-base">
                <span className="font-bold">Tổng cộng</span>
                <span className="font-extrabold">{money(order.total)}</span>
              </div>
              {order.status === "PAID" && (
                <div className="mt-4 flex justify-between rounded-xl bg-[#edf4e9] p-4 text-sm">
                  <span className="font-bold">Điểm đã xác nhận</span>
                  <span className="font-extrabold accent">+{number(order.earnedPoints)}</span>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={`/member/${merchant.id}/orders`}>Xem đơn hàng</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/member/${merchant.id}`}>Tiếp tục khám phá</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
