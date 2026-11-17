import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Storefront } from "@phosphor-icons/react";
import { useResource } from "../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { productStockDisplay } from "../storefront/storefront-stock";
import { commerce, money, useMerchantContext } from "./member-context";

export function MemberStorefront() {
  const { merchantId, cart } = useMerchantContext();
  const products = useResource(
    () => commerce.listPublicProducts(merchantId).then((response) => response.items),
    [merchantId],
  );
  return (
    <>
      <PageHeader title={`Cửa hàng #${merchantId}`} />
      {products.loading ? (
        <LoadingState />
      ) : products.error ? (
        <ErrorState message={products.error} retry={products.reload} />
      ) : !products.data?.length ? (
        <EmptyState title="Chưa có sản phẩm" description="Cửa hàng chưa đăng sản phẩm đang bán." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.data.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <Link
                to={`product/${product.id}`}
                className="block aspect-[4/3] bg-[#edf2e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
                aria-label={`Xem chi tiết ${product.name}`}
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[#709275]">
                    <Storefront aria-hidden="true" size={36} />
                  </div>
                )}
              </Link>
              <div className="p-4 sm:p-5">
                <h2 className="font-extrabold text-[#294432] break-words">{product.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm muted break-words">{product.description}</p>
                <p className="mt-4 text-lg font-extrabold text-[#335e3d] tabular-nums">
                  {money(product.price)}
                </p>
                <p
                  className={`mt-1 inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${productStockDisplay(product.inventory.availableQuantity).badgeClass}`}
                >
                  {productStockDisplay(product.inventory.availableQuantity).label}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="flex-1 sm:flex-none">
                    <Link to={`product/${product.id}`} aria-label={`Chi tiết ${product.name}`}>
                      Chi tiết
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 sm:flex-none"
                    disabled={!cart.canAdd(product.id, product.inventory.availableQuantity)}
                    aria-label={
                      product.inventory.availableQuantity > 0
                        ? `Chọn mua ${product.name}`
                        : `${product.name} đã hết hàng`
                    }
                    onClick={() => cart.addProduct(product)}
                  >
                    {product.inventory.availableQuantity > 0 ? "Chọn mua" : "Hết hàng"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MemberProduct() {
  const { merchantId, basePath, cart } = useMerchantContext();
  const productId = Number(useParams().productId);
  const products = useResource(
    () => commerce.listPublicProducts(merchantId).then((response) => response.items),
    [merchantId],
  );
  if (!Number.isInteger(productId) || productId < 1)
    return <ErrorState message="Mã sản phẩm không hợp lệ." />;
  if (products.loading) return <LoadingState cards={1} />;
  if (products.error) return <ErrorState message={products.error} retry={products.reload} />;
  const product = products.data?.find((item) => item.id === productId);
  if (!product)
    return (
      <EmptyState
        title="Không tìm thấy sản phẩm"
        description="Sản phẩm có thể đã được ẩn hoặc ngừng bán."
        action={
          <Button asChild variant="outline">
            <Link to={basePath}>Về gian hàng</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <Link
        to={basePath}
        className="mb-5 inline-flex items-center gap-2 rounded text-sm font-bold text-[#335e3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Gian hàng
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-[1.7rem] bg-[#edf2e9]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[#709275]">
              <Storefront aria-hidden="true" size={54} />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${productStockDisplay(product.inventory.availableQuantity).badgeClass}`}
            role="status"
          >
            {productStockDisplay(product.inventory.availableQuantity).label}
          </span>
          <h1 className="mt-4 sm:mt-5 text-2xl font-extrabold text-[#294432] break-words sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 sm:mt-4 text-xl font-extrabold text-[#335e3d] tabular-nums break-words sm:text-2xl">
            {money(product.price)}
          </p>
          {product.description && (
            <p className="mt-5 sm:mt-6 whitespace-pre-line text-sm leading-7 muted break-words">
              {product.description}
            </p>
          )}
          <Button
            type="button"
            className="mt-6 sm:mt-8 w-full sm:w-fit"
            disabled={!cart.canAdd(product.id, product.inventory.availableQuantity)}
            aria-label={`Chọn mua ${product.name}`}
            onClick={() => cart.addProduct(product)}
          >
            <ShoppingCart aria-hidden="true" size={18} />{" "}
            {product.inventory.availableQuantity > 0 ? "Chọn mua" : "Hết hàng"}
          </Button>
        </div>
      </div>
    </>
  );
}
