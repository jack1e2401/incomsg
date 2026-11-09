import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { List, SignOut, X } from "@phosphor-icons/react";
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
];
const merchantLinks = [
  ["/merchant", "Tổng quan"],
  ["/merchant/store", "Cửa hàng"],
  ["/merchant/products", "Sản phẩm"],
  ["/merchant/orders", "Đơn hàng"],
  ["/merchant/loyalty", "Loyalty"],
  ["/merchant/vouchers", "Voucher"],
  ["/merchant/rewards", "Trao thưởng"],
];

export function BackendConsoleLayout({ role }: { role: "admin" | "merchant" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuthSession();
  const navigate = useNavigate();
  const links = role === "admin" ? adminLinks : merchantLinks;
  return (
    <div className="min-h-dvh bg-[#f7f8f4] lg:pl-64">
      {menuOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#23442e] px-4 py-6 text-white transition-transform lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-3">
          <Link to="/" className="text-xl font-extrabold tracking-tight">
            loyalty.
          </Link>
          <button aria-label="Đóng menu" className="lg:hidden" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Điều hướng chính" className="mt-10 space-y-1">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin" || to === "/merchant"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "block rounded-xl px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10",
                  isActive && "bg-[#c7ec9f] text-[#26442e] hover:bg-[#c7ec9f]",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto truncate px-3 text-xs text-white/60">{user?.email}</p>
      </aside>
      <header className="sticky top-0 z-10 flex h-18 items-center justify-between border-b border-[#e7ede6] bg-[#f7f8f4]/95 px-5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-4">
          <button aria-label="Mở menu" className="lg:hidden" onClick={() => setMenuOpen(true)}>
            <List size={24} />
          </button>
          <p className="font-bold text-[#294833]">{role === "admin" ? "Quản trị hệ thống" : "Cửa hàng"}</p>
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
