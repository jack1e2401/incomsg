import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ShoppingCart,
  Storefront,
  Wallet,
  Ticket,
  Gift,
  Receipt,
  SignOut,
} from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type {
  MemberVoucherDto,
  MemberVoucherStatus,
  OrderStatus,
  VoucherDefinitionDto,
} from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  StatusText,
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "../../components/ui";
import { MemberMascot } from "./MemberMascot";
import { MemberLoyaltyPolicyDialog } from "./MemberLoyaltyPolicyDialog";
import { LoyaltyWalletContent } from "./LoyaltyWalletContent";
import { useMemberCart } from "./useMemberCart";

function orderStatusTone(status: OrderStatus): "green" | "amber" | "neutral" | "red" | "purple" {
  switch (status) {
    case "PAID":
      return "green";
    case "PENDING":
    case "REFUND_PENDING":
      return "amber";
    case "REFUNDED":
      return "purple";
    case "FAILED":
      return "red";
    case "CANCELLED":
    default:
      return "neutral";
  }
}

function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PENDING":
      return "Chờ thanh toán";
    case "REFUND_PENDING":
      return "Đang hoàn tiền";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thất bại";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const money = (value: string | bigint) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    typeof value === "bigint" ? value : Number(value),
  );
type MemberContext = { merchantId: number; cart: ReturnType<typeof useMemberCart> };

function useMerchantContext() {
  return useOutletContext<MemberContext>();
}

export function BackendMemberLayout() {
  const merchantId = Number(useParams().merchantId);
  const { user } = useAuthSession();
  if (!Number.isInteger(merchantId) || merchantId < 1)
    return <ErrorState message="Mã cửa hàng không hợp lệ." />;
  if (!user) return null;

  const storageKey = `loyalty.member.cart.${user.id}.${merchantId}`;
  return <MemberStoreLayout key={storageKey} merchantId={merchantId} storageKey={storageKey} />;
}

