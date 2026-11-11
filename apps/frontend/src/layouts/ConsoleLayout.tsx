import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  Gift,
  List,
  Medal,
  Package,
  Receipt,
  SquaresFour,
  Storefront,
  Ticket,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useApi } from "../api/client";
import { useResource } from "../api/useResource";
import { ErrorState, LoadingState } from "../components/ui";
import { cn } from "../lib/utils";

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };
const adminItems: NavItem[] = [
  { to: "/admin", label: "Tổng quan", icon: <SquaresFour size={19} weight="light" />, end: true },
  { to: "/admin/applications", label: "Duyệt cửa hàng", icon: <UsersThree size={19} weight="light" /> },
  { to: "/admin/merchants", label: "Cửa hàng", icon: <Storefront size={19} weight="light" /> },
];
const merchantItems = (id: string): NavItem[] => [
  { to: `/merchant/${id}`, label: "Tổng quan", icon: <SquaresFour size={19} weight="light" />, end: true },
  { to: `/merchant/${id}/store`, label: "Cửa hàng", icon: <Storefront size={19} weight="light" /> },
  { to: `/merchant/${id}/products`, label: "Sản phẩm", icon: <Package size={19} weight="light" /> },
  { to: `/merchant/${id}/orders`, label: "Đơn hàng", icon: <Receipt size={19} weight="light" /> },
  { to: `/merchant/${id}/loyalty`, label: "Loyalty", icon: <Medal size={19} weight="light" /> },
  { to: `/merchant/${id}/vouchers`, label: "Voucher", icon: <Ticket size={19} weight="light" /> },
  { to: `/merchant/${id}/rewards`, label: "Trao thưởng", icon: <Gift size={19} weight="light" /> },
];

export function ConsoleLayout({ role }: { role: "admin" | "merchant" }) {
  const { merchantId = "moc" } = useParams();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const api = useApi();
  const merchant = useResource(() => api.getMerchant(merchantId), [merchantId]);
  const allowed = useResource(() => api.canManageMerchant(merchantId), [merchantId]);
  const items = role === "admin" ? adminItems : merchantItems(merchantId);
  const isMerchant = role === "merchant";
  const currentSection = items.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  );

  return (
    <div className="min-h-[100dvh] bg-[#f7f8f4]">
      {menuOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-[#1e3028]/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col bg-[#23442e] text-white transition-transform duration-300 lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between px-7">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c4f093] text-lg font-extrabold text-[#24442c]">
              L
            </span>
            <span className="text-[18px] font-extrabold tracking-[-.055em]">
              loyalty<span className="text-[#bfe68d]">.</span>
            </span>
          </Link>
          <button className="lg:hidden" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="mx-6 border-y border-white/10 py-4">
          <p className="truncate text-sm font-semibold">
            {isMerchant ? (merchant.data?.name ?? "Cửa hàng") : "Quản trị hệ thống"}
          </p>
        </div>
        <nav className="mt-5 space-y-1 px-3" aria-label="Điều hướng chính">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "nav-link flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold text-white/67 hover:bg-white/8 hover:text-white",
                  isActive && "bg-[#c7ec9f]! text-[#26442e]! shadow-[0_5px_18px_rgba(0,0,0,.08)]",
                )
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-16 items-center border-b border-[#e7ede6] bg-[#f7f8f4]/95 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <button
            className="mr-3 rounded-xl bg-white p-2 text-[#385843] lg:hidden"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
          >
            <List size={22} />
          </button>
          <p className="text-sm font-bold text-[#294833]">
            {currentSection?.label ?? (isMerchant ? "Cửa hàng" : "Quản trị")}
          </p>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-10 fade-in">
          {isMerchant && (merchant.loading || allowed.loading) ? (
            <LoadingState />
          ) : isMerchant && (merchant.error || allowed.error) ? (
            <ErrorState
              message={merchant.error ?? allowed.error ?? "Lỗi tải cửa hàng"}
              retry={() => {
                merchant.reload();
                allowed.reload();
              }}
            />
          ) : isMerchant && !allowed.data ? (
            <div className="mx-auto max-w-xl pt-16 text-center">
              <h1 className="text-3xl font-extrabold">Cửa hàng đang chờ duyệt</h1>
              <p className="mt-3 text-sm leading-6 muted">
                Bạn có thể quản lý cửa hàng sau khi hồ sơ được duyệt.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
