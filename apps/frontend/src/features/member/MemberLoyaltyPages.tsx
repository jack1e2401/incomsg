import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Gift } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { translateApiError } from "../../api/commerce-http";
import type { MemberVoucherDto, MemberVoucherStatus, VoucherDefinitionDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  StatusText,
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { MemberMascot } from "./MemberMascot";
import { MemberLoyaltyPolicyDialog } from "./MemberLoyaltyPolicyDialog";
import { LoyaltyWalletContent } from "./LoyaltyWalletContent";
import { commerce, money, useMerchantContext } from "./member-context";

export function MemberWallet() {
  const { merchantId, basePath } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => commerce.getMemberWallet(merchantId, accessToken!).then((response) => response.wallet),
    [merchantId, accessToken],
  );
  const wallet = resource.data;
  return (
    <>
      <PageHeader
        title="Điểm thưởng"
        action={
          !resource.loading &&
          !resource.error &&
          wallet?.policy && <MemberLoyaltyPolicyDialog policy={wallet.policy} />
        }
      />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : wallet ? (
        <LoyaltyWalletContent
          wallet={wallet}
          tierArtwork={<MemberMascot mood="hello" />}
          orderLink={(id) => `${basePath}/orders/${id}`}
          voucherLink={`${basePath}/vouchers`}
          emptyAction={
            <Button asChild variant="outline">
              <Link to={basePath}>Khám phá gian hàng</Link>
            </Button>
          }
        />
      ) : null}
    </>
  );
}

