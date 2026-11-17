import { Link, useNavigate, useParams } from "react-router-dom";
import { Gift, Receipt, SignIn, SignOut, Ticket, UserCircle, Wallet } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import { Button, Card, LoadingState } from "../../components/ui";
import { memberTierLabel } from "../member/MemberLoyaltyPolicyDialog";
import { useStorefrontShell } from "./storefront-context";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function StorefrontProfilePage() {
  const { slug = "" } = useParams();
  const shell = useStorefrontShell();
  const { user, accessToken, logout } = useAuthSession();
  const navigate = useNavigate();

  const basePath = shell?.basePath ?? `/s/${slug}`;
  const accent = shell?.accent ?? "#335e3d";
  const merchantId = shell?.merchantId;
  const merchantName = shell?.storefront.merchant.name ?? slug;

  const walletResource = useResource(
    () =>
      user?.role === "MEMBER" && accessToken && merchantId
        ? commerce.getMemberWallet(merchantId, accessToken).then((res) => res.wallet)
        : Promise.resolve(null),
    [user?.role, accessToken, merchantId],
  );

  if (!user) {
    const returnTo = encodeURIComponent(`${basePath}/profile`);
    return (
      <section className="mx-auto w-full max-w-md py-8 sm:py-12">
        <Card
          role="region"
          aria-labelledby="storefront-guest-profile-title"
          className="rounded-[2rem] p-7 text-center shadow-[0_18px_48px_-32px_rgba(32,57,42,0.28)] sm:p-9"
        >
          <span
            className="mx-auto grid h-16 w-16 place-items-center rounded-[1.35rem] bg-[#edf4e9] ring-1 ring-inset ring-[#e2ecdf]"
            style={{ color: accent }}
          >
            <UserCircle size={36} weight="light" aria-hidden="true" />
          </span>
          <h1
            id="storefront-guest-profile-title"
            className="mt-5 text-[1.35rem] font-extrabold leading-tight tracking-[-0.025em] text-[#20392a]"
          >
            Thành viên {merchantName}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[0.95rem] leading-6 text-[#5d6f62]">
            Đăng nhập để tích điểm, đổi ưu đãi và theo dõi đơn hàng của bạn tại cửa hàng này.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button asChild className="min-h-11 w-full" style={{ backgroundColor: accent }}>
              <Link to={`/login?returnTo=${returnTo}`}>
                <SignIn size={17} aria-hidden="true" /> Đăng nhập
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="min-h-11 w-full border-[#d6e2d2] bg-white text-[#335e3d] hover:bg-[#f6f9f4]"
            >
              <Link to={`/register?returnTo=${returnTo}`}>Tạo tài khoản</Link>
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  const wallet = walletResource.data;
  const quickLinks = [
    {
      to: `${basePath}/orders`,
      label: "Đơn hàng của tôi",
      desc: "Xem trạng thái và lịch sử mua",
      icon: Receipt,
    },
    { to: `${basePath}/wallet`, label: "Ví điểm Loyalty", desc: "Lịch sử tích & tiêu điểm", icon: Wallet },
    { to: `${basePath}/vouchers`, label: "Ưu đãi & Voucher", desc: "Đổi điểm lấy mã giảm giá", icon: Ticket },
    { to: `${basePath}/rewards`, label: "Quà tặng đã đổi", desc: "Theo dõi quà nhận tại quầy", icon: Gift },
    {
      to: `${basePath}/challenges`,
      label: "Nhiệm vụ săn thưởng",
      desc: "Theo dõi nhiệm vụ và phần thưởng",
      icon: Gift,
    },
  ];

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
              style={{ backgroundColor: accent }}
            >
              <UserCircle size={28} weight="light" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-[#20392a]">{user.email}</p>
              <p className="text-xs text-[#5d6f62]">Thành viên tại {merchantName}</p>
            </div>
          </div>
          {wallet && (
            <span
              className="shrink-0 rounded-full bg-[#edf4e9] px-3 py-1 text-xs font-bold"
              style={{ color: accent }}
            >
              {wallet.tier === "UNRANKED" ? "Thành viên mới" : memberTierLabel[wallet.tier]}
            </span>
          )}
        </div>

        {user.role === "MEMBER" && walletResource.loading && (
          <div className="mt-4">
            <LoadingState cards={1} />
          </div>
        )}

        {wallet && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#f4f7f2] p-3.5">
            <div>
              <p className="text-xs text-[#5d6f62]">Điểm khả dụng</p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#20392a]">
                {wallet.availablePoints.toLocaleString("vi-VN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5d6f62]">Tổng tích lũy</p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#20392a]">
                {wallet.netLifetimeEarned}
              </p>
            </div>
          </div>
        )}
      </Card>

      {user.role === "MEMBER" && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {quickLinks.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-2xl border border-[#e6ece3] bg-white p-4 transition hover:border-[#bdd0b9]"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf4e9]"
                style={{ color: accent }}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[#20392a]">{label}</p>
                <p className="truncate text-xs text-[#617266]">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            logout();
            navigate(basePath, { replace: true });
          }}
        >
          <SignOut size={16} aria-hidden="true" /> Đăng xuất
        </Button>
      </div>
    </section>
  );
}
