import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { useResource } from "../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { commerce, money } from "../member/member-context";
import { useStorefrontShell } from "./storefront-context";

export function RewardsHubLayout() {
  const shell = useStorefrontShell();
  const { pathname } = useLocation();
  const { user } = useAuthSession();
  if (!shell) return <Outlet />;
  const tabs = [
    { path: `${shell.basePath}/challenges`, label: "Nhiệm vụ" },
    { path: `${shell.basePath}/vouchers`, label: "Ưu đãi" },
    { path: `${shell.basePath}/rewards`, label: "Đổi quà" },
  ];
  const detail = /^\/s\/[^/]+\/challenges\/[^/]+/.test(pathname);
  return <div>
    {!detail && (
      <nav aria-label="Danh mục săn thưởng" className="mb-5 flex gap-2 overflow-x-auto border-b border-[#e5ece3]">
        {tabs.map((tab) => { const active = pathname === tab.path || pathname.startsWith(`${tab.path}/`); return <Link key={tab.path} to={tab.path} aria-current={active ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold ${active ? "border-[#335e3d] text-[#24452f]" : "border-transparent text-[#68786c] hover:text-[#24452f]"}`}>{tab.label}</Link>; })}
      </nav>
    )}
    {user?.role !== "MEMBER" && (pathname === tabs[1].path || pathname === tabs[2].path)
      ? <PublicVoucherCatalog merchantId={shell.merchantId} basePath={shell.basePath} rewardsOnly={pathname === tabs[2].path} />
      : <Outlet context={shell} />}
  </div>;
}

function PublicVoucherCatalog({ merchantId, basePath, rewardsOnly }: { merchantId: number; basePath: string; rewardsOnly: boolean }) {
  const resource = useResource(() => commerce.listPublicVoucherDefinitions(merchantId).then((response) => response.definitions.filter((item) => item.isActive && (!rewardsOnly || item.type === "REWARD"))), [merchantId, rewardsOnly]);
  if (resource.loading) return <LoadingState cards={2} />;
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
  if (!resource.data?.length) return <EmptyState title={rewardsOnly ? "Chưa có quà tặng" : "Chưa có ưu đãi"} description="Các ưu đãi hiện có của cửa hàng sẽ xuất hiện tại đây." />;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{resource.data.map((item) => <Card key={item.id} className="p-5">
    <h2 className="font-extrabold text-[#20392a]">{item.title}</h2>
    <p className="mt-2 text-sm text-[#5d6f62]">{item.type === "DISCOUNT" && item.discountAmount ? `Giảm ${money(item.discountAmount)}` : item.rewardDescription}</p>
    <p className="mt-3 text-sm font-bold">{item.pointsCost.toLocaleString("vi-VN")} điểm</p>
    <Button asChild className="mt-4 w-full"><Link to={`/login?returnTo=${encodeURIComponent(`${basePath}/${rewardsOnly ? "rewards" : "vouchers"}`)}`}>Đăng nhập để bắt đầu</Link></Button>
  </Card>)}</div>;
}