export function MemberVouchers() {
  const { merchantId, basePath } = useMerchantContext();
  const { accessToken, user } = useAuthSession();
  const location = useLocation();
  const navigate = useNavigate();
  const isMember = user?.role === "MEMBER" && Boolean(accessToken);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const idempotencyKeysRef = useRef<Record<number, string>>({});
  const catalog = useResource(
    () => commerce.listPublicVoucherDefinitions(merchantId).then((response) => response.definitions),
    [merchantId],
  );
  const owned = useResource(
    () => isMember && accessToken ? commerce.listMemberVouchers(merchantId, accessToken).then((response) => response.vouchers) : Promise.resolve([]),
    [merchantId, isMember, accessToken],
  );
  const wallet = useResource(
    () => isMember && accessToken ? commerce.getMemberWallet(merchantId, accessToken).then((response) => response.wallet) : Promise.resolve(null),
    [merchantId, isMember, accessToken],
  );

  async function redeem(definition: VoucherDefinitionDto) {
    if (!isMember || !accessToken) {
      navigate(`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
      return;
    }
    if (!accessToken || busyId !== null) return;
    setBusyId(definition.id);
    setActionError("");
    setNotice("");

    const key =
      idempotencyKeysRef.current[definition.id] ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    idempotencyKeysRef.current[definition.id] = key;

    try {
      const response = await commerce.redeemVoucher(definition.id, accessToken, key);
      delete idempotencyKeysRef.current[definition.id];
      owned.setData((current) => [response.voucher, ...(current ?? [])]);
      wallet.setData((current) =>
        current
          ? {
              ...current,
              availablePoints: response.wallet.availablePoints,
              lifetimeEarnedPoints: response.wallet.lifetimeEarnedPoints,
            }
          : current,
      );
      wallet.reload();
      catalog.reload();
      setNotice(
        `Đã đổi “${response.voucher.title}”. Số dư điểm mới: ${response.wallet.availablePoints.toLocaleString("vi-VN")} điểm.`,
      );
    } catch (reason) {
      setActionError(reason instanceof Error ? translateApiError(reason.message) : "Không thể đổi voucher");
    } finally {
      setBusyId(null);
    }
  }

  if (catalog.loading || (isMember && (owned.loading || wallet.loading))) return <LoadingState cards={2} />;
  if (catalog.error || (isMember && (owned.error || wallet.error)))
    return (
      <ErrorState
          message={catalog.error ?? owned.error ?? wallet.error ?? "Không tải được voucher"}
        retry={() => {
          catalog.reload();
          owned.reload();
          wallet.reload();
        }}
      />
    );

  return (
    <>
      <PageHeader
        title="Voucher & Ưu đãi"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`${basePath}/rewards`}>
              <Gift size={15} aria-hidden="true" /> Quà tặng đã đổi
            </Link>
          </Button>
        }
      />
      {actionError && (
        <div role="alert" className="mb-4 rounded-xl bg-[#fee2e2] p-3 text-sm text-[#a4473a]">
          <p className="break-words">{actionError}</p>
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 rounded-xl bg-[#e8f1e2] p-3 text-sm text-[#357044]">
          <p className="break-words">{notice}</p>
        </div>
      )}
      {isMember && wallet.data && (
        <p className="mb-5 text-sm font-semibold break-words">
          Điểm khả dụng tại cửa hàng này:{" "}
          <span className="tabular-nums">{wallet.data.availablePoints.toLocaleString("vi-VN")}</span>
        </p>
      )}
      <section id="store-vouchers" className="mb-8">
        <h2 className="mb-3 text-lg font-extrabold">Voucher của cửa hàng</h2>
        {!catalog.data?.length ? (
          <EmptyState
            title="Chưa có voucher"
            description="Cửa hàng chưa đăng voucher đang hoạt động."
            action={
              <Button asChild variant="outline">
                <Link to={basePath}>Xem gian hàng</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {catalog.data.map((voucher) => {
              const outOfStock = voucher.availableQuantity !== null && voucher.availableQuantity <= 0;
              const canRedeem = Boolean(
                wallet.data && wallet.data.availablePoints >= voucher.pointsCost && !outOfStock,
              );
              return (
                <VoucherDefinitionCard
                  key={voucher.id}
                  voucher={voucher}
                  busy={busyId === voucher.id}
                  disabled={busyId !== null || (isMember && !canRedeem)}
                  canRedeem={canRedeem}
                  onRedeem={() => void redeem(voucher)}
                />
              );
            })}
          </div>
        )}
      </section>
      {isMember && <section>
        <h2 className="mb-3 text-lg font-extrabold">Voucher của bạn</h2>
        {!owned.data?.length ? (
          <EmptyState
            title="Bạn chưa có voucher"
            description="Voucher đã đổi tại cửa hàng này sẽ xuất hiện ở đây."
            action={
              catalog.data?.length ? (
                <Button asChild variant="outline">
                  <a href="#store-vouchers">Xem voucher có thể đổi</a>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to={basePath}>Xem gian hàng</Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {owned.data.map((voucher) => (
              <OwnedVoucherCard key={voucher.id} voucher={voucher} />
            ))}
          </div>
        )}
      </section>}
    </>
  );
}

export function MemberRewards() {
  const { merchantId, basePath } = useMerchantContext();
  const { accessToken, user } = useAuthSession();
  const location = useLocation();
  const navigate = useNavigate();
  const isMember = user?.role === "MEMBER" && Boolean(accessToken);
  const resource = useResource(
    async () => isMember && accessToken
      ? { owned: (await commerce.listMemberVouchers(merchantId, accessToken)).vouchers.filter((voucher) => voucher.type === "REWARD"), catalog: [] as VoucherDefinitionDto[] }
      : { owned: [], catalog: (await commerce.listPublicVoucherDefinitions(merchantId)).definitions.filter((voucher) => voucher.type === "REWARD") },
    [merchantId, isMember, accessToken],
  );
  return (
    <>
      <PageHeader title="Quà tặng" />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !(isMember ? resource.data?.owned.length : resource.data?.catalog.length) ? (
        <EmptyState
          title="Chưa có quà tặng"
          description="Voucher quà đã nhận sẽ xuất hiện tại đây."
          action={
            <Button asChild variant="outline">
              <Link to={`${basePath}/vouchers`}>Đổi quà từ voucher</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {isMember ? resource.data?.owned.map((voucher) => <OwnedVoucherCard key={voucher.id} voucher={voucher} />) : resource.data?.catalog.map((voucher) => <VoucherDefinitionCard key={voucher.id} voucher={voucher} busy={false} disabled={false} canRedeem={false} onRedeem={() => navigate(`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`)} />)}
        </div>
      )}
    </>
  );
}

function VoucherDefinitionCard({
  voucher,
  busy,
  disabled,
  canRedeem,
  onRedeem,
}: {
  voucher: VoucherDefinitionDto;
  busy: boolean;
  disabled: boolean;
  canRedeem: boolean;
  onRedeem: () => void;
}) {
  const redeemLabel = voucher.type === "REWARD" ? "Đổi quà" : "Đổi voucher";
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold break-words">{voucher.title}</h3>
        <StatusText tone="green" className="shrink-0">
          {voucher.type === "DISCOUNT" ? "Ưu đãi" : "Quà tặng"}
        </StatusText>
      </div>
      <p className="mt-3 text-sm muted break-words">
        {voucher.type === "DISCOUNT" && voucher.discountAmount
          ? `Giảm ${money(voucher.discountAmount)}`
          : voucher.rewardDescription}
      </p>
      <p className="mt-4 text-sm font-bold tabular-nums">{voucher.pointsCost.toLocaleString("vi-VN")} điểm</p>
      <p className="mt-1 text-xs muted">
        {voucher.availableQuantity === null ? "Có sẵn" : `${voucher.availableQuantity} còn lại`}
      </p>
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={disabled}
        aria-label={`${redeemLabel} “${voucher.title}”`}
        onClick={onRedeem}
      >
        {busy ? <BusyLabel>Đang đổi</BusyLabel> : redeemLabel}
      </Button>
      {voucher.availableQuantity !== null && voucher.availableQuantity <= 0 ? (
        <p className="mt-1.5 text-center text-[11px] text-[#a4473a]">Đã hết hàng</p>
      ) : !canRedeem ? (
        <p className="mt-1.5 text-center text-[11px] text-[#97682a]">Chưa đủ điểm để đổi</p>
      ) : null}
    </Card>
  );
}

function voucherStatusTone(status: MemberVoucherStatus): "neutral" | "green" | "amber" | "red" {
  if (status === "FULFILLED" || status === "USED") return "neutral";
  if (status === "CANCELLED") return "red";
  if (status === "PENDING_FULFILLMENT" || status === "RESERVED") return "amber";
  return "green";
}

function OwnedVoucherCard({ voucher }: { voucher: MemberVoucherDto }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold break-words">{voucher.title}</h3>
        <StatusText tone={voucherStatusTone(voucher.status)} className="shrink-0">
          {voucherStatusLabel(voucher)}
        </StatusText>
      </div>
      <p className="mt-3 text-sm muted break-words">
        {voucher.type === "DISCOUNT" && voucher.discountAmount
          ? `Giảm ${money(voucher.discountAmount)}`
          : voucher.rewardDescription}
      </p>
      <p className="mt-4 text-xs muted">
        Đổi ngày {new Date(voucher.redeemedAt).toLocaleDateString("vi-VN")}
      </p>
      {voucher.usedAt && (
        <p className="mt-1 text-xs muted">
          Đã sử dụng: {new Date(voucher.usedAt).toLocaleDateString("vi-VN")}
        </p>
      )}
    </Card>
  );
}

function voucherStatusLabel(voucher: MemberVoucherDto) {
  if (voucher.status === "PENDING_FULFILLMENT") return "Chờ cửa hàng trao";
  if (voucher.status === "CANCELLED") return "Đã hủy";
  if (voucher.status === "USED") return "Đã sử dụng";
  if (voucher.status === "FULFILLED") return "Đã trao";
  if (voucher.status === "RESERVED" || (voucher.status === "AVAILABLE" && voucher.reserved))
    return "Đang giữ cho đơn chờ";
  if (voucher.status === "AVAILABLE") {
    return voucher.type === "REWARD" ? "Chờ cửa hàng trao" : "Còn hiệu lực";
  }
  return voucher.status;
}
