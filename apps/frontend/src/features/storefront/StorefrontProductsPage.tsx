import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import type { ProductDto, ProductSortOption } from "../../api/commerce-types";
import { StorefrontCatalogSection } from "./StorefrontCatalogSection";
import { useStorefrontShell } from "./storefront-context";

const VALID_SORTS: ProductSortOption[] = ["newest", "price_asc", "price_desc", "name_asc"];

export function StorefrontProductsPage() {
  const shell = useStorefrontShell();
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get("q") ?? "";
  const rawCat = searchParams.get("categoryId");
  const parsedCat = rawCat ? Number(rawCat) : null;
  const selectedCategoryId = parsedCat && Number.isInteger(parsedCat) && parsedCat > 0 ? parsedCat : null;
  const rawSort = searchParams.get("sort") as ProductSortOption | null;
  const initialSort: ProductSortOption = rawSort && VALID_SORTS.includes(rawSort) ? rawSort : "newest";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const initialPage = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const updateUrlState = useCallback(
    (next: { q: string; categoryId: number | null; sort: ProductSortOption; page: number }) => {
      const params = new URLSearchParams();
      if (next.q) params.set("q", next.q);
      if (next.categoryId) params.set("categoryId", String(next.categoryId));
      if (next.sort !== "newest") params.set("sort", next.sort);
      if (next.page > 1) params.set("page", String(next.page));
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  if (!shell) return null;

  const { storefront, accent, cart } = shell;
  const currentPath = `/s/${storefront.merchant.slug}/products${
    searchParams.size ? `?${searchParams.toString()}` : ""
  }`;

  function handleBuy(product: ProductDto) {
    if (!user || user.role !== "MEMBER") {
      navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    cart.addProduct(product);
  }

  return (
    <StorefrontCatalogSection
      slug={storefront.merchant.slug}
      accent={accent}
      categories={storefront.categories}
      canAdd={(productId, available) =>
        user?.role === "MEMBER" ? cart.canAdd(productId, available) : (available ?? 0) > 0
      }
      onBuy={handleBuy}
      selectedCategoryId={selectedCategoryId}
      onCategoryChange={(catId) =>
        updateUrlState({ q: initialQuery, categoryId: catId, sort: initialSort, page: 1 })
      }
      initialQuery={initialQuery}
      initialSort={initialSort}
      initialPage={initialPage}
      onStateChange={updateUrlState}
      limit={12}
      title={`Sản phẩm tại ${storefront.merchant.name}`}
    />
  );
}
