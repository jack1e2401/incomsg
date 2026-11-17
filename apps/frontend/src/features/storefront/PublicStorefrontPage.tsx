import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Ticket, Wallet } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { createStorefrontClient } from "../../api/storefront-client";
import type { StorefrontProductDto } from "../../api/storefront-types";
import { useResource } from "../../api/useResource";
import { Card, ErrorState, LoadingState } from "../../components/ui";
import { useEnsureMembership } from "../customers/useEnsureMembership";
import { memberTierLabel } from "../member/MemberLoyaltyPolicyDialog";
import { useMemberCart } from "../member/useMemberCart";
import { ChallengeHeroCard } from "../challenges/ChallengeHeroCard";
import { StorefrontSectionRenderer } from "./StorefrontSections";
import { StorefrontStoreInfoCard } from "./StorefrontStoreInfoCard";
import { useStorefrontShell, type StorefrontShellData } from "./storefront-context";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const storefrontApi = createStorefrontClient(apiBase);
const commerceApi = createCommerceClient(apiBase);

export function PublicStorefrontPage() {
  const shell = useStorefrontShell();
  if (shell) {
    return (
      <StorefrontHomeContent
        data={shell.storefront}
        cart={shell.cart}
      />
    );
  }
  return <StandaloneStorefrontPage />;
}

function StandaloneStorefrontPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user, accessToken } = useAuthSession();

  const wantsDraftPreview =
    searchParams.get("preview") === "draft" && user?.role === "MERCHANT" && Boolean(accessToken);

  useEnsureMembership({ slug, enabled: !wantsDraftPreview });

  const resource = useResource<StorefrontShellData>(
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

  if (resource.loading) return <LoadingState cards={3} />;
  if (resource.error || !resource.data) {
    return (
      <ErrorState
        message={
          resource.error === "MERCHANT_NOT_FOUND"
            ? "Không tìm thấy cửa hàng hoặc cửa hàng đã tạm ngưng."
            : (resource.error ?? "Không tải được trang cửa hàng.")
        }
        retry={resource.reload}
      />
    );
  }

  const data = resource.data;
  const storageKey =
    user?.role === "MEMBER"
      ? `loyalty.member.cart.${user.id}.${data.merchant.id}`
      : `loyalty.guest.cart.${data.merchant.id}`;

  return <StandaloneCartBridge key={storageKey} storageKey={storageKey} data={data} />;
}

function StandaloneCartBridge({ storageKey, data }: { storageKey: string; data: StorefrontShellData }) {
  const cart = useMemberCart(storageKey, data.merchant.id);
  return <StorefrontHomeContent data={data} cart={cart} />;
}

function StorefrontHomeContent({
  data,
  cart,
}: {
  data: StorefrontShellData;
  cart: ReturnType<typeof useMemberCart>;
}) {
  const { user, accessToken } = useAuthSession();
  const navigate = useNavigate();
  const fallbackProducts = useResource(
    async () => {
      if (data.featuredProducts.length > 0) return [];
      const res = await commerceApi.listPublicProducts(data.merchant.id, { limit: 6, sort: "newest" });
      return res.items.map(
        (product): StorefrontProductDto => ({
          id: product.id,
          merchantId: product.merchantId,
          categoryId: product.categoryId,
          category: product.category,
          sku: product.sku,
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
    [data],
  );

  const memberWallet = useResource(
    () =>
      user?.role === "MEMBER" && accessToken && !data.isDraftPreview
        ? commerceApi.getMemberWallet(data.merchant.id, accessToken).then((res) => res.wallet)
        : Promise.resolve(null),
    [user?.role, accessToken, data.merchant.id, data.isDraftPreview],
  );

  const displayProducts =
    (data.featuredProducts.length > 0 ? data.featuredProducts : (fallbackProducts.data ?? [])).slice(0, 6);
  const enabledSections = useMemo(
    () => [...data.config.sections].filter((s) => s.enabled).sort((a, b) => a.order - b.order),
    [data.config.sections],
  );

  const storeBase = `/s/${data.merchant.slug}`;
  const accent = data.config.branding.primaryColor || "#335e3d";

  function handleBuy(product: ProductDto) {
    if (!user || user.role !== "MEMBER") {
      navigate(`/login?returnTo=${encodeURIComponent(storeBase)}`);
      return;
    }
    cart.addProduct(product);
  }

  const bodySections = enabledSections.filter((s) => s.key !== "footer" && s.key !== "store_info");

  return (
    <div className="space-y-6 sm:space-y-8">
      {bodySections.map((section) => (
        <div key={section.key} className="space-y-4">
          <StorefrontSectionRenderer
            section={section}
            merchant={data.merchant}
            branding={data.config.branding}
            products={displayProducts}
            categories={data.categories}
            events={data.upcomingEvents}
            canAdd={(productId, available) =>
              user?.role === "MEMBER" ? cart.canAdd(productId, available) : (available ?? 0) > 0
            }
            onBuy={handleBuy}
          />

          {section.key === "hero" && !data.isDraftPreview && (
            <ChallengeHeroCard slug={data.merchant.slug} storeBase={storeBase} />
          )}

          {section.key === "hero" && memberWallet.data && (
            <Card className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#5d6f62]">
                  {memberWallet.data.tier === "UNRANKED"
                    ? "Thành viên mới"
                    : `Thành viên ${memberTierLabel[memberWallet.data.tier]}`}
                </p>
                <p className="text-sm font-extrabold text-[#20392a] tabular-nums">
                  {memberWallet.data.availablePoints.toLocaleString("vi-VN")} điểm khả dụng
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={`${storeBase}/vouchers`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#edf4e9] px-3 py-1.5 text-xs font-bold"
                  style={{ color: accent }}
                >
                  <Ticket size={14} aria-hidden="true" /> Ưu đãi
                </Link>
                <Link
                  to={`${storeBase}/wallet`}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  <Wallet size={14} aria-hidden="true" /> Ví điểm
                </Link>
              </div>
            </Card>
          )}
        </div>
      ))}

      <StorefrontStoreInfoCard merchant={data.merchant} branding={data.config.branding} />
    </div>
  );
}
