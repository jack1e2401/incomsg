import { Link } from "react-router-dom";
import { Plus, Storefront } from "@phosphor-icons/react";
import type { ProductDto } from "../../api/commerce-types";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import type { StorefrontProductDto } from "../../api/storefront-types";
import { money } from "../../lib/utils";
import { productStockDisplay } from "./storefront-stock";

type CardProduct = StorefrontProductDto | ProductDto;

function toCartProduct(product: CardProduct): ProductDto {
  if ("richDescription" in product) return product;
  return {
    id: product.id,
    merchantId: product.merchantId,
    categoryId: product.categoryId ?? null,
    category: product.category ?? null,
    sku: product.sku ?? null,
    name: product.name,
    description: product.description ?? null,
    richDescription: null,
    imageUrl: product.imageUrl ?? null,
    images: [],
    lowStockThreshold: 5,
    isLowStock: false,
    kind: product.kind,
    price: product.price,
    status: product.status,
    inventory: product.inventory,
  };
}

export function StorefrontProductCard({
  slug,
  product,
  accent,
  canAdd,
  onAdd,
  returnSearch = "",
}: {
  slug: string;
  product: CardProduct;
  accent: string;
  canAdd: boolean;
  onAdd: (product: ProductDto) => void;
  returnSearch?: string;
}) {
  const imgSrc = resolveStorefrontAssetUrl(product.imageUrl);
  const available = product.inventory.availableQuantity;
  const stockDisplay = productStockDisplay(available);
  const detailPath = `/s/${encodeURIComponent(slug)}/products/${product.id}${returnSearch}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#e6ece3] bg-white p-2.5 shadow-[0_4px_14px_rgba(36,69,47,0.04)] transition hover:border-[#c9dac4] sm:p-3">
      <Link
        to={detailPath}
        className="group relative block aspect-square overflow-hidden rounded-xl bg-[#edf2e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#709275]">
            <Storefront aria-hidden="true" size={32} weight="light" />
          </div>
        )}
      </Link>

      <div className="mt-2.5 flex flex-1 flex-col">
        {product.category && (
          <span className="truncate text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
            {product.category.name}
          </span>
        )}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[13px] font-bold leading-snug text-[#20392a] sm:text-sm">
          <Link to={detailPath} className="hover:underline">
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-center justify-between gap-1.5 pt-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tabular-nums sm:text-base" style={{ color: accent }}>
              {money(Number(product.price))}
            </p>
            <p className={`inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold ${stockDisplay.badgeClass}`}>
              {stockDisplay.label}
            </p>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            aria-label={`Thêm ${product.name} vào giỏ`}
            onClick={() => onAdd(toCartProduct(product))}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#cfd8cf] disabled:text-[#6f7b70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
            style={canAdd ? { backgroundColor: accent } : undefined}
          >
            <Plus aria-hidden="true" size={13} weight="bold" />
            <span>Thêm</span>
          </button>
        </div>
      </div>
    </article>
  );
}
