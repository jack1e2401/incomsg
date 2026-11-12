import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";

export { AdminUsers } from "./AdminUsers";
export { AdminBlacklist } from "./AdminBlacklist";
export { AdminAuditLogs } from "./AdminAuditLogs";
export { AdminMerchants } from "./AdminMerchantsModeration";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function AdminOverview() {
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => commerce.getAdminDashboard(accessToken!).then(({ stats }) => stats),
    [accessToken],
  );

  return (
    <>
      <PageHeader
        title="Tổng quan"
        action={
          <Button asChild>
            <Link to="/admin/applications">
              Hồ sơ cần duyệt <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm muted">Cửa hàng</p>
            <p className="mt-2 text-2xl font-extrabold">{resource.data.merchants}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm muted">Hồ sơ chờ duyệt</p>
            <p className="mt-2 text-2xl font-extrabold">{resource.data.pendingApplications}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm muted">Đơn đã thanh toán</p>
            <p className="mt-2 text-2xl font-extrabold">{resource.data.paidOrders}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm muted">Tổng doanh thu</p>
            <p className="mt-2 text-2xl font-extrabold">
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
              }).format(Number(resource.data.totalVolume))}
            </p>
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-sm muted">Chưa có số liệu.</Card>
      )}
    </>
  );
}
