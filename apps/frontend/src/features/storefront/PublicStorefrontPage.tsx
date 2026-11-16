import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ShoppingCart, SignIn, Storefront, Ticket, Wallet, Receipt } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { createStorefrontClient, resolveStorefrontAssetUrl } from "../../api/storefront-client";
import type {
  StorefrontCategoryDto,
  StorefrontConfig,
  StorefrontEventDto,
  StorefrontMerchantSummaryDto,
  StorefrontProductDto,
} from "../../api/storefront-types";
import { useResource } from "../../api/useResource";
import { Button, ErrorState, LoadingState } from "../../components/ui";
import { useMemberCart } from "../member/useMemberCart";
import { StorefrontSectionRenderer } from "./StorefrontSections";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const storefrontApi = createStorefrontClient(apiBase);
const commerceApi = createCommerceClient(apiBase);

interface LoadedStorefront {
  merchant: StorefrontMerchantSummaryDto;
  config: StorefrontConfig;
  featuredProducts: StorefrontProductDto[];
  categories: StorefrontCategoryDto[];
  upcomingEvents: StorefrontEventDto[];
  isDraftPreview: boolean;
}

export function PublicStorefrontPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user, accessToken } = useAuthSession();

  const wantsDraftPreview =
    searchParams.get("preview") === "draft" && user?.role === "MERCHANT" && Boolean(accessToken);

  const resource = useResource<LoadedStorefront>(
    async () => {
      if (wantsDraftPreview && accessToken) {
        const preview = await storefrontApi.getPreview(accessToken);
        if (preview.merchant.slug === slug) {
          return {
            merchant: preview.merchant,
            config: preview.config,
            featuredProducts: preview.featuredProducts,
            categories: preview.categories,
            upcomingEvents: preview.upcomingEvents,
            isDraftPreview: true,
          };
        }
      }

      const pub = await storefrontApi.getPublicStorefront(slug);
      return {
        merchant: pub.merchant,
        config: pub.config,
        featuredProducts: pub.featuredProducts,
        categories: pub.categories,
        upcomingEvents: pub.upcomingEvents,
        isDraftPreview: false,
      };
    },
    [slug, wantsDraftPreview, accessToken],
  );

  const fallbackProducts = useResource(
    async () => {
      if (!resource.data) return [];
      if (
        resource.data.featuredProducts.length > 0 ||
        resource.data.config.featuredProductIds.length > 0
      ) {
        return [];
      }
      const res = await commerceApi.listPublicProducts(resource.data.merchant.id);
      return res.products.map(
        (product): StorefrontProductDto => ({
          id: product.id,
          merchantId: product.merchantId,
          categoryId: null,
          category: null,
          sku: null,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          kind: product.kind,
          status: product.status,
          price: product.price,
          inventory: { availableQuantity: product.inventory.availableQuantity },
        }),
      );
    },
    [resource.data],
  );

  if (resource.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-7">
        <LoadingState cards={3} />
      </main>
    );
  }

  if (resource.error || !resource.data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-7">
        <ErrorState
          message={
            resource.error === "MERCHANT_NOT_FOUND"
              ? "Không tìm thấy cửa hàng hoặc cửa hàng đã tạm ngưng."
              : (resource.error ?? "Không tải được trang cửa hàng.")
          }
          retry={resource.reload}
        />
      </main>
    );
  }

  const data = resource.data;
  const displayProducts =
    data.featuredProducts.length > 0 ? data.featuredProducts : (fallbackProducts.data ?? []);
  const storageKey =
    user?.role === "MEMBER"
      ? `loyalty.member.cart.${user.id}.${data.merchant.id}`
      : `loyalty.guest.cart.${data.merchant.id}`;

  return (
    <StorefrontShell
      key={storageKey}
      storageKey={storageKey}
      data={data}
      products={displayProducts}
    />
  );
}

function StorefrontShell({
  storageKey,
  data,
  products,
}: {
  storageKey: string;
  data: LoadedStorefront;
  products: StorefrontProductDto[];
}) {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const cart = useMemberCart(storageKey, data.merchant.id);

  const logoSrc = resolveStorefrontAssetUrl(data.config.branding.logoUrl);
  const enabledSections = useMemo(
    () => [...data.config.sections].filter((s) => s.enabled).sort((a, b) => a.order - b.order),
    [data.config.sections],
  );

  const storeBase = `/s/${data.merchant.slug}`;

  function handleBuy(product: ProductDto) {
    if (!user || user.role !== "MEMBER") {
      navigate(`/login?returnTo=${encodeURIComponent(storeBase)}`);
      return;
    }
    cart.addProduct(product);
  }

  return (
    <div className="min-h-dvh bg-[#fcfcf8]">
      {data.isDraftPreview && (
        <div
          role="status"
          className="border-b border-[#e5d8b8] bg-[#fff4df] px-4 py-2.5 text-center text-xs font-semibold text-[#7a5a26]"
        >
          Đang xem trước bản nháp — chưa xuất bản.{" "}
          <Link to="/merchant/storefront" className="font-bold underline">
            Quay lại trình chỉnh sửa
          </Link>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#e5ece3] bg-[#fcfcf8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-7">
          <Link to={storeBase} className="flex min-w-0 items-center gap-2.5">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={data.merchant.name}
                className="h-9 w-9 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf4e9] text-[#335e3d]">
                <Storefront aria-hidden="true" size={20} />
              </span>
            )}
            <span className="truncate text-base font-extrabold tracking-tight text-[#24452f]">
              {data.merchant.name}
            </span>
          </Link>

          <nav aria-label="Điều hướng cửa hàng" className="flex items-center gap-1 sm:gap-2">
            {user?.role === "MEMBER" ? (
              <>
                <Link
                  to={`${storeBase}/wallet`}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-[#53685a] hover:bg-[#edf4e9]"
                >
                  <Wallet aria-hidden="true" size={16} />
                  <span className="hidden sm:inline">Ví điểm</span>
                </Link>
                <Link
                  to={`${storeBase}/vouchers`}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-[#53685a] hover:bg-[#edf4e9]"
                >
                  <Ticket aria-hidden="true" size={16} />
                  <span className="hidden sm:inline">Voucher</span>
                </Link>
                <Link
                  to={`${storeBase}/orders`}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-[#53685a] hover:bg-[#edf4e9]"
                >
                  <Receipt aria-hidden="true" size={16} />
                  <span className="hidden sm:inline">Đơn hàng</span>
                </Link>
                <Link
                  to={`${storeBase}/cart`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#edf4e9] px-3 py-2 text-xs font-bold text-[#335e3d]"
                >
                  <ShoppingCart aria-hidden="true" size={16} />
                  <span>Giỏ hàng</span>
                  {cart.quantity > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#335e3d] px-1 text-[10px] text-white tabular-nums">
                      {cart.quantity}
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link to={`/login?returnTo=${encodeURIComponent(storeBase)}`}>
                  <SignIn aria-hidden="true" size={15} /> Đăng nhập
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-7 lg:py-10">
        {enabledSections.map((section) => (
          <StorefrontSectionRenderer
            key={section.key}
            section={section}
            merchant={data.merchant}
            branding={data.config.branding}
            products={products}
            categories={data.categories}
            events={data.upcomingEvents}
            canAdd={(productId, available) =>
              user?.role === "MEMBER" ? cart.canAdd(productId, available) : (available ?? 0) > 0
            }
            onBuy={handleBuy}
          />
        ))}
      </main>
    </div>
  );
}