function MemberStoreLayout({ merchantId, storageKey }: { merchantId: number; storageKey: string }) {
  const cart = useMemberCart(storageKey, merchantId);
  const { logout } = useAuthSession();
  const navigate = useNavigate();

  const base = `/member/${merchantId}`;
  const cartQuantity = cart.quantity;
  const cartLabel = cartQuantity > 0 ? `Giỏ hàng, ${cartQuantity} sản phẩm` : undefined;
  const cartBadge = cartQuantity > 0 && (
    <span
      aria-hidden="true"
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#335e3d] px-1 text-[10px] font-bold leading-none text-white tabular-nums"
    >
      {cartQuantity}
    </span>
  );
  const links = [
    { to: base, label: "Cửa hàng", icon: Storefront, end: true },
    { to: `${base}/wallet`, label: "Ví điểm", icon: Wallet },
    { to: `${base}/vouchers`, label: "Voucher", icon: Ticket },
    { to: `${base}/rewards`, label: "Quà tặng", icon: Gift },
    { to: `${base}/orders`, label: "Đơn hàng", icon: Receipt },
    { to: `${base}/cart`, label: "Giỏ hàng", icon: ShoppingCart, isCart: true },
  ];
  return (
    <div className="min-h-dvh bg-[#fcfcf8] pb-20 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-[#e5ece3] bg-[#fcfcf8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-7">
          <Link
            to="/member"
            className="rounded-md font-extrabold tracking-tight text-[#24452f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
          >
            loyalty<span className="text-[#89b461]">.</span>
          </Link>
          <span className="min-w-0 truncate text-xs font-semibold text-[#527353]">
            Cửa hàng #{merchantId}
          </span>
          <nav aria-label="Member" className="hidden gap-1 lg:flex">
            {links.map(({ to, label, end, isCart }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={isCart ? cartLabel : undefined}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] ${isActive ? "bg-[#e8f1e2] text-[#335e3d]" : "text-[#718176] hover:bg-[#edf4e9]"}`
                }
              >
                {label}
                {isCart && cartBadge}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold text-[#54725a] hover:bg-[#edf4e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] sm:px-3"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <SignOut aria-hidden="true" size={16} /> <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:py-10">
        <Outlet context={{ merchantId, cart } satisfies MemberContext} />
      </main>
      <nav
        aria-label="Điều hướng Member"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#e5ece3] bg-[#fcfcf8] px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 lg:hidden"
      >
        {links.map(({ to, label, icon: Icon, end, isCart }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={isCart ? cartLabel : undefined}
            className={({ isActive }) =>
              `flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] ${isActive ? "text-[#335e3d]" : "text-[#718176]"}`
            }
          >
            <span className="relative">
              <Icon aria-hidden="true" size={20} />
              {isCart && cartBadge && <span className="absolute -top-1.5 -right-3">{cartBadge}</span>}
            </span>
            <span className="max-w-full truncate px-0.5 text-center">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function MemberStorefront() {
  const { merchantId, cart } = useMerchantContext();
  const products = useResource(
    () => commerce.listPublicProducts(merchantId).then((response) => response.products),
    [merchantId],
  );
  return (
    <>
      <PageHeader title={`Cửa hàng #${merchantId}`} />
      {products.loading ? (
        <LoadingState />
      ) : products.error ? (
        <ErrorState message={products.error} retry={products.reload} />
      ) : !products.data?.length ? (
        <EmptyState title="Chưa có sản phẩm" description="Cửa hàng chưa đăng sản phẩm đang bán." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.data.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <Link
                to={`product/${product.id}`}
                className="block aspect-[4/3] bg-[#edf2e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
                aria-label={`Xem chi tiết ${product.name}`}
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[#709275]">
                    <Storefront aria-hidden="true" size={36} />
                  </div>
                )}
              </Link>
              <div className="p-4 sm:p-5">
                <h2 className="font-extrabold text-[#294432] break-words">{product.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm muted break-words">{product.description}</p>
                <p className="mt-4 text-lg font-extrabold text-[#335e3d] tabular-nums">
                  {money(product.price)}
                </p>
                <p className="mt-1 text-xs muted">Còn {product.inventory.availableQuantity} sản phẩm</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="flex-1 sm:flex-none">
                    <Link to={`product/${product.id}`} aria-label={`Chi tiết ${product.name}`}>
                      Chi tiết
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 sm:flex-none"
                    disabled={!cart.canAdd(product.id, product.inventory.availableQuantity)}
                    aria-label={product.inventory.availableQuantity > 0 ? `Chọn mua ${product.name}` : `${product.name} đã hết hàng`}
                    onClick={() => cart.addProduct(product)}
                  >
                    {product.inventory.availableQuantity > 0 ? "Chọn mua" : "Hết hàng"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MemberProduct() {
  const { merchantId, cart } = useMerchantContext();
  const productId = Number(useParams().productId);
  const products = useResource(
    () => commerce.listPublicProducts(merchantId).then((response) => response.products),
    [merchantId],
  );
  if (!Number.isInteger(productId) || productId < 1)
    return <ErrorState message="Mã sản phẩm không hợp lệ." />;
  if (products.loading) return <LoadingState cards={1} />;
  if (products.error) return <ErrorState message={products.error} retry={products.reload} />;
  const product = products.data?.find((item) => item.id === productId);
  if (!product)
    return (
      <EmptyState
        title="Không tìm thấy sản phẩm"
        description="Sản phẩm có thể đã được ẩn hoặc ngừng bán."
        action={
          <Button asChild variant="outline">
            <Link to={`/member/${merchantId}`}>Về gian hàng</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <Link
        to={`/member/${merchantId}`}
        className="mb-5 inline-flex items-center gap-2 rounded text-sm font-bold text-[#335e3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Gian hàng
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-[1.7rem] bg-[#edf2e9]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[#709275]">
              <Storefront aria-hidden="true" size={54} />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <StatusText tone={product.inventory.availableQuantity > 0 ? "green" : "amber"} className="w-fit">
            {product.inventory.availableQuantity > 0 ? "Đang bán" : "Hết hàng"}
          </StatusText>
          <h1 className="mt-4 sm:mt-5 text-2xl font-extrabold text-[#294432] break-words sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 sm:mt-4 text-xl font-extrabold text-[#335e3d] tabular-nums break-words sm:text-2xl">
            {money(product.price)}
          </p>
          {product.description && (
            <p className="mt-5 sm:mt-6 whitespace-pre-line text-sm leading-7 muted break-words">
              {product.description}
            </p>
          )}
          <p className="mt-3 text-sm muted">Còn {product.inventory.availableQuantity} sản phẩm</p>
          <Button
            type="button"
            className="mt-6 sm:mt-8 w-full sm:w-fit"
            disabled={!cart.canAdd(product.id, product.inventory.availableQuantity)}
            aria-label={`Chọn mua ${product.name}`}
            onClick={() => cart.addProduct(product)}
          >
            <ShoppingCart aria-hidden="true" size={18} /> {product.inventory.availableQuantity > 0 ? "Chọn mua" : "Hết hàng"}
          </Button>
        </div>
      </div>
    </>
  );
}

export function MemberCart() {
  const { merchantId, cart } = useMerchantContext();
  const stockIssue = cart.lines.find(({ product, quantity }) => quantity > (product.inventory?.availableQuantity ?? quantity));
  return (
    <>
      <PageHeader title="Giỏ hàng" />
      {!cart.lines.length ? (
        <EmptyState
          title="Giỏ hàng trống"
          description="Chọn sản phẩm từ gian hàng để tạo đơn."
          action={
            <Button asChild>
              <Link to={`/member/${merchantId}`}>Xem sản phẩm</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {cart.lines.map(({ product, quantity }) => (
              <Card key={product.id} className="p-4 sm:p-5">
                <h2 className="font-extrabold break-words">{product.name}</h2>
                <p className="mt-1 text-sm muted tabular-nums break-words">
                  {money(product.price)} mỗi sản phẩm
                </p>
                <div className="mt-3">
                  <Field label="Số lượng">
                    <Input
                      type="number"
                      min={1}
                      max={Math.min(99, product.inventory?.availableQuantity ?? 99)}
                      aria-label={`Số lượng ${product.name}`}
                      value={quantity}
                      onChange={(event) => {
                        const val = event.target.valueAsNumber;
                        if (!Number.isNaN(val)) cart.setQuantity(product.id, val);
                      }}
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 text-[#a4473a] hover:text-[#8d382d]"
                  aria-label={`Bỏ ${product.name} khỏi giỏ hàng`}
                  onClick={() => cart.removeProduct(product.id)}
                >
                  Bỏ sản phẩm
                </Button>
              </Card>
            ))}
          </div>
          <Card className="h-fit p-4 sm:p-5">
            <p className="text-xs muted">Tạm tính</p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums break-words">{money(cart.subtotal)}</p>
            {stockIssue && <p role="alert" className="mt-3 text-sm text-[#a4473a]">Số lượng {stockIssue.product.name} vượt tồn kho hiện tại.</p>}
            <Button asChild className="mt-5 w-full" disabled={Boolean(stockIssue)}>
              <Link to={`/member/${merchantId}/checkout`} aria-disabled={Boolean(stockIssue)}>
                Tiếp tục <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}

export function MemberCheckout() {
  const { merchantId, cart } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [earningEstimate, setEarningEstimate] = useState<string | null>(null);
  const vouchers = useResource(
    () => commerce.listMemberVouchers(merchantId, accessToken!).then((response) => response.vouchers),
    [merchantId, accessToken],
  );
  const availableDiscounts = useMemo(
    () =>
      (vouchers.data ?? []).filter(
        (voucher) => voucher.type === "DISCOUNT" && voucher.status === "AVAILABLE" && !voucher.reserved,
      ),
    [vouchers.data],
  );
  const reservedDiscounts = useMemo(
    () =>
      (vouchers.data ?? []).filter(
        (voucher) =>
          voucher.type === "DISCOUNT" &&
          (voucher.status === "RESERVED" || (voucher.status === "AVAILABLE" && voucher.reserved)),
      ),
    [vouchers.data],
  );

  const selectedDiscountAmount = useMemo(() => {
    if (!voucherId || !vouchers.data) return "0";
    const voucher = vouchers.data.find(
      (v) => String(v.id) === voucherId && v.type === "DISCOUNT" && v.status === "AVAILABLE" && !v.reserved,
    );
    return voucher?.discountAmount ?? "0";
  }, [voucherId, vouchers.data]);

  const netOrderAmountString = useMemo(() => {
    const discountVal = BigInt(selectedDiscountAmount);
    const netAmount = cart.subtotal > discountVal ? cart.subtotal - discountVal : 0n;
    return String(netAmount);
  }, [cart.subtotal, selectedDiscountAmount]);
  const stockIssue = cart.lines.find(({ product, quantity }) => quantity > (product.inventory?.availableQuantity ?? quantity));

  useEffect(() => {
    let active = true;
    if (!accessToken || !cart.lines.length) {
      setEarningEstimate(null);
      return;
    }
    commerce
      .previewMemberEarning(merchantId, netOrderAmountString, accessToken)
      .then((res) => {
        if (active) setEarningEstimate(res.estimatedPointsExact);
      })
      .catch(() => {
        if (active) setEarningEstimate(null);
      });
    return () => {
      active = false;
    };
  }, [accessToken, merchantId, netOrderAmountString, cart.lines.length]);

  async function submit() {
    if (!cart.lines.length || !accessToken || busy) return;
    if (stockIssue) {
      setError(`Số lượng ${stockIssue.product.name} vượt tồn kho hiện tại. Hãy điều chỉnh giỏ hàng.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const items = cart.lines.map(({ product, quantity }) => ({ productId: product.id, quantity }));
      const { order } = await commerce.createOrder(
        {
          ...(items.length === 1 ? items[0] : { items }),
          ...(voucherId ? { voucherId: Number(voucherId) } : {}),
        },
        accessToken,
      );
      cart.clear();
      navigate(`/member/${merchantId}/orders/${order.id}`, { state: { order } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo đơn");
      if (reason instanceof Error) {
        setError(translateApiError(reason.message));
        if (reason.message.includes("VOUCHER")) vouchers.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Xác nhận đơn hàng" />
      {!cart.lines.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Vui lòng chọn sản phẩm trước khi tạo đơn."
          action={
            <Button asChild>
              <Link to={`/member/${merchantId}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <Card className="p-4 sm:p-5">
            <ul className="divide-y divide-[#e5ece3]">
              {cart.lines.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0 font-extrabold break-words">{product.name}</span>
                  <span className="shrink-0 text-sm muted tabular-nums">× {quantity}</span>
                </li>
              ))}
            </ul>
            {vouchers.loading ? (
              <div role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-sm muted">
                <BusyLabel>Đang tải voucher khả dụng…</BusyLabel>
              </div>
            ) : vouchers.error ? (
              <div role="alert" className="mt-4 rounded-xl bg-[#fff1d6] p-4 text-[#97682a]">
                <p className="text-sm font-semibold">Không tải được voucher</p>
                <p className="mt-1 text-xs break-words">{vouchers.error}</p>
                <Button
                  type="button"
                  className="mt-3 w-full sm:w-auto"
                  size="sm"
                  variant="outline"
                  onClick={vouchers.reload}
                >
                  Thử lại
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Field label="Voucher giảm giá">
                  <Select
                    id="checkout-voucher-select"
                    aria-label="Voucher giảm giá"
                    value={voucherId}
                    onChange={(event) => setVoucherId(event.target.value)}
                  >
                    <option value="">Không sử dụng voucher</option>
                    {availableDiscounts.map((voucher) => (
                      <option key={voucher.id} value={voucher.id}>
                        {voucher.title} · giảm {voucher.discountAmount ? money(voucher.discountAmount) : "—"}
                      </option>
                    ))}
                  </Select>
                  {!availableDiscounts.length && (
                    <span className="mt-2 block text-xs muted">Bạn chưa có voucher giảm giá khả dụng.</span>
                  )}
                  {reservedDiscounts.length > 0 && (
                    <p className="mt-3 rounded-lg bg-[#fff1d6] p-3 text-xs leading-5 text-[#97682a] break-words">
                      {reservedDiscounts.map((voucher) => `“${voucher.title}”`).join(", ")} đang được giữ bởi
                      đơn chờ thanh toán nên không thể dùng cho đơn hàng này hoặc ở cửa hàng khác.
                    </p>
                  )}
                </Field>
              </div>
            )}
          </Card>
          <Card className="h-fit p-4 sm:p-5">
            <p className="font-extrabold text-[#20392a]">Đơn chờ thanh toán</p>
            <div className="mt-3 space-y-2 border-b border-[#e5ece3] pb-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="muted">Tạm tính</span>
                <span className="shrink-0 font-semibold tabular-nums break-words">
                  {money(cart.subtotal)}
                </span>
              </div>
              {selectedDiscountAmount !== "0" && (
                <div className="flex justify-between gap-2 text-[#357044]">
                  <span>Voucher giảm giá</span>
                  <span className="shrink-0 font-semibold tabular-nums break-words">
                    −{money(selectedDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2 pt-1 font-bold">
                <span>Tổng dự tính</span>
                <span className="shrink-0 text-base text-[#335e3d] tabular-nums break-words">
                  {money(netOrderAmountString)}
                </span>
              </div>
            </div>
            {earningEstimate != null && (
              <p className="mt-3 text-xs text-[#357044] break-words">
                Ước tính tích lũy: +{earningEstimate} điểm
              </p>
            )}
            {stockIssue && <p role="alert" className="mt-3 text-sm text-[#a4473a]">Số lượng {stockIssue.product.name} vượt tồn kho hiện tại.</p>}
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700 break-words">
                {error}
              </p>
            )}
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={busy || vouchers.loading || Boolean(stockIssue)}
              onClick={submit}
            >
              {busy ? (
                <BusyLabel>Đang tạo đơn</BusyLabel>
              ) : (
                <>
                  Tạo đơn <ArrowRight aria-hidden="true" size={16} />
                </>
              )}
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}

export { MemberOrderResult } from "./MemberOrderResult";

export function MemberOrders() {
  const { merchantId } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => commerce.listMemberOrders(merchantId, accessToken!).then(({ orders }) => orders),
    [merchantId, accessToken],
  );
  return (
    <>
      <PageHeader title="Đơn hàng" description={`Đơn của bạn tại cửa hàng #${merchantId}.`} />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn bạn tạo tại cửa hàng này sẽ xuất hiện ở đây."
          action={
            <Button asChild>
              <Link to={`/member/${merchantId}`}>Mua sắm ngay</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {resource.data.map((order) => (
            <Card
              key={order.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-extrabold break-words">Đơn #{order.id}</p>
                <p className="mt-1 text-xs muted break-words">
                  {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-bold tabular-nums break-words">{money(order.total)}</p>
                  <StatusText tone={orderStatusTone(order.status)}>
                    {orderStatusLabel(order.status)}
                  </StatusText>
                  {order.refundStatus === "PENDING_PROVIDER" && (
                    <p className="text-[10px] text-[#97682a] break-words">Chờ cổng hoàn tiền</p>
                  )}
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link
                    to={`/member/${merchantId}/orders/${order.id}`}
                    aria-label={`Chi tiết đơn hàng #${order.id}`}
                  >
                    Chi tiết
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MemberWallet() {
  const { merchantId } = useMerchantContext();
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
          orderLink={(id) => `/member/${merchantId}/orders/${id}`}
          voucherLink={`/member/${merchantId}/vouchers`}
          emptyAction={
            <Button asChild variant="outline">
              <Link to={`/member/${merchantId}`}>Khám phá gian hàng</Link>
            </Button>
          }
        />
      ) : null}
    </>
  );
}

export function MemberVouchers() {
  const { merchantId } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const idempotencyKeysRef = useRef<Record<number, string>>({});
  const catalog = useResource(
    () => commerce.listPublicVoucherDefinitions(merchantId).then((response) => response.definitions),
    [merchantId],
  );
  const owned = useResource(
    () => commerce.listMemberVouchers(merchantId, accessToken!).then((response) => response.vouchers),
    [merchantId, accessToken],
  );
  const wallet = useResource(
    () => commerce.getMemberWallet(merchantId, accessToken!).then((response) => response.wallet),
    [merchantId, accessToken],
  );

  async function redeem(definition: VoucherDefinitionDto) {
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

  if (catalog.loading || owned.loading || wallet.loading) return <LoadingState cards={2} />;
  if (catalog.error || owned.error || wallet.error)
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
      <PageHeader title="Voucher" />
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
      {wallet.data && (
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
                <Link to={`/member/${merchantId}`}>Xem gian hàng</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {catalog.data.map((voucher) => {
              const outOfStock = voucher.availableQuantity !== null && voucher.availableQuantity <= 0;
              const canRedeem = Boolean(wallet.data && wallet.data.availablePoints >= voucher.pointsCost && !outOfStock);
              return (
                <VoucherDefinitionCard
                  key={voucher.id}
                  voucher={voucher}
                  busy={busyId === voucher.id}
                  disabled={busyId !== null || !canRedeem}
                  canRedeem={canRedeem}
                  onRedeem={() => void redeem(voucher)}
                />
              );
            })}
          </div>
        )}
      </section>
      <section>
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
                  <Link to={`/member/${merchantId}`}>Xem gian hàng</Link>
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
      </section>
    </>
  );
}

export function MemberRewards() {
  const { merchantId } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () =>
      commerce
        .listMemberVouchers(merchantId, accessToken!)
        .then((response) => response.vouchers.filter((voucher) => voucher.type === "REWARD")),
    [merchantId, accessToken],
  );
  return (
    <>
      <PageHeader title="Quà tặng" />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có quà tặng"
          description="Voucher quà đã nhận sẽ xuất hiện tại đây."
          action={
            <Button asChild variant="outline">
              <Link to={`/member/${merchantId}/vouchers`}>Đổi quà từ voucher</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resource.data.map((voucher) => (
            <OwnedVoucherCard key={voucher.id} voucher={voucher} />
          ))}
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
      <p className="mt-1 text-xs muted">{voucher.availableQuantity === null ? "Có sẵn" : `${voucher.availableQuantity} còn lại`}</p>
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
      ) : !canRedeem ? <p className="mt-1.5 text-center text-[11px] text-[#97682a]">Chưa đủ điểm để đổi</p> : null}
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
