import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ArrowRight, ChartLineUp, ShieldCheck, Storefront, UserCircle } from "@phosphor-icons/react";
import { ApiProvider } from "../api/client";
import { AuthSessionProvider } from "../api/auth-session";
import { Button, Card } from "../components/ui";
import { ConsoleLayout } from "../layouts/ConsoleLayout";
import { MemberLayout } from "../layouts/MemberLayout";
import { AdminApplications, AdminMerchants, AdminOverview } from "../features/admin/AdminPages";
import {
  MerchantLoyalty,
  MerchantOrders,
  MerchantOverview,
  MerchantProducts,
  MerchantRewards,
  MerchantStore,
  MerchantVouchers,
} from "../features/merchant/MerchantPages";
import { MemberCart, MemberCheckout, MemberProduct, MemberStorefront } from "../features/member/MemberShop";
import {
  MemberOrderResult,
  MemberOrders,
  MemberRewards,
  MemberVouchers,
  MemberWallet,
} from "../features/member/MemberLoyalty";
import { LoginPage, RegisterPage } from "../features/auth/AuthPages";
import {
  AdminApplicationsM2,
  MemberHomeM2,
  MerchantHomeM2,
  Milestone2Workspace,
  RequireRole,
} from "../features/auth/Milestone2Pages";
import { routeForRole, useAuthSession } from "../api/auth-session";

const useBackend = import.meta.env.VITE_API_MODE === "http";

export function App() {
  return <AuthSessionProvider>{useBackend ? <BackendRoutes /> : <DemoRoutes />}</AuthSessionProvider>;
}

