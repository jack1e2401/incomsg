import { useEffect, useLayoutEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CaretDown, ChartBar, Gauge, List, Megaphone, Package, SignOut, Storefront, UsersThree, X } from "@phosphor-icons/react";
import { useAuthSession } from "../api/auth-session";
import { createCommerceClient } from "../api/commerce-http";
import { useResource } from "../api/useResource";
import { ErrorState, LoadingState } from "../components/ui";
import { cn } from "../lib/utils";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

const adminLinks = [
  ["/admin", "Tổng quan"],
  ["/admin/applications", "Duyệt cửa hàng"],
  ["/admin/merchants", "Cửa hàng"],
  ["/admin/users", "Người dùng"],
  ["/admin/blacklist", "Danh sách đen"],
  ["/admin/audit-logs", "Nhật ký"],
  ["/admin/abuse-reports", "Báo cáo vi phạm"],
  ["/admin/refund-requests", "Lịch sử hoàn tiền"],
];
const merchantGroups = [
  { label: "Vận hành", icon: Gauge, links: [["/merchant", "Tổng quan"], ["/merchant/orders", "Đơn hàng"], ["/merchant/refund-requests", "Hoàn tiền"]] },
  { label: "Sản phẩm", icon: Package, links: [["/merchant/products", "Sản phẩm"], ["/merchant/categories", "Danh mục"]] },
  { label: "Cửa hàng", icon: Storefront, links: [["/merchant/store", "Thông tin cửa hàng"], ["/merchant/storefront", "Giao diện cửa hàng"]] },
  {
    label: "Khách hàng & Loyalty",
    icon: UsersThree,
    links: [
      ["/merchant/customers", "Khách hàng"],
      ["/merchant/loyalty/config", "Cấu hình điểm"],
      ["/merchant/loyalty/transactions", "Giao dịch điểm"],
      ["/merchant/loyalty/history", "Lịch sử chính sách"],
      ["/merchant/loyalty/members", "Thành viên"],
      ["/merchant/vouchers", "Voucher"],
    ],
  },
  { label: "Marketing", icon: Megaphone, links: [["/merchant/events", "Sự kiện"], ["/merchant/challenges", "Nhiệm vụ"]] },
  { label: "Báo cáo", icon: ChartBar, links: [["/merchant/analytics", "Phân tích"]] },
];

