import { Link } from "react-router-dom";
import { Plus, ShoppingCart, Storefront } from "@phosphor-icons/react";
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
        className="group relative block aspect-square overflow-hidden rounded-xl bg-[#f6f0e7] p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] sm:p-2"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full rounded-lg bg-white object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center rounded-lg bg-white text-[#709275]">
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

        <div className="mt-auto pt-2.5">
          <div className="flex items-center justify-between gap-1.5">
            <p className="min-w-0 truncate text-sm font-extrabold tabular-nums sm:text-base" style={{ color: accent }}>
              {money(Number(product.price))}
            </p>
            <button
              type="button"
              disabled={!canAdd}
              aria-label={`Thêm ${product.name} vào giỏ`}
              onClick={() => onAdd(toCartProduct(product))}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-sm transition hover:scale-[1.04] hover:shadow-md disabled:cursor-not-allowed disabled:bg-[#cfd8cf] disabled:text-[#6f7b70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] focus-visible:ring-offset-2"
              style={canAdd ? { backgroundColor: accent } : undefined}
            >
              <ShoppingCart aria-hidden="true" size={19} weight="bold" />
              <span className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#d8eea8] text-[#24452f] ring-2 ring-white">
                <Plus aria-hidden="true" size={9} weight="bold" />
              </span>
            </button>
          </div>
          <p className={`mt-1 min-h-4 whitespace-nowrap text-[10px] font-medium leading-4 ${stockDisplay.textClass}`}>
            {stockDisplay.label}
          </p>
        </div>
      </div>
    </article>
  );
}