function DemoRoutes() {
  return (
    <ApiProvider>
      <Routes>
        <Route path="/" element={<DemoWelcome />} />
        <Route path="/admin" element={<ConsoleLayout role="admin" />}>
          <Route index element={<AdminOverview />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="merchants" element={<AdminMerchants />} />
        </Route>
        <Route path="/merchant/:merchantId" element={<ConsoleLayout role="merchant" />}>
          <Route index element={<MerchantOverview />} />
          <Route path="store" element={<MerchantStore />} />
          <Route path="products" element={<MerchantProducts />} />
          <Route path="orders" element={<MerchantOrders />} />
          <Route path="loyalty" element={<MerchantLoyalty />} />
          <Route path="vouchers" element={<MerchantVouchers />} />
          <Route path="rewards" element={<MerchantRewards />} />
        </Route>
        <Route path="/member/:merchantId" element={<MemberLayout />}>
          <Route index element={<MemberStorefront />} />
          <Route path="product/:productId" element={<MemberProduct />} />
          <Route path="cart" element={<MemberCart />} />
          <Route path="checkout" element={<MemberCheckout />} />
          <Route path="wallet" element={<MemberWallet />} />
          <Route path="vouchers" element={<MemberVouchers />} />
          <Route path="rewards" element={<MemberRewards />} />
          <Route path="orders" element={<MemberOrders />} />
          <Route path="orders/:orderId" element={<MemberOrderResult />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ApiProvider>
  );
}

function BackendRoutes() {
  return (
    <Routes>
      <Route path="/" element={<BackendWelcome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireRole role="ADMIN" />}>
        <Route path="/admin" element={<Milestone2Workspace role="ADMIN" />}>
          <Route index element={<Navigate to="applications" replace />} />
          <Route path="applications" element={<AdminApplicationsM2 />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="MERCHANT" />}>
        <Route path="/merchant" element={<Milestone2Workspace role="MERCHANT" />}>
          <Route index element={<MerchantHomeM2 />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="MEMBER" />}>
        <Route path="/member" element={<Milestone2Workspace role="MEMBER" />}>
          <Route index element={<MemberHomeM2 />} />
        </Route>
      </Route>
      <Route path="*" element={<BackendFallback />} />
    </Routes>
  );
}

function BackendWelcome() {
  const { user } = useAuthSession();
  if (user) return <Navigate to={routeForRole(user.role)} replace />;
  return (
    <main className="min-h-[100dvh] bg-[#f7f8f4] px-4 py-12 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <Brand />
        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.25em] text-[#81a57b]">
              Backend-connected · Milestone 2
            </p>
            <h1 className="serif mt-5 max-w-2xl text-5xl leading-[1.04] tracking-[-.055em] text-[#264632] sm:text-7xl">
              Loyalty that feels <span className="text-[#83a969]">personal.</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-[#738276]">
              Tạo tài khoản, đăng nhập theo role và gửi hồ sơ Merchant để Admin phê duyệt. Dữ liệu tài khoản
              và quyết định duyệt được lưu từ backend.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Đăng nhập <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/register">Tạo tài khoản</Link>
              </Button>
            </div>
            <p className="mt-4 text-[11px] text-[#9aa69b]">
              M2 API thật · Chưa có thanh toán hoặc điểm loyalty trong backend
            </p>
          </div>
          <Card className="p-6 sm:p-8">
            <h2 className="text-lg font-extrabold text-[#294a32]">Các luồng đã kết nối</h2>
            <div className="mt-5 space-y-3">
              <RoleSummary
                icon={<UserCircle size={20} />}
                title="Member"
                text="Đăng ký active ngay và đăng nhập bằng JWT."
              />
              <RoleSummary
                icon={<Storefront size={20} />}
                title="Merchant"
                text="Nộp hồ sơ, chờ duyệt, xem cửa hàng sau khi được duyệt."
              />
              <RoleSummary
                icon={<ShieldCheck size={20} />}
                title="Admin"
                text="Đăng nhập bằng tài khoản đã seed và duyệt hồ sơ thật."
              />
            </div>
          </Card>
        </div>
        <p className="mt-12 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#a2ada1]">
          <ChartLineUp size={15} /> API mode · {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}
        </p>
      </div>
    </main>
  );
}

function BackendFallback() {
  const { user } = useAuthSession();
  return <Navigate to={user ? routeForRole(user.role) : "/login"} replace />;
}

function DemoWelcome() {
  return (
    <div className="min-h-[100dvh] bg-[#f7f8f4] px-4 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Brand />
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.25em] text-[#81a57b]">
              A more thoughtful way to shop
            </p>
            <h1 className="serif mt-5 max-w-2xl text-5xl leading-[1.04] tracking-[-.055em] text-[#264632] sm:text-7xl">
              Loyalty that feels <span className="text-[#83a969]">personal.</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-[#738276]">
              Một không gian thương mại đa cửa hàng, nơi mỗi điểm thưởng và trải nghiệm đều thuộc về đúng cửa
              hàng bạn yêu thích.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/member/moc">
                  Mở gian hàng Member <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/admin">Vào Admin</Link>
              </Button>
            </div>
            <p className="mt-4 text-[11px] text-[#9aa69b]">
              Demo mode · Không có thanh toán thật · Member-first responsive experience
            </p>
          </div>
          <DemoWalletCard />
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <RoleCard
            to="/admin"
            icon={<ShieldCheck size={24} />}
            title="Admin"
            text="Duyệt Merchant và giám sát nền tảng."
            tone="bg-[#e5efdf]"
          />
          <RoleCard
            to="/merchant/moc"
            icon={<Storefront size={24} />}
            title="Merchant"
            text="Quản lý cửa hàng, sản phẩm, loyalty và đơn hàng."
            tone="bg-[#f6ebdc]"
          />
          <RoleCard
            to="/member/moc"
            icon={<UserCircle size={24} />}
            title="Member"
            text="Mua sắm, tích điểm và đổi phần thưởng."
            tone="bg-[#e9e4f2]"
          />
        </div>
        <div className="mt-7 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#a2ada1]">
          <ChartLineUp size={15} /> Multi-merchant · Points scoped per store
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#335e3d] text-xl font-extrabold text-[#c9f097]">
        L
      </span>
      <span className="text-2xl font-extrabold tracking-[-.06em] text-[#24452f]">
        loyalty<span className="text-[#89b461]">.</span>
      </span>
      <span className="ml-1 rounded-full bg-[#e8f1e2] px-3 py-1.5 text-[10px] font-bold text-[#527353]">
        COMMERCE PLATFORM
      </span>
    </div>
  );
}

function RoleSummary({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[#f5f7f2] p-4">
      <span className="text-[#55775a]">{icon}</span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 muted">{text}</p>
      </div>
    </div>
  );
}

function DemoWalletCard() {
  return (
    <div className="relative">
      <div className="member-gradient absolute inset-4 rotate-3 rounded-[2.5rem]" />
      <Card className="relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold muted">YOUR LOYALTY WALLET</p>
            <p className="mt-1 text-3xl font-extrabold text-[#294a32]">
              540 <span className="text-base accent">pts</span>
            </p>
          </div>
          <span className="rounded-full bg-[#e7f3dd] px-3 py-1.5 text-xs font-bold text-[#5a7f55]">
            Silver
          </span>
        </div>
        <div className="mt-5 h-2 rounded-full bg-[#edf2e8]">
          <div className="h-full w-2/3 rounded-full bg-[#83aa6c]" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] muted">
          <span>Lifetime points</span>
          <span>1,840 / 2,500</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="aspect-[1.25] rounded-2xl bg-[#f0f4ed] p-4">
            <span className="text-xl">🏺</span>
            <p className="mt-3 text-xs font-bold">Bình gốm Sớm Mai</p>
            <p className="mt-1 text-xs accent">289.000đ</p>
          </div>
          <div className="aspect-[1.25] rounded-2xl bg-[#f7efe6] p-4">
            <span className="text-xl">✦</span>
            <p className="mt-3 text-xs font-bold">Voucher Mộc Studio</p>
            <p className="mt-1 text-xs text-[#ad8151]">200 pts</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#2f583a] p-4 text-white">
          <div>
            <p className="text-[10px] text-white/60">NEXT REWARD</p>
            <p className="mt-1 text-xs font-bold">A little gift for you</p>
          </div>
          <span className="text-xl text-[#cfefa5]">✧</span>
        </div>
      </Card>
    </div>
  );
}

function RoleCard({
  to,
  icon,
  title,
  text,
  tone,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: string;
}) {
  return (
    <Link to={to}>
      <Card className="card-hover flex h-full items-start gap-4 p-5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[#48694d] ${tone}`}>
          {icon}
        </span>
        <span className="flex-1">
          <span className="block font-extrabold text-[#2b4632]">{title}</span>
          <span className="mt-1 block text-xs leading-5 muted">{text}</span>
        </span>
        <ArrowRight size={17} className="mt-1 muted" />
      </Card>
    </Link>
  );
}
