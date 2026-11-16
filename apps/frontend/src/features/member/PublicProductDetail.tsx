import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Storefront } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import { useResource } from "../../api/useResource";
import { Button, EmptyState, ErrorState, Input, LoadingState, StatusText } from "../../components/ui";
import { money } from "../../lib/utils";
import { useEnsureMembership } from "../customers/useEnsureMembership";
import { useStorefrontShell } from "../storefront/storefront-context";
import { useMemberCart } from "./useMemberCart";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function ProductDetailContent({ slug, product }: { slug: string; product: ProductDto }) {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const shell = useStorefrontShell();
  useEnsureMembership({ slug, enabled: !shell });
  const storageKey =
    user?.role === "MEMBER"
      ? `loyalty.member.cart.${user.id}.${product.merchantId}`
      : `loyalty.guest.cart.0.${product.merchantId}`;
  const fallbackCart = useMemberCart(storageKey, product.merchantId);
  const cart = shell?.cart ?? fallbackCart;
  const accent = shell?.accent ?? "#335e3d";
  const catalogBackPath = `/s/${encodeURIComponent(slug)}/products${location.search}`;

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
        ? [{ id: 0, url: product.imageUrl, altText: product.name, sortOrder: 0 }]
        : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState("");

  useEffect(() => {
    setActiveIndex(0);
    setQuantity(1);
    setAddedNotice("");
  }, [product.id]);

  const available = product.inventory?.availableQuantity ?? 0;
  const maxSelectable = Math.max(1, Math.min(99, available));
  const activeImage = gallery[activeIndex] ?? gallery[0] ?? null;

  function handleAddToCart() {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(`/s/${slug}/products/${product.id}`)}`);
      return;
    }
    if (user.role !== "MEMBER") {
      return;
    }
    const safeQuantity = Math.max(1, Math.min(maxSelectable, Math.floor(quantity || 1)));
    cart.addQuantity(product, safeQuantity);
    setAddedNotice(`Đã thêm ${safeQuantity} sản phẩm vào giỏ hàng.`);
  }

  const detailBody = (
    <div className="space-y-4">
      <Link
        to={catalogBackPath}
        className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline sm:text-sm"
        style={{ color: accent }}
      >
        <ArrowLeft aria-hidden="true" size={16} /> Quay lại danh sách sản phẩm
      </Link>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-[1.5rem] bg-[#edf2e9]">
            {activeImage ? (
              <img
                src={resolveStorefrontAssetUrl(activeImage.url) ?? activeImage.url}
                alt={activeImage.altText ?? product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-[#709275]">
                <Storefront aria-hidden="true" size={56} />
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Thư viện ảnh sản phẩm">
              {gallery.map((img, idx) => (
                <button
                  key={`${img.id}-${idx}`}
                  type="button"
                  aria-label={`Xem ảnh ${idx + 1}`}
                  aria-pressed={idx === activeIndex}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                    idx === activeIndex ? "border-[#335e3d]" : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                  style={idx === activeIndex ? { borderColor: accent } : undefined}
                >
                  <img
                    src={resolveStorefrontAssetUrl(img.url) ?? img.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <StatusText tone={available > 0 ? "green" : "amber"} className="w-fit">
              {available > 0 ? "Đang bán" : "Hết hàng"}
            </StatusText>
            {product.category && (
              <span
                className="rounded-full bg-[#edf4e9] px-3 py-1 text-xs font-semibold"
                style={{ color: accent }}
              >
                {product.category.name}
              </span>
            )}
            {product.sku && (
              <span className="font-mono text-xs muted">SKU: {product.sku}</span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-extrabold text-[#294432] break-words sm:mt-4 sm:text-4xl">
            {product.name}
          </h1>

          <p className="mt-2 text-xl font-extrabold tabular-nums sm:mt-4 sm:text-2xl" style={{ color: accent }}>
            {money(Number(product.price))}
          </p>

          <p className="mt-1.5 text-sm muted">Còn {available} sản phẩm</p>

          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#3f5345] break-words">
              {product.description}
            </p>
          )}

          {product.richDescription && (
            <div className="mt-4 rounded-2xl bg-[#f7f9f5] p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#55705b]">
                Chi tiết sản phẩm
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#3f5345] break-words">
                {product.richDescription}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-bold text-[#294432]">
              Số lượng
              <Input
                type="number"
                aria-label="Số lượng mua"
                min={1}
                max={maxSelectable}
                disabled={available <= 0}
                value={quantity}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setQuantity(Number.isFinite(parsed) ? parsed : 1);
                }}
                className="w-24"
              />
            </label>

            <Button
              type="button"
              disabled={available <= 0 || (user !== null && user.role !== "MEMBER")}
              style={available > 0 ? { backgroundColor: accent } : undefined}
              onClick={handleAddToCart}
            >
              <ShoppingCart aria-hidden="true" size={18} />
              {available > 0 ? "Thêm vào giỏ" : "Hết hàng"}
            </Button>
          </div>

          {user && user.role !== "MEMBER" && (
            <p className="mt-3 text-xs muted">
              Chỉ tài khoản Member mới có thể thêm sản phẩm vào giỏ hàng.
            </p>
          )}

          {addedNotice && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#e1f2df] p-3 text-sm text-[#357044]"
            >
              <span>{addedNotice}</span>
              <Link
                to={`/s/${encodeURIComponent(slug)}/cart`}
                className="font-bold underline"
              >
                Xem giỏ hàng
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (shell) {
    return detailBody;
  }

  return (
    <div className="min-h-dvh bg-[#fcfcf8]">
      <header className="sticky top-0 z-20 border-b border-[#e5ece3] bg-[#fcfcf8]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-7">
          <Link
            to={`/s/${encodeURIComponent(slug)}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#335e3d] hover:text-[#24452f]"
          >
            <ArrowLeft aria-hidden="true" size={16} /> Về cửa hàng
          </Link>
          <div className="flex items-center gap-3">
            {user?.role === "MEMBER" ? (
              <Link
                to={`/s/${encodeURIComponent(slug)}/cart`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f1e2] px-3.5 py-2 text-xs font-bold text-[#335e3d]"
              >
                <ShoppingCart size={16} />
                Giỏ hàng {cart.quantity > 0 ? `(${cart.quantity})` : ""}
              </Link>
            ) : !user ? (
              <Link
                to={`/login?returnTo=${encodeURIComponent(`/s/${slug}/products/${product.id}`)}`}
                className="rounded-full bg-[#335e3d] px-4 py-2 text-xs font-bold text-white"
              >
                Đăng nhập
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-10">{detailBody}</main>
    </div>
  );
}

export function PublicProductDetail() {
  const { slug = "", productId = "" } = useParams();
  const parsedId = Number(productId);
  const validParams = slug.trim().length > 0 && Number.isSafeInteger(parsedId) && parsedId >= 1;

  const resource = useResource(
    () =>
      validParams
        ? commerce.getPublicStoreProduct(slug, parsedId).then((res) => res.product)
        : Promise.reject(new Error("INVALID_INPUT")),
    [slug, parsedId, validParams],
  );

  if (!validParams) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message="Đường dẫn sản phẩm không hợp lệ." />
      </main>
    );
  }
  if (resource.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <LoadingState cards={1} />
      </main>
    );
  }
  if (resource.error || !resource.data) {
    const translated = translateApiError(resource.error ?? "");
    if (resource.error === "PRODUCT_NOT_FOUND" || resource.error === "MERCHANT_NOT_FOUND") {
      return (
        <main className="mx-auto max-w-4xl px-4 py-12">
          <EmptyState
            title="Không tìm thấy sản phẩm"
            description={translated}
            action={
              <Button asChild variant="outline">
                <Link to={`/s/${slug}`}>Về cửa hàng</Link>
              </Button>
            }
          />
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message={translated || "Không tải được sản phẩm."} retry={resource.reload} />
      </main>
    );
  }

  return <ProductDetailContent slug={slug} product={resource.data} />;
}
