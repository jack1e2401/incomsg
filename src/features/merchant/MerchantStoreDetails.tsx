import { useState } from "react";
import { ArrowUpRight, Package, Storefront } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto, TierLevel } from "../../api/commerce-types";
import type { BackendMerchantDto } from "../../api/contracts/milestone2";
import { useResource } from "../../api/useResource";
import { Button, Card, Skeleton, StatusText } from "../../components/ui";
import { money, number } from "../../lib/utils";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const tierName: Record<TierLevel, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export function MerchantStoreDetails({ merchant, token }: { merchant: BackendMerchantDto; token: string }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.5fr)]">
      <div className="grid min-w-0 gap-5">
        <Card className="border-[#284c35] bg-[#284c35] p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#d9edc8]">
              <Storefront aria-hidden="true" size={23} weight="light" />
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9edc8]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {merchant.isActive ? "Hoạt động" : "Không hoạt động"}
            </span>
          </div>
          <h2 className="serif mt-5 break-words text-3xl leading-tight">{merchant.name}</h2>
          <p className="mt-2 text-sm text-white/75">Mã cửa hàng #{merchant.id}</p>
        </Card>
        <MerchantLoyaltySummary token={token} />
      </div>
      <MerchantCatalogPreview merchantId={merchant.id} />
    </div>
  );
}

function MerchantLoyaltySummary({ token }: { token: string }) {
  const loyalty = useResource(() => api.getLoyaltyConfig(token).then(({ config }) => config), [token]);
  const config = loyalty.data;

  return (
    <Card role="region" aria-labelledby="store-loyalty-title" className="min-w-0 p-5 sm:p-6">
      <h2 id="store-loyalty-title" className="text-lg font-extrabold">
        Chương trình loyalty
      </h2>
      {loyalty.loading ? (
        <div role="status" className="mt-4">
          <span className="sr-only">Đang tải cấu hình loyalty</span>
          <Skeleton className="h-40 motion-reduce:animate-none" />
        </div>
      ) : loyalty.error ? (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-sm text-[#53685a]">
            Không tải được cấu hình loyalty.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={loyalty.reload}>
            Thử lại
          </Button>
        </div>
      ) : config ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#eef4e9] p-4">
            <div>
              <p className="text-xs font-semibold text-[#53685a]">Tỷ lệ quy đổi</p>
              <p className="mt-1 text-sm font-extrabold text-[#294833]">
                {money(config.vndPerPoint)} = 1 điểm
              </p>
            </div>
            <StatusText tone={config.isActive ? "green" : "amber"}>
              {config.isActive ? "Đang tích điểm" : "Tạm dừng"}
            </StatusText>
          </div>
          <ul className="mt-3 divide-y divide-[#e9ede6]" aria-label="Các hạng thành viên">
            {config.tiers.map((tier) => (
              <li
                key={tier.level}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-sm"
              >
                <span className="font-bold">{tierName[tier.level]}</span>
                <span className="text-[#53685a]">{number(tier.minLifetimePoints)} điểm</span>
                <span className="min-w-9 text-right font-bold text-[#406d47]">
                  {number(Number(tier.multiplier))}×
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link to="/merchant/loyalty">
          Chỉnh cấu hình loyalty <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </Button>
    </Card>
  );
}

function MerchantCatalogPreview({ merchantId }: { merchantId: number }) {
  const catalog = useResource(
    () => api.listPublicProducts(merchantId).then(({ products }) => products),
    [merchantId],
  );
  const products = catalog.data ?? [];

  return (
    <Card role="region" aria-labelledby="store-catalog-title" className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="store-catalog-title" className="text-lg font-extrabold">
            Gian hàng khách nhìn thấy
          </h2>
          {!catalog.loading && !catalog.error && products.length > 0 && (
            <p className="mt-1 text-sm text-[#53685a]">{number(products.length)} sản phẩm đang bán</p>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/merchant/products">
            Quản lý sản phẩm <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        </Button>
      </div>
      {catalog.loading ? (
        <div role="status" className="mt-5">
          <span className="sr-only">Đang tải gian hàng</span>
          <Skeleton className="h-40 motion-reduce:animate-none" />
        </div>
      ) : catalog.error ? (
        <div className="mt-5 space-y-3">
          <p role="alert" className="text-sm text-[#53685a]">
            Không tải được gian hàng.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={catalog.reload}>
            Thử lại
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-5 grid justify-items-center gap-3 rounded-2xl bg-[#f4f7f2] px-4 py-10 text-center">
          <Package aria-hidden="true" size={32} weight="light" className="text-[#66856d]" />
          <p className="text-sm font-semibold text-[#53685a]">Chưa có sản phẩm đang bán.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 min-[360px]:grid-cols-2 sm:gap-4">
          {products.slice(0, 4).map((product) => (
            <li key={product.id} className="min-w-0">
              <StoreProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StoreProductCard({ product }: { product: ProductDto }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);

  return (
    <div className="surface-soft h-full overflow-hidden rounded-2xl">
      <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-[#e8efe4]">
        {product.imageUrl && failedImage !== product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedImage(product.imageUrl)}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-14 place-items-center rounded-2xl bg-white/55 text-[#66856d] ring-1 ring-[#d8e5d4]">
            <Package aria-hidden="true" size={29} weight="light" />
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="break-words font-extrabold text-[#294833]">{product.name}</h3>
        <p className="mt-1 break-words text-sm font-semibold text-[#406d47]">
          {money(Number(product.price))}
        </p>
      </div>
    </div>
  );
}
