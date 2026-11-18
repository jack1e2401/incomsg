import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { ErrorState, LoadingState } from "../../components/ui";
import { MerchantProductWizard } from "./MerchantProductWizard";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

async function findOwnProduct(productId: number, token: string): Promise<ProductDto> {
  let response = await api.listOwnProducts(token, { page: 1 });
  const first = response.items.find((product) => product.id === productId);
  if (first) return first;
  for (let page = 2; page <= response.pagination.totalPages; page += 1) {
    response = await api.listOwnProducts(token, { page });
    const found = response.items.find((product) => product.id === productId);
    if (found) return found;
  }
  throw new Error(`Không tìm thấy sản phẩm #${productId}.`);
}

export function MerchantProductEditorPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  const token = accessToken;
  const isNew = productId === undefined || productId === "new";
  const id = Number(productId);
  const validId = Number.isSafeInteger(id) && id > 0;

  const loadProduct = useCallback(() => {
    if (isNew) return Promise.resolve(null);
    if (!validId) return Promise.reject(new Error("Mã sản phẩm không hợp lệ."));
    return findOwnProduct(id, token);
  }, [id, isNew, token, validId]);
  const productResource = useResource<ProductDto | null>(loadProduct, [loadProduct]);
  const categoriesResource = useResource(() => api.listOwnCategories(token), [token]);

  if (productResource.loading || categoriesResource.loading) return <LoadingState />;
  const error = productResource.error ?? categoriesResource.error;
  if (error) return <ErrorState message={error} retry={() => { productResource.reload(); categoriesResource.reload(); }} />;

  return (
    <MerchantProductWizard
      product={productResource.data ?? null}
      categories={categoriesResource.data?.categories ?? []}
      token={token}
      onCancel={() => navigate("/merchant/products")}
      onSaved={() => navigate("/merchant/products", { replace: true })}
    />
  );
}
