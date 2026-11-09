import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
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
import { createCommerceClient } from "../../api/commerce-http";
import type {
  MemberVoucherDto,
  OrderDto,
  PointTransactionType,
  ProductDto,
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
} from "../../components/ui";
import { MemberMascot } from "./MemberMascot";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const money = (value: string) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    Number(value),
  );
type Cart = { product: ProductDto; quantity: number } | null;
type MemberContext = { merchantId: number; cart: Cart; setCart: (cart: Cart) => void };

function useMerchantContext() {
  return useOutletContext<MemberContext>();
}

export function BackendMemberLayout() {
  const rawId = useParams().merchantId;
  const merchantId = Number(rawId);
  const [carts, setCarts] = useState<Record<number, Cart>>({});
  const { logout } = useAuthSession();
  const navigate = useNavigate();
  if (!Number.isInteger(merchantId) || merchantId < 1)
    return <ErrorState message="Mã cửa hàng không hợp lệ." />;
  const base = `/member/${merchantId}`;
  const links = [
    { to: base, label: "Cửa hàng", icon: Storefront, end: true },
    { to: `${base}/wallet`, label: "Ví điểm", icon: Wallet },
    { to: `${base}/vouchers`, label: "Voucher", icon: Ticket },
    { to: `${base}/rewards`, label: "Quà tặng", icon: Gift },
    { to: `${base}/orders`, label: "Đơn hàng", icon: Receipt },
    { to: `${base}/cart`, label: "Giỏ hàng", icon: ShoppingCart },
  ];
  return (
    <div className="min-h-dvh bg-[#fcfcf8] pb-20 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-[#e5ece3] bg-[#fcfcf8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-7">
          <Link to="/member" className="font-extrabold tracking-tight text-[#24452f]">
            loyalty<span className="text-[#89b461]">.</span>
          </Link>
          <span className="min-w-0 truncate text-xs font-semibold text-[#527353]">
            Cửa hàng #{merchantId}
          </span>
          <nav aria-label="Member" className="hidden gap-1 lg:flex">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 text-xs font-bold ${isActive ? "bg-[#e8f1e2] text-[#335e3d]" : "text-[#718176]"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold text-[#54725a] hover:bg-[#edf4e9] sm:px-3"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <SignOut size={16} /> <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:py-10">
        <Outlet
          context={
            {
              merchantId,
              cart: carts[merchantId] ?? null,
              setCart: (cart: Cart) => setCarts((previous) => ({ ...previous, [merchantId]: cart })),
            } satisfies MemberContext
          }
        />
      </main>
      <nav
        aria-label="Điều hướng Member"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#e5ece3] bg-[#fcfcf8] px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 lg:hidden"
      >
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[9px] font-bold ${isActive ? "text-[#335e3d]" : "text-[#718176]"}`
            }
          >
            <Icon size={20} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function MemberStorefront() {
  const { merchantId, setCart } = useMerchantContext();
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
              <Link to={`product/${product.id}`} className="block aspect-[4/3] bg-[#edf2e9]">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[#709275]">
                    <Storefront size={36} />
                  </div>
                )}
              </Link>
              <div className="p-5">
                <h2 className="font-extrabold text-[#294432]">{product.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm muted">{product.description}</p>
                <p className="mt-4 text-lg font-extrabold text-[#335e3d]">{money(product.price)}</p>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline">
                    <Link to={`product/${product.id}`}>Chi tiết</Link>
                  </Button>
                  <Button onClick={() => setCart({ product, quantity: 1 })}>Chọn mua</Button>
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
  const { merchantId, setCart } = useMerchantContext();
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
      <EmptyState title="Không tìm thấy sản phẩm" description="Sản phẩm có thể đã được ẩn hoặc ngừng bán." />
    );
  return (
    <>
      <Link
        to={`/member/${merchantId}`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#335e3d]"
      >
        <ArrowLeft size={16} /> Gian hàng
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-[1.7rem] bg-[#edf2e9]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[#709275]">
              <Storefront size={54} />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <StatusText tone="green" className="w-fit">
            Đang bán
          </StatusText>
          <h1 className="mt-5 text-4xl font-extrabold text-[#294432]">{product.name}</h1>
          <p className="mt-4 text-2xl font-extrabold text-[#335e3d]">{money(product.price)}</p>
          {product.description && (
            <p className="mt-6 whitespace-pre-line text-sm leading-7 muted">{product.description}</p>
          )}
          <Button className="mt-8 w-fit" onClick={() => setCart({ product, quantity: 1 })}>
            <ShoppingCart size={18} /> Chọn mua
          </Button>
        </div>
      </div>
    </>
  );
}

export function MemberCart() {
  const { merchantId, cart, setCart } = useMerchantContext();
  return (
    <>
      <PageHeader title="Giỏ hàng" />
      {!cart ? (
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
          <Card className="p-5">
            <h2 className="font-extrabold">{cart.product.name}</h2>
            <p className="mt-2 text-sm muted">{money(cart.product.price)} mỗi sản phẩm</p>
            <Field label="Số lượng">
              <Input
                type="number"
                min={1}
                max={99}
                value={cart.quantity}
                onChange={(event) => {
                  const quantity = Number(event.target.value);
                  if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99)
                    setCart({ ...cart, quantity });
                }}
              />
            </Field>
            <Button variant="ghost" className="mt-3" onClick={() => setCart(null)}>
              Bỏ sản phẩm
            </Button>
          </Card>
          <Card className="h-fit p-5">
            <p className="text-xs muted">Tạm tính</p>
            <p className="mt-2 text-2xl font-extrabold">
              {money(String(Number(cart.product.price) * cart.quantity))}
            </p>
            <Button asChild className="mt-5 w-full">
              <Link to={`/member/${merchantId}/checkout`}>
                Tiếp tục <ArrowRight size={16} />
              </Link>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}

export function MemberCheckout() {
  const { merchantId, cart, setCart } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!cart || !accessToken || busy) return;
    setBusy(true);
    setError("");
    try {
      const { order } = await commerce.createOrder(
        { productId: cart.product.id, quantity: cart.quantity },
        accessToken,
      );
      setCart(null);
      navigate(`/member/${merchantId}/orders/${order.id}`, { state: { order } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo đơn");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Xác nhận đơn hàng" description="Đơn được tạo ở trạng thái chờ thanh toán." />
      {!cart ? (
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
          <Card className="p-5">
            <h2 className="font-extrabold">{cart.product.name}</h2>
            <p className="mt-2 text-sm muted">Số lượng: {cart.quantity}</p>
            <p className="mt-2 text-sm muted">Cửa hàng #{merchantId}</p>
          </Card>
          <Card className="h-fit p-5">
            <p className="font-extrabold">Đơn chờ thanh toán</p>
            <p className="mt-2 text-xs leading-5 muted">Thanh toán chưa khả dụng.</p>
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button className="mt-5 w-full" disabled={busy} onClick={submit}>
              {busy ? (
                <BusyLabel>Đang tạo đơn</BusyLabel>
              ) : (
                <>
                  Tạo đơn chờ thanh toán <ArrowRight size={16} />
                </>
              )}
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}

export function MemberOrderResult() {
  const { merchantId } = useMerchantContext();
  const { state } = useLocation() as { state: { order?: OrderDto } | null };
  const orderId = Number(useParams().orderId);
  const order = state?.order?.id === orderId && state.order.merchantId === merchantId ? state.order : null;
  if (!order)
    return (
      <Unavailable
        title="Không tải được đơn hàng"
        description="Kết quả đơn hàng chỉ xem được ngay sau khi tạo."
      />
    );
  return (
    <>
      <PageHeader title={`Đơn #${order.id}`} />
      <Card className="p-6">
        <StatusText tone={order.status === "PAID" ? "green" : "amber"}>
          {order.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
        </StatusText>
        <div className="mt-5 space-y-3">
          {order.items.map((item) => (
            <div key={item.productId} className="flex justify-between gap-3 text-sm">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span className="font-bold">{money(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t border-[#e5ece3] pt-5 font-extrabold">
          <span>Tổng cộng</span>
          <span>{money(order.total)}</span>
        </div>
        {order.status === "PENDING" && (
          <p className="mt-5 rounded-xl bg-[#fff1d6] p-4 text-xs leading-5 text-[#97682a]">
            Đơn đang chờ thanh toán. Chưa có điểm thưởng hoặc xác nhận thanh toán.
          </p>
        )}
      </Card>
    </>
  );
}

function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Chưa khả dụng" description={description} />
    </>
  );
}
export function MemberOrders() {
  return <Unavailable title="Đơn hàng" description="Tính năng này chưa được hỗ trợ." />;
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
      <PageHeader title="Ví điểm và hạng" />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : wallet ? (
        <div className="space-y-5">
          <Card className="grid gap-5 p-6 sm:grid-cols-3 sm:p-8">
            <div>
              <p className="text-xs muted">Điểm khả dụng</p>
              <p className="mt-2 text-3xl font-extrabold">{wallet.availablePoints.toLocaleString("vi-VN")}</p>
            </div>
            <div>
              <p className="text-xs muted">Tổng điểm đã tích</p>
              <p className="mt-2 text-3xl font-extrabold">
                {wallet.lifetimeEarnedPoints.toLocaleString("vi-VN")}
              </p>
            </div>
            <div>
              <p className="text-xs muted">Hạng</p>
              <p className="mt-2 text-2xl font-extrabold">
                {wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : wallet.tier}
              </p>
            </div>
          </Card>
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Lịch sử điểm</h2>
            {!wallet.transactions.length ? (
              <EmptyState
                title="Chưa có giao dịch điểm"
                description="Giao dịch sẽ xuất hiện sau hoạt động tại cửa hàng này."
              />
            ) : (
              <div className="space-y-2">
                {wallet.transactions.map((transaction) => (
                  <Card
                    key={transaction.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold">{transaction.reason}</p>
                      <p className="mt-1 text-xs muted">
                        {new Date(transaction.createdAt).toLocaleString("vi-VN")} ·{" "}
                        {transactionTypeLabel(transaction.type)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-extrabold ${transaction.delta < 0 ? "text-[#a4473a]" : "text-[#357044]"}`}
                      >
                        {transaction.delta > 0 ? "+" : ""}
                        {transaction.delta.toLocaleString("vi-VN")}
                      </p>
                      <p className="text-xs muted">Còn {transaction.balanceAfter.toLocaleString("vi-VN")}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
export function MemberVouchers() {
  const { merchantId } = useMerchantContext();
  const { accessToken } = useAuthSession();
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
      {wallet.data && (
        <p className="mb-5 text-sm font-semibold">
          Điểm khả dụng tại cửa hàng này: {wallet.data.availablePoints.toLocaleString("vi-VN")}
        </p>
      )}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-extrabold">Voucher của cửa hàng</h2>
        {!catalog.data?.length ? (
          <EmptyState title="Chưa có voucher" description="Cửa hàng chưa đăng voucher đang hoạt động." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {catalog.data.map((voucher) => (
              <VoucherDefinitionCard key={voucher.id} voucher={voucher} />
            ))}
          </div>
        )}
        <p className="mt-3 text-sm muted">Đổi voucher chưa khả dụng.</p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-extrabold">Voucher của bạn</h2>
        {!owned.data?.length ? (
          <EmptyState
            title="Bạn chưa có voucher"
            description="Voucher đã đổi tại cửa hàng này sẽ xuất hiện ở đây."
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
        <EmptyState title="Chưa có quà tặng" description="Voucher quà đã nhận sẽ xuất hiện tại đây." />
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

function VoucherDefinitionCard({ voucher }: { voucher: VoucherDefinitionDto }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold">{voucher.title}</h3>
        <StatusText tone="green">{voucher.type === "DISCOUNT" ? "Ưu đãi" : "Quà tặng"}</StatusText>
      </div>
      <p className="mt-3 text-sm muted">
        {voucher.type === "DISCOUNT" && voucher.discountAmount
          ? `Giảm ${money(voucher.discountAmount)}`
          : voucher.rewardDescription}
      </p>
      <p className="mt-5 text-sm font-bold">{voucher.pointsCost.toLocaleString("vi-VN")} điểm</p>
    </Card>
  );
}

function OwnedVoucherCard({ voucher }: { voucher: MemberVoucherDto }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold">{voucher.title}</h3>
        <StatusText tone={voucher.status === "FULFILLED" || voucher.status === "USED" ? "neutral" : "amber"}>
          {voucherStatusLabel(voucher.status)}
        </StatusText>
      </div>
      <p className="mt-3 text-sm muted">
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

function transactionTypeLabel(type: PointTransactionType) {
  if (type === "EARN") return "Tích điểm";
  if (type === "REDEEM_DISCOUNT") return "Đổi ưu đãi";
  return "Đổi quà";
}

function voucherStatusLabel(status: MemberVoucherDto["status"]) {
  if (status === "AVAILABLE") return "Còn hiệu lực";
  return status === "USED" ? "Đã sử dụng" : "Đã trao";
}

export function MemberLanding() {
  const [merchantId, setMerchantId] = useState("");
  const navigate = useNavigate();
  const { logout } = useAuthSession();
  const parsed = Number(merchantId);
  return (
    <main className="relative mx-auto grid min-h-dvh max-w-5xl items-center gap-8 px-4 py-12 sm:px-8 lg:grid-cols-2">
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full px-3 py-2 text-xs font-semibold text-[#54725a] hover:bg-[#edf4e9]"
        onClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      >
        Đăng xuất
      </button>
      <div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#24452f] sm:text-5xl">
          Mua sắm theo cửa hàng
        </h1>
        <p className="mt-4 text-sm leading-7 muted">Nhập mã cửa hàng để khám phá sản phẩm.</p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (Number.isInteger(parsed) && parsed > 0) navigate(`/member/${parsed}`);
          }}
        >
          <Input
            aria-label="Mã cửa hàng"
            type="number"
            min={1}
            step={1}
            required
            placeholder="Mã cửa hàng"
            value={merchantId}
            onChange={(event) => setMerchantId(event.target.value)}
          />
          <Button type="submit">
            Mở <ArrowRight size={16} />
          </Button>
        </form>
      </div>
      <div className="h-64">
        <MemberMascot mood="hello" />
      </div>
    </main>
  );
}

export const MemberDirectory = MemberLanding;
