import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { ShoppingCart, Storefront, Wallet, Ticket, Gift, Receipt, SignOut } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { ErrorState } from "../../components/ui";
import { useEnsureMembership } from "../customers/useEnsureMembership";
import { useMemberCart } from "./useMemberCart";
import type { MemberContext } from "./member-context";

export function BackendMemberLayout() {
  const merchantId = Number(useParams().merchantId);
  const { user } = useAuthSession();
  if (!Number.isInteger(merchantId) || merchantId < 1)
    return <ErrorState message="Mã cửa hàng không hợp lệ." />;
  if (!user) return null;

  const storageKey = `loyalty.member.cart.${user.id}.${merchantId}`;
  return <MemberStoreLayout key={storageKey} merchantId={merchantId} storageKey={storageKey} />;
}

export function MemberStoreLayout({
  merchantId,
  storageKey,
  basePath,
  storeName,
}: {
  merchantId: number;
  storageKey: string;
  basePath?: string;
  storeName?: string;
}) {
  const cart = useMemberCart(storageKey, merchantId);
  const { logout } = useAuthSession();
  const navigate = useNavigate();
  useEnsureMembership({ merchantId });

  const base = basePath ?? `/member/${merchantId}`;
  const isSlugRoute = base.startsWith("/s/");
  const cartQuantity = cart.quantity;
  const cartLabel = cartQuantity > 0 ? `Giỏ hàng, ${cartQuantity} sản phẩm` : undefined;
  const cartBadge = cartQuantity > 0 && (
    <span
      aria-hidden="true"
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#335e3d] px-1 text-[10px] font-bold leading-none text-white tabular-nums"
    >
      {cartQuantity}
    </span>
  );
  const links = [
    { to: base, label: "Cửa hàng", icon: Storefront, end: true },
    { to: `${base}/wallet`, label: "Ví điểm", icon: Wallet },
    { to: `${base}/vouchers`, label: "Voucher", icon: Ticket },
    { to: `${base}/rewards`, label: "Quà tặng", icon: Gift },
    { to: `${base}/orders`, label: "Đơn hàng", icon: Receipt },
    { to: `${base}/cart`, label: "Giỏ hàng", icon: ShoppingCart, isCart: true },
  ];
  return (
    <div className="min-h-dvh bg-[#fcfcf8] pb-20 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-[#e5ece3] bg-[#fcfcf8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-7">
          <Link
            to={isSlugRoute ? base : "/member"}
            className="rounded-md font-extrabold tracking-tight text-[#24452f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
          >
            loyalty<span className="text-[#89b461]">.</span>
          </Link>
          <span className="min-w-0 truncate text-xs font-semibold text-[#527353]">
            {storeName ?? `Cửa hàng #${merchantId}`}
          </span>
          <nav aria-label="Member" className="hidden gap-1 lg:flex">
            {links.map(({ to, label, end, isCart }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={isCart ? cartLabel : undefined}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] ${isActive ? "bg-[#e8f1e2] text-[#335e3d]" : "text-[#718176] hover:bg-[#edf4e9]"}`
                }
              >
                {label}
                {isCart && cartBadge}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold text-[#54725a] hover:bg-[#edf4e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] sm:px-3"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <SignOut aria-hidden="true" size={16} /> <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:py-10">
        <Outlet context={{ merchantId, basePath: base, cart } satisfies MemberContext} />
      </main>
      <nav
        aria-label="Điều hướng Member"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#e5ece3] bg-[#fcfcf8] px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 lg:hidden"
      >
        {links.map(({ to, label, icon: Icon, end, isCart }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={isCart ? cartLabel : undefined}
            className={({ isActive }) =>
              `flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] ${isActive ? "text-[#335e3d]" : "text-[#718176]"}`
            }
          >
            <span className="relative">
              <Icon aria-hidden="true" size={20} />
              {isCart && cartBadge && <span className="absolute -top-1.5 -right-3">{cartBadge}</span>}
            </span>
            <span className="max-w-full truncate px-0.5 text-center">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
