import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductCategoryDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { MerchantCategoriesPanel } from "./MerchantCategoriesPanel";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function MerchantCategoriesPage() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  const categories = useResource<{ categories: ProductCategoryDto[] }>(
    () => api.listOwnCategories(accessToken),
    [accessToken],
  );

  if (categories.loading && !categories.data) return <LoadingState cards={2} />;
  if (categories.error && !categories.data) return <ErrorState message={categories.error} retry={categories.reload} />;

  return (
    <>
      <PageHeader title="Danh mục sản phẩm" description="Phân nhóm sản phẩm để khách dễ lọc trên gian hàng." />
      <MerchantCategoriesPanel
        token={accessToken}
        categories={categories.data?.categories ?? []}
        loading={categories.loading}
        error={categories.error}
        onChanged={categories.reload}
      />
    </>
  );
}
