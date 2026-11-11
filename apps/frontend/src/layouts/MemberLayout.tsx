import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  House,
  Storefront,
  Wallet,
  Ticket,
  ShoppingCart,
  CaretDown,
  Gift,
  Receipt,
} from "@phosphor-icons/react";
import { useApi } from "../api/client";
import { useResource } from "../api/useResource";
import { ErrorState, LoadingState } from "../components/ui";
import { cn } from "../lib/utils";
import type { Merchant } from "../api/types";

export interface CartItem {
  productId: string;
  quantity: number;
}
export interface MemberOutlet {
  merchant: Merchant;
  cart: CartItem[];
  addToCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

export function MemberLayout() {
  const { merchantId = "moc" } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [carts, setCarts] = useState<Record<string, CartItem[]>>({});
  const merchants = useResource(() => api.listMerchants(), []);
  const merchant = merchants.data?.find((m) => m.id === merchantId && m.status === "APPROVED");
  const cart = carts[merchantId] ?? [];
  const addToCart = (productId: string) =>
    setCarts((previous) => {
      const items = previous[merchantId] ?? [];
      const found = items.find((i) => i.productId === productId);
      return {
        ...previous,
        [merchantId]: found
          ? items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i))
          : [...items, { productId, quantity: 1 }],
      };
    });
  const setQuantity = (productId: string, quantity: number) =>
    setCarts((previous) => ({
      ...previous,
      [merchantId]: (previous[merchantId] ?? [])
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0),
    }));
  const clearCart = () => setCarts((previous) => ({ ...previous, [merchantId]: [] }));
  const nav = [
    { to: `/member/${merchantId}`, label: "Khám phá", icon: <House size={22} weight="light" />, end: true },
    { to: `/member/${merchantId}/wallet`, label: "Ví điểm", icon: <Wallet size={22} weight="light" /> },
    { to: `/member/${merchantId}/vouchers`, label: "Voucher", icon: <Ticket size={22} weight="light" /> },
    { to: `/member/${merchantId}/rewards`, label: "Quà tặng", icon: <Gift size={22} weight="light" /> },
    { to: `/member/${merchantId}/orders`, label: "Đơn hàng", icon: <Receipt size={22} weight="light" /> },
    { to: `/member/${merchantId}/cart`, label: "Giỏ hàng", icon: <ShoppingCart size={22} weight="light" /> },
  ];
  return (
    <div className="min-h-[100dvh] bg-[#fcfcf8] pb-20 lg:pb-0">
      <header className="sticky top-0 z-10 border-b border-[#e9eee7] bg-[#fcfcf8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-8 lg:h-20">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#335e3d] text-lg font-extrabold text-[#c9f097]">
              L
            </span>
            <span className="hidden text-xl font-extrabold tracking-[-.06em] text-[#24452f] sm:block">
              loyalty<span className="text-[#89b461]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-[#f0f4ed] px-3 py-1.5">
            <Storefront size={17} className="text-[#65866b]" />
            <select
              aria-label="Chọn cửa hàng"
              value={merchantId}
              onChange={(e) => navigate(`/member/${e.target.value}`)}
              className="max-w-[155px] appearance-none bg-transparent text-xs font-bold text-[#31553b] outline-none sm:max-w-none"
            >
              {merchants.data
                ?.filter((m) => m.status === "APPROVED")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
            <CaretDown size={12} className="text-[#65866b]" />
          </div>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Member">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "nav-link rounded-full px-4 py-2 text-xs font-bold muted hover:bg-[#edf4e9]",
                    isActive && "bg-[#e8f1e2] text-[#335e3d]",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto min-h-[75dvh] max-w-[1320px] px-4 pb-12 pt-6 sm:px-8 lg:pt-10 fade-in">
        {merchants.loading ? (
          <LoadingState />
        ) : merchants.error ? (
          <ErrorState message={merchants.error} retry={merchants.reload} />
        ) : !merchant ? (
          <ErrorState message="Cửa hàng không tồn tại hoặc chưa được duyệt" />
        ) : (
          <Outlet context={{ merchant, cart, addToCart, setQuantity, clearCart } satisfies MemberOutlet} />
        )}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-[#e5ece3] bg-[#fcfcf8]/98 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 shadow-[0_-8px_30px_rgba(23,53,32,.04)] lg:hidden"
        aria-label="Điều hướng Member"
      >
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[9px] font-bold muted",
                isActive && "text-[#335e3d]",
              )
            }
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
