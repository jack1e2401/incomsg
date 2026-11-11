import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ImageSquare,
  Minus,
  Plus,
  ShoppingCart,
  Ticket,
  Trash,
} from "@phosphor-icons/react";
import { useApi } from "../../api/client";
import { useResource } from "../../api/useResource";
import type { Product } from "../../api/types";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
} from "../../components/ui";
import { money } from "../../lib/utils";
import type { MemberOutlet } from "../../layouts/MemberLayout";
import { MemberMascot } from "./MemberMascot";

function ProductCard({ product, add }: { product: Product; add: () => void }) {
  return (
    <Card className="card-hover group overflow-hidden">
      <Link to={`product/${product.id}`} className="block aspect-[1.16] overflow-hidden bg-[#edf2e9]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#9dad99]">
            <ImageSquare size={34} weight="light" aria-hidden="true" />
          </div>
        )}
      </Link>
      <div className="p-5">
        <p className="text-[11px] font-semibold text-[#6b826b]">{product.category}</p>
        <Link
          to={`product/${product.id}`}
          className="mt-2 block text-base font-extrabold text-[#294432] hover:text-[#5b8059]"
        >
          {product.name}
        </Link>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 muted">{product.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-[#315f3d]">{money(product.price)}</span>
          <Button size="icon" aria-label={`Thêm ${product.name} vào giỏ`} onClick={add}>
            <Plus size={18} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function MemberStorefront() {
  const { merchant, addToCart, cart } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const products = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const wallet = useResource(() => api.getWallet(merchant.id), [merchant.id]);
  const [category, setCategory] = useState("Tất cả");
  useEffect(() => {
    setCategory("Tất cả");
  }, [merchant.id]);
  const active = products.data?.filter((p) => p.active) ?? [];
  const categories = ["Tất cả", ...new Set(active.map((p) => p.category))];
  const visible = category === "Tất cả" ? active : active.filter((p) => p.category === category);
  return (
    <>
      <section className="member-gradient relative overflow-hidden rounded-[2rem] px-6 py-9 sm:px-10 sm:py-12 lg:min-h-[330px]">
        <div className="relative z-1 max-w-[630px]">
          <p className="text-xs font-semibold tracking-wide text-[#527b56]">{merchant.category}</p>
          <h1 className="serif mt-5 max-w-[580px] text-[2.6rem] leading-[1.05] tracking-[-.045em] text-[#2b4f36] sm:text-[3.4rem]">
            {merchant.tagline}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#657b69]">{merchant.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href="#products">
                Khám phá sản phẩm <ArrowRight size={17} />
              </a>
            </Button>
            <Button asChild variant="outline" className="bg-white/60">
              <Link to={`/member/${merchant.id}/wallet`}>
                {wallet.loading ? "Đang tải điểm..." : `${wallet.data?.availablePoints ?? 0} điểm của bạn`}
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-10 right-[-2rem] hidden h-[300px] w-[350px] lg:block">
          <MemberMascot mood="hello" />
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 h-70 w-70 rounded-full bg-white/25 blur-3xl" />
      </section>
      <section id="products" className="scroll-mt-28 pt-11">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#8ab182]">
              Danh mục chọn lọc
            </p>
            <h2 className="serif mt-2 text-3xl text-[#294432] sm:text-4xl">Sản phẩm dành cho bạn</h2>
          </div>
          <Link to="cart" className="flex items-center gap-2 text-xs font-bold accent">
            <ShoppingCart size={17} /> Giỏ hàng ({cart.reduce((n, i) => n + i.quantity, 0)}){" "}
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${category === c ? "bg-[#335e3d] text-white" : "bg-[#edf3e9] text-[#66806a] hover:bg-[#dfeedd]"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {products.loading ? (
          <LoadingState />
        ) : products.error ? (
          <ErrorState message={products.error} retry={products.reload} />
        ) : !visible.length ? (
          <EmptyState title="Chưa có sản phẩm" description="Hãy thử danh mục khác hoặc quay lại sau." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} add={() => addToCart(p.id)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function MemberProduct() {
  const { productId } = useParams();
  const { merchant, addToCart } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const resource = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const product = resource.data?.find((p) => p.id === productId && p.active);
  return (
    <>
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !product ? (
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm có thể đã được ẩn hoặc thuộc cửa hàng khác."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div>
          <Link
            to={`/member/${merchant.id}`}
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold accent"
          >
            <ArrowLeft size={15} /> Quay lại gian hàng
          </Link>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-[2rem] bg-[#edf2e9]">
              {product.image && (
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold text-[#527b56]">{product.category}</p>
              <h1 className="serif mt-5 text-4xl leading-tight text-[#294432] sm:text-5xl">{product.name}</h1>
              <p className="mt-4 text-2xl font-extrabold accent">{money(product.price)}</p>
              <p className="mt-7 text-sm leading-8 muted">{product.description}</p>
              <p className="mt-5 text-xs muted">Còn {product.stock} sản phẩm</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" disabled={product.stock < 1} onClick={() => addToCart(product.id)}>
                  <ShoppingCart size={18} /> Thêm vào giỏ
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to={`/member/${merchant.id}/cart`}>
                    Xem giỏ hàng <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MemberCart() {
  const { merchant, cart, setQuantity } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const resource = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const items = cart
    .map((i) => ({ ...i, product: resource.data?.find((p) => p.id === i.productId) }))
    .filter((i) => i.product);
  const subtotal = items.reduce((n, i) => n + (i.product?.price ?? 0) * i.quantity, 0);
  return (
    <>
      <PageHeader title={`Giỏ hàng · ${merchant.name}`} />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !items.length ? (
        <EmptyState
          title="Giỏ hàng đang trống"
          description="Chọn vài món bạn thích để bắt đầu."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>
                Khám phá sản phẩm <ArrowRight size={16} />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_.7fr]">
          <Card className="divide-y divide-[#edf1ea] p-4 sm:p-6">
            {items.map(
              ({ product, quantity, productId }) =>
                product && (
                  <div key={productId} className="flex gap-4 py-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#edf2e9] sm:h-24 sm:w-24">
                      {product.image && (
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold muted">{product.category}</p>
                      <h2 className="mt-1 text-sm font-extrabold">{product.name}</h2>
                      <p className="mt-2 text-sm font-bold accent">{money(product.price)}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center rounded-full bg-[#f0f4ed]">
                          <button
                            aria-label="Giảm số lượng"
                            className="p-2"
                            onClick={() => setQuantity(productId, quantity - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-5 text-center text-xs font-bold">{quantity}</span>
                          <button
                            aria-label="Tăng số lượng"
                            className="p-2"
                            disabled={quantity >= product.stock}
                            onClick={() => setQuantity(productId, quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          aria-label="Xóa sản phẩm"
                          onClick={() => setQuantity(productId, 0)}
                          className="text-[#a87870]"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold">{money(product.price * quantity)}</p>
                  </div>
                ),
            )}
          </Card>
          <Card className="h-fit p-6">
            <h2 className="text-lg font-extrabold">Tóm tắt giỏ hàng</h2>
            <div className="mt-5 flex justify-between text-sm">
              <span className="muted">Tạm tính</span>
              <span className="font-bold">{money(subtotal)}</span>
            </div>
            <div className="mt-5 border-t border-[#edf1ea] pt-5">
              <Button asChild className="w-full">
                <Link to={`/member/${merchant.id}/checkout`}>
                  Tiếp tục thanh toán <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export function MemberCheckout() {
  const { merchant, cart, clearCart } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const navigate = useNavigate();
  const products = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const vouchers = useResource(() => api.listMemberVouchers(merchant.id), [merchant.id]);
  const [voucherId, setVoucherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = cart
    .map((i) => ({ ...i, product: products.data?.find((p) => p.id === i.productId) }))
    .filter((i) => i.product);
  async function submit() {
    if (busy || !items.length) return;
    setBusy(true);
    setError("");
    try {
      const order = await api.createOrder({
        merchantId: merchant.id,
        items: cart,
        voucherId: voucherId || undefined,
      });
      clearCart();
      navigate(`/member/${merchant.id}/orders/${order.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo đơn hàng");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Xác nhận đơn hàng" />
      {products.loading || vouchers.loading ? (
        <LoadingState cards={2} />
      ) : products.error || vouchers.error ? (
        <ErrorState
          message={products.error ?? vouchers.error ?? "Lỗi tải checkout"}
          retry={() => {
            products.reload();
            vouchers.reload();
          }}
        />
      ) : !items.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Giỏ hàng trống hoặc sản phẩm không còn khả dụng."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f1e2] accent">
                  <ShoppingCart size={20} />
                </span>
                <div>
                  <h2 className="font-extrabold">Sản phẩm</h2>
                  <p className="text-xs muted">{merchant.name}</p>
                </div>
              </div>
              <div className="mt-5 divide-y divide-[#edf1ea]">
                {items.map((i) => (
                  <div key={i.productId} className="flex justify-between gap-3 py-3 text-sm">
                    <span>
                      {i.product?.name} × {i.quantity}
                    </span>
                    <span className="font-bold">{money((i.product?.price ?? 0) * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff1dc] text-[#ab7a3e]">
                  <Ticket size={20} />
                </span>
                <h2 className="font-extrabold">Voucher giảm giá</h2>
              </div>
              <Select
                aria-label="Chọn voucher"
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
              >
                <option value="">Không dùng voucher</option>
                {vouchers.data
                  ?.filter((v) => v.kind === "DISCOUNT" && v.status === "AVAILABLE")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
              </Select>
              <p className="mt-3 text-xs leading-5 muted">Chỉ dùng voucher tại {merchant.name}.</p>
            </Card>
          </div>
          <Card className="h-fit p-6">
            <h2 className="text-lg font-extrabold">Đơn hàng của bạn</h2>
            <div className="mt-5 flex justify-between text-sm">
              <span className="muted">Tạm tính</span>
              <span className="font-bold">
                {money(items.reduce((n, i) => n + (i.product?.price ?? 0) * i.quantity, 0))}
              </span>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-[#fae7e3] p-3 text-xs text-[#a4473a]">
                {error}
              </p>
            )}
            <Button className="mt-5 w-full" disabled={busy} onClick={submit}>
              {busy ? (
                <BusyLabel>Đang tạo đơn</BusyLabel>
              ) : (
                <>
                  Tạo đơn <ArrowRight size={16} />
                </>
              )}
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
