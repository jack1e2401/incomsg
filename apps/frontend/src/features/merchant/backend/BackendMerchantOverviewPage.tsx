import { Link } from "react-router-dom";
import { ArrowRight, Package, Storefront } from "@phosphor-icons/react";
import { useResource } from "../../../api/useResource";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from "../../../components/ui";
import { MerchantRevenueChart } from "../MerchantRevenueChart";
import { MerchantFinanceOverview } from "../../finance/MerchantFinanceOverview";
import { api, useToken } from "../merchant-page-support";

export function MerchantOverview() {
  const token = useToken();
  const store = useResource(() => api.getOwnMerchant(token), [token]);
  const products = useResource(() => api.listOwnProducts(token), [token]);
  const orders = useResource(
    () => api.listMerchantOrders(token).then((response) => response.orders),
    [token],
  );
  if (store.loading || products.loading) return <LoadingState cards={3} />;
  if (store.error || products.error)
    return (
      <ErrorState
        message={store.error ?? products.error ?? "Lỗi tải cửa hàng"}
        retry={() => {
          store.reload();
          products.reload();
        }}
      />
    );
  const merchant = store.data?.merchant;
  if (!merchant)
    return (
      <EmptyState
        title="Chưa có cửa hàng"
        description="Cửa hàng chỉ hoạt động sau khi Admin duyệt hồ sơ Merchant."
      />
    );
  return (
    <>
      <PageHeader
        title={merchant.name}
        description={`Mã cửa hàng #${merchant.id}`}
        action={
          <Button asChild>
            <Link to="/merchant/products">
              Quản lý sản phẩm <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Sản phẩm"
          value={products.data?.pagination.totalItems ?? products.data?.items.length ?? 0}
          icon={<Package size={20} />}
        />
        <StatCard
          label="Đang hiển thị"
          value={
            products.data?.items.filter((item) => item.status === "ACTIVE" && item.kind !== "REWARD")
              .length ?? 0
          }
          icon={<Storefront size={20} />}
        />
        <StatCard label="Trạng thái cửa hàng" value={merchant.isActive ? "Hoạt động" : "Không hoạt động"} />
      </div>
      <MerchantRevenueChart
        orders={orders.data}
        loading={orders.loading}
        error={orders.error}
        retry={orders.reload}
      />
      <MerchantFinanceOverview token={token} />
    </>
  );
}
