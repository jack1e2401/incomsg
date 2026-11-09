import { useState, type ReactNode } from "react";
import { NavLink, Outlet, Link, useParams } from "react-router-dom";
import {
  SquaresFour,
  Storefront,
  Package,
  Receipt,
  Medal,
  Ticket,
  Gift,
  UsersThree,
  ChartLineUp,
  List,
  X,
  ArrowRight,
  CaretDown,
  Bell,
} from "@phosphor-icons/react";
import { useApi } from "../api/client";
import { useResource } from "../api/useResource";
import { Button, ErrorState, LoadingState } from "../components/ui";
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
  const [open, setOpen] = useState(false);
  const api = useApi();
  const merchant = useResource(() => api.getMerchant(merchantId), [merchantId]);
  const allowed = useResource(() => api.canManageMerchant(merchantId), [merchantId]);
  const items = role === "admin" ? adminItems : merchantItems(merchantId);
  const isMerchant = role === "merchant";
  return (
    <div className="min-h-[100dvh] bg-[#f7f8f4]">
      {open && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-[#1e3028]/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col bg-[#23442e] text-white transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-24 items-center justify-between px-7">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c4f093] text-lg font-extrabold text-[#24442c]">
              L
            </span>
            <span className="text-[18px] font-extrabold tracking-[-.055em]">
              loyalty<span className="text-[#bfe68d]">.</span>
            </span>
          </Link>
          <button className="lg:hidden" aria-label="Đóng menu" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="mx-4 rounded-2xl bg-white/9 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/50">
            Không gian làm việc
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#bddb9d] font-extrabold text-[#24442c]">
              {isMerchant ? (merchant.data?.initials ?? "M") : "A"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {isMerchant ? (merchant.data?.name ?? "Cửa hàng") : "Quản trị hệ thống"}
              </p>
              <p className="text-[11px] text-white/55">
                {isMerchant ? "Merchant workspace" : "Admin workspace"}
              </p>
            </div>
            <CaretDown size={13} className="text-white/60" />
          </div>
        </div>
        <p className="mb-3 mt-9 px-7 text-[10px] font-bold uppercase tracking-[.19em] text-white/42">
          Menu chính
        </p>
        <nav className="space-y-1 px-3" aria-label="Điều hướng chính">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
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
        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-[#355a3d] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#d8eebf]">
              <ChartLineUp size={17} /> Demo workspace
            </div>
            <p className="text-[11px] leading-5 text-white/60">
              Dữ liệu minh họa từ mock API. Thanh toán thật chưa được kết nối.
            </p>
          </div>
          <Link
            to="/member/moc"
            className="mt-3 flex items-center justify-between px-3 py-2 text-xs font-semibold text-white/65 hover:text-white"
          >
            Xem giao diện Member <ArrowRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-[#e7ede6] bg-[#f7f8f4]/95 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl bg-white p-2 text-[#385843] lg:hidden"
              aria-label="Mở menu"
              onClick={() => setOpen(true)}
            >
              <List size={22} />
            </button>
            <div>
              <p className="text-xs font-semibold muted">Thứ Hai, 09 tháng 11 2026</p>
              <p className="mt-0.5 text-sm font-bold text-[#294833]">
                {isMerchant ? "Merchant dashboard" : "Admin dashboard"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-[#e8f1e2] px-3 py-1.5 text-[11px] font-bold text-[#4a7350] sm:block">
              ● Mock API
            </span>
            <button
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#506858]"
              aria-label="Thông báo"
            >
              <Bell size={18} weight="light" />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d8e7d0] text-xs font-extrabold text-[#386442]">
              {isMerchant ? "MS" : "AD"}
            </span>
          </div>
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
              <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#fff1d6] text-3xl">
                ⌛
              </span>
              <h1 className="text-3xl font-extrabold">Cửa hàng đang chờ duyệt</h1>
              <p className="mt-3 text-sm leading-6 muted">
                Admin cần duyệt hồ sơ trước khi bạn có thể quản lý sản phẩm, đơn hàng và chương trình loyalty.
              </p>
              <Button asChild className="mt-6">
                <Link to="/admin/applications">
                  Xem hồ sơ demo <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
