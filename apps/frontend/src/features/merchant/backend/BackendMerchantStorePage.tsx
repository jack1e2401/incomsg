import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "../../../components/ui";
import { MerchantStoreDetails } from "../MerchantStoreDetails";
import { api, useToken } from "../merchant-page-support";

export function MerchantStore() {
  const token = useToken();
  const resource = useResource(() => api.getOwnMerchant(token), [token]);
  return (
    <>
      <PageHeader title="Cửa hàng" />
      {resource.loading ? (
        <LoadingState cards={1} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.merchant ? (
        <MerchantStoreDetails merchant={resource.data.merchant} token={token} />
      ) : (
        <EmptyState
          title="Chưa có cửa hàng"
          description="Cửa hàng chỉ hoạt động sau khi Admin duyệt hồ sơ Merchant."
        />
      )}
    </>
  );
}
