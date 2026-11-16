import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, ShoppingCart, Storefront } from "@phosphor-icons/react";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductCategoryDto, ProductDto, ProductSortOption } from "../../api/commerce-types";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import { useResource } from "../../api/useResource";
import { Button, Card, EmptyState, Input, Select } from "../../components/ui";
import { money } from "../../lib/utils";

const commerceApi = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function StorefrontCatalogSection({
  slug,
  accent,
  categories,
  canAdd,
  onBuy,
}: {
  slug: string;
  accent: string;
  categories: { id: number; name: string }[];
  canAdd: (productId: number, availableQuantity?: number) => boolean;
  onBuy: (product: ProductDto) => void;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [sort, setSort] = useState<ProductSortOption>("newest");
  const [page, setPage] = useState(1);

  const resource = useResource(
    () =>
      commerceApi.listPublicStoreProducts(slug, {
        q: query || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        sort,
        page,
        limit: 9,
      }),
    [slug, query, categoryId, sort, page],
  );

  if (resource.loading && !resource.data) return null;
  if (resource.error && !resource.data) return null;

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination;
  const availableCategories: { id: number; name: string }[] =
    (resource.data?.categories as ProductCategoryDto[] | undefined)?.length
      ? resource.data!.categories
      : categories;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim());
    setPage(1);
  }

  return (
    <section aria-labelledby="section-storefront-catalog" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="section-storefront-catalog" className="text-xl font-extrabold text-[#20392a] sm:text-2xl">
            Tất cả sản phẩm
          </h2>
        </div>
        <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Input
              type="search"
              aria-label="Tìm sản phẩm trong cửa hàng"
              placeholder="Tìm sản phẩm hoặc SKU..."
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              className="w-52 pr-8"
            />
            <MagnifyingGlass
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7d70]"
            />
          </div>
          <Select
            aria-label="Lọc theo danh mục"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả danh mục</option>
            {availableCategories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sắp xếp sản phẩm"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ProductSortOption);
              setPage(1);
            }}
          >
            <option value="newest">Mới nhất</option>
            <option value="price_asc">Giá tăng dần</option>
            <option value="price_desc">Giá giảm dần</option>
            <option value="name_asc">Tên A-Z</option>
          </Select>
          <Button type="submit" size="sm" variant="outline">
            Tìm
          </Button>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description="Thử từ khóa khác hoặc chọn tất cả danh mục."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => {
              const imgSrc = resolveStorefrontAssetUrl(product.imageUrl);
              const available = product.inventory.availableQuantity;
              return (
                <Card key={product.id} className="flex flex-col overflow-hidden">
                  <Link to={`/s/${slug}/products/${product.id}`} className="block aspect-[4/3] bg-[#edf2e9]">
                    {imgSrc ? (
                      <img src={imgSrc} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-[#709275]">
                        <Storefront aria-hidden="true" size={36} />
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    {product.category && (
                      <span className="text-xs font-bold" style={{ color: accent }}>
                        {product.category.name}
                      </span>
                    )}
                    <h3 className="mt-1 font-extrabold text-[#294432] break-words">
                      <Link to={`/s/${slug}/products/${product.id}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </h3>
                    {product.description && (
                      <p className="mt-2 line-clamp-2 text-sm muted break-words">{product.description}</p>
                    )}
                    <p className="mt-auto pt-4 text-lg font-extrabold tabular-nums" style={{ color: accent }}>
                      {money(Number(product.price))}
                    </p>
                    <p className="mt-1 text-xs muted">Còn {available} sản phẩm</p>
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      style={{ backgroundColor: available > 0 ? accent : undefined }}
                      disabled={!canAdd(product.id, available)}
                      onClick={() => onBuy(product)}
                    >
                      <ShoppingCart aria-hidden="true" size={16} />
                      {available > 0 ? "Chọn mua" : "Hết hàng"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs muted">
                Trang {pagination.page} / {pagination.totalPages} ({pagination.totalItems} sản phẩm)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