export function BackendConsoleLayout({ role }: { role: "admin" | "merchant" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const links = adminLinks;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(merchantGroups.map((group) => [
      group.label,
      group.links.some(([to]) => location.pathname === to || (to !== "/merchant" && location.pathname.startsWith(`${to}/`))),
    ])),
  );
  useEffect(() => {
    if (role !== "merchant") return;
    const active = merchantGroups.find((group) => group.links.some(([to]) => location.pathname === to || (to !== "/merchant" && location.pathname.startsWith(`${to}/`))));
    if (active) setExpandedGroups((current) => ({ ...current, [active.label]: true }));
  }, [location.pathname, role]);
  useLayoutEffect(() => {
    if (role !== "merchant") return;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, role]);
  const routeLabels = role === "admin" ? adminLinks : merchantGroups.flatMap((group) => group.links);
  const pageTitle = location.pathname.split("/").filter(Boolean).length > 1
    ? location.pathname.includes("/challenges/")
      ? "Chi tiết nhiệm vụ"
      : routeLabels.find(([to]) => to !== "/admin" && to !== "/merchant" && (location.pathname === to || location.pathname.startsWith(`${to}/`)))?.[1] ?? (role === "admin" ? "Quản trị hệ thống" : "Cửa hàng")
    : role === "admin" ? "Quản trị hệ thống" : "Cửa hàng";
  return (
    <div className="min-h-dvh bg-[#f7f8f4] lg:pl-[17rem]">
      {menuOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[17rem] flex-col border-r border-white/10 bg-[#203d2c] px-4 py-5 text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Link to="/" className="text-[23px] font-extrabold tracking-[-0.06em] text-white">
            loyalty<span className="text-[#c7ec9f]">.</span>
          </Link>
          <button aria-label="Đóng menu" className="grid size-9 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7ec9f] lg:hidden" onClick={() => setMenuOpen(false)}>
            <X size={19} />
          </button>
        </div>
        <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c7ec9f] text-[#203d2c]">
            {role === "merchant" ? <Storefront size={20} weight="duotone" /> : <Gauge size={20} weight="duotone" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white">{role === "merchant" ? "Không gian cửa hàng" : "Trung tâm quản trị"}</span>
            <span className="mt-0.5 block text-xs text-white/55">{role === "merchant" ? "Quản lý hoạt động" : "Quản lý hệ thống"}</span>
          </span>
        </div>
        <nav aria-label="Điều hướng chính" className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pb-3 pr-1">
          {role === "admin" ? links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition duration-150 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7ec9f]",
                  isActive && "bg-white/[0.12] font-semibold text-white shadow-[inset_3px_0_0_#c7ec9f]",
                )
              }
            >
              {({ isActive }) => <><span className={cn("size-1.5 rounded-full bg-white/25 transition", isActive && "bg-[#c7ec9f]")} />{label}</>}
            </NavLink>
          )) : merchantGroups.map((group, index) => {
            const GroupIcon = group.icon;
            const groupId = `merchant-nav-group-${index}`;
            return <section key={group.label} className="pt-1">
              <button
                type="button"
                aria-expanded={expandedGroups[group.label] ?? false}
                aria-controls={groupId}
                onClick={() => setExpandedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left text-[13px] font-semibold text-white/65 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7ec9f]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-white/70"><GroupIcon size={17} weight="regular" /></span>
                  <span className="truncate">{group.label}</span>
                </span>
                <CaretDown size={15} aria-hidden="true" className={cn("shrink-0 text-white/45 transition-transform duration-200", expandedGroups[group.label] && "rotate-180")} />
              </button>
              <div id={groupId} hidden={!expandedGroups[group.label]} className="ml-[1.35rem] space-y-0.5 border-l border-white/10 py-1 pl-3">
                  {group.links.map(([to, label]) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/merchant"}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) => cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/65 transition duration-150 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7ec9f]",
                        isActive && "bg-white/[0.12] font-semibold text-white shadow-[inset_3px_0_0_#c7ec9f] hover:bg-white/[0.12] hover:text-white",
                      )}
                    >
                      {({ isActive }) => <><span className={cn("size-1.5 shrink-0 rounded-full bg-white/25 transition", isActive && "bg-[#c7ec9f]")} />{label}</>}
                    </NavLink>
                  ))}
              </div>
            </section>;
          })}
        </nav>
        <div className="mt-3 flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#315b3b] text-sm font-bold text-[#d8f5bb]">
            {(user?.email?.[0] ?? (role === "merchant" ? "M" : "A")).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white/90">{user?.email ?? "Tài khoản"}</span>
            <span className="mt-0.5 block text-[11px] text-white/50">{role === "merchant" ? "Tài khoản cửa hàng" : "Quản trị viên"}</span>
          </span>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-18 items-center justify-between border-b border-[#e7ede6] bg-[#f7f8f4]/95 px-5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-4">
          <button aria-label="Mở menu" className="grid size-10 place-items-center rounded-xl text-[#294833] transition hover:bg-[#eaf0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] lg:hidden" onClick={() => setMenuOpen(true)}>
            <List size={24} />
          </button>
          <p className="font-bold text-[#294833]">{pageTitle}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#45654b]"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          <SignOut size={18} /> Đăng xuất
        </button>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 lg:pt-10">
        {role === "merchant" ? <MerchantAccess /> : <Outlet />}
      </main>
    </div>
  );
}

function MerchantAccess() {
  const { accessToken } = useAuthSession();
  const resource = useResource(() => commerce.getOwnMerchant(accessToken!), [accessToken]);
  if (resource.loading) return <LoadingState cards={2} />;
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
  if (!resource.data?.merchant.isActive)
    return <ErrorState message="Cửa hàng chưa được Admin kích hoạt." retry={resource.reload} />;
  return <Outlet />;
}
