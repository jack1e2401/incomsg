import { useEffect, useState, type FormEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductCategoryDto, ProductDto, ProductSortOption } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { Button, EmptyState, Input, Select } from "../../components/ui";
import { StorefrontProductCard } from "./StorefrontProductCard";

const commerceApi = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function StorefrontCatalogSection({
  slug,
  accent,
  categories,
  canAdd,
  onBuy,
  selectedCategoryId,
  onCategoryChange,
  initialQuery = "",
  initialSort = "newest",
  initialPage = 1,
  onStateChange,
  limit = 8,
  title = "Thực đơn & Sản phẩm",
}: {
  slug: string;
  accent: string;
  categories: { id: number; name: string }[];
  canAdd: (productId: number, availableQuantity?: number) => boolean;
  onBuy: (product: ProductDto) => void;
  selectedCategoryId?: number | null;
  onCategoryChange?: (categoryId: number | null) => void;
  initialQuery?: string;
  initialSort?: ProductSortOption;
  initialPage?: number;
  onStateChange?: (next: { q: string; categoryId: number | null; sort: ProductSortOption; page: number }) => void;
  limit?: number;
  title?: string;
}) {
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [internalCatId, setInternalCatId] = useState<number | null>(selectedCategoryId ?? null);
  const [sort, setSort] = useState<ProductSortOption>(initialSort);
  const [page, setPage] = useState(initialPage);

  const activeCategoryId = selectedCategoryId !== undefined ? selectedCategoryId : internalCatId;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = draftQuery.trim();
      if (trimmed !== query) {
        setQuery(trimmed);
        setPage(1);
        onStateChange?.({ q: trimmed, categoryId: activeCategoryId ?? null, sort, page: 1 });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftQuery, query, activeCategoryId, sort, onStateChange]);

  const resource = useResource(
    () =>
      commerceApi.listPublicStoreProducts(slug, {
        q: query || undefined,
        categoryId: activeCategoryId ?? undefined,
        sort,
        page,
        limit,
      }),
    [slug, query, activeCategoryId, sort, page, limit],
  );

  if (resource.loading && !resource.data) return null;
  if (resource.error && !resource.data) return null;

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination;
  const availableCategories: { id: number; name: string }[] =
    (resource.data?.categories as ProductCategoryDto[] | undefined)?.length
      ? resource.data!.categories
      : categories;

  function chooseCategory(nextId: number | null) {
    if (onCategoryChange) {
      onCategoryChange(nextId);
    } else {
      setInternalCatId(nextId);
    }
    setPage(1);
    onStateChange?.({ q: query, categoryId: nextId, sort, page: 1 });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftQuery.trim();
    setQuery(trimmed);
    setPage(1);
    onStateChange?.({ q: trimmed, categoryId: activeCategoryId ?? null, sort, page: 1 });
  }

  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (activeCategoryId) returnParams.set("categoryId", String(activeCategoryId));
  if (sort !== "newest") returnParams.set("sort", sort);
  if (page > 1) returnParams.set("page", String(page));
  const returnSearch = returnParams.size ? `?${returnParams.toString()}` : "";

  return (
    <section id="storefront-catalog" aria-labelledby="section-storefront-catalog" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="section-storefront-catalog" className="text-base font-extrabold text-[#20392a] sm:text-xl">
          {title}
        </h2>
        {pagination && (
          <span className="text-xs font-semibold text-[#647569] tabular-nums">
            {pagination.totalItems} sản phẩm
          </span>
        )}
      </div>

      {/* Compact single-row search + sort */}
      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7d70]"
          />
          <Input
            type="search"
            aria-label="Tìm đồ uống, sản phẩm"
            placeholder="Tìm đồ uống, sản phẩm..."
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            className="h-10 w-full rounded-full pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          aria-label="Sắp xếp sản phẩm"
          value={sort}
          onChange={(event) => {
            const nextSort = event.target.value as ProductSortOption;
            setSort(nextSort);
            setPage(1);
            onStateChange?.({ q: query, categoryId: activeCategoryId ?? null, sort: nextSort, page: 1 });
          }}
          className="h-10 w-32 shrink-0 rounded-full text-xs sm:w-40"
        >
          <option value="newest">Mới nhất</option>
          <option value="price_asc">Giá thấp → cao</option>
          <option value="price_desc">Giá cao → thấp</option>
          <option value="name_asc">Tên A–Z</option>
        </Select>
      </form>

      {/* Horizontal scrollable category chips */}
      {availableCategories.length > 0 && (
        <div
          role="tablist"
          aria-label="Danh mục sản phẩm"
          className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryId === null}
            onClick={() => chooseCategory(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              activeCategoryId === null
                ? "text-white shadow-sm"
                : "border border-[#dce6da] bg-white text-[#4c6052] hover:bg-[#edf4e9]"
            }`}
            style={activeCategoryId === null ? { backgroundColor: accent } : undefined}
          >
            Tất cả
          </button>
          {availableCategories.map((cat) => {
            const active = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => chooseCategory(cat.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "text-white shadow-sm"
                    : "border border-[#dce6da] bg-white text-[#4c6052] hover:bg-[#edf4e9]"
                }`}
                style={active ? { backgroundColor: accent } : undefined}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description="Thử từ khóa khác hoặc chọn danh mục Tất cả."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((product) => (
              <StorefrontProductCard
                key={product.id}
                slug={slug}
                product={product}
                accent={accent}
                canAdd={canAdd(product.id, product.inventory.availableQuantity)}
                onAdd={onBuy}
                returnSearch={returnSearch}
              />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[#647569]">
                Trang {pagination.page} / {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => {
                    const nextPage = Math.max(1, page - 1);
                    setPage(nextPage);
                    onStateChange?.({ q: query, categoryId: activeCategoryId ?? null, sort, page: nextPage });
                  }}
                >
                  Trước
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    onStateChange?.({ q: query, categoryId: activeCategoryId ?? null, sort, page: nextPage });
                  }}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
