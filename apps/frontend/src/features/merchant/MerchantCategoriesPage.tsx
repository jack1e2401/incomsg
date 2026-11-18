import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductCategoryDto } from "../../api/commerce-types";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { useResource } from "../../api/useResource";
import { ErrorState, LoadingState } from "../../components/ui";
import { CmsPageHeader } from "./cms";
import { MerchantCategoriesPanel } from "./MerchantCategoriesPanel";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function MerchantCategoriesPage() {
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  const categories = useResource<{ categories: ProductCategoryDto[] }>(
    () => api.listOwnCategories(accessToken),
    [accessToken],
  );

  if (categories.loading && !categories.data) return <LoadingState cards={2} />;
  if (categories.error && !categories.data) return <ErrorState message={categories.error} retry={categories.reload} />;

  return (
    <MerchantCategoriesPanel
      heading={<CmsPageHeader
        title="Danh mục sản phẩm"
        description="Phân nhóm sản phẩm để khách dễ lọc trên gian hàng."
      />}
      backAction={<Button onClick={() => navigate("/merchant/products")}>Quay lại sản phẩm</Button>}
      token={accessToken}
      categories={categories.data?.categories ?? []}
      loading={categories.loading}
      error={categories.error}
      onChanged={categories.reload}
    />
  );
}
