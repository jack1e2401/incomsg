import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthSessionProvider, useAuthSession } from "../api/auth-session";
import { Button } from "../components/ui";
import { ApplicationStatusPage, LoginPage, RegisterPage } from "../features/auth/AuthPages";
import { EditorialArtPanel } from "../components/EditorialArtPanel";
import { AdminApplicationsM2, RequireRole } from "../features/auth/Milestone2Pages";
import { BackendConsoleLayout } from "../layouts/BackendConsoleLayout";
import { ApiProvider } from "../api/client";
import { ConsoleLayout as DemoConsoleLayout } from "../layouts/ConsoleLayout";
import { MemberLayout as DemoMemberLayout } from "../layouts/MemberLayout";
import {
  AdminApplications as DemoAdminApplications,
  AdminMerchants as DemoAdminMerchants,
  AdminOverview as DemoAdminOverview,
} from "../features/admin/AdminPages";
import {
  MerchantLoyalty as DemoMerchantLoyalty,
  MerchantOrders as DemoMerchantOrders,
  MerchantOverview as DemoMerchantOverview,
  MerchantProducts as DemoMerchantProducts,
  MerchantRewards as DemoMerchantRewards,
  MerchantStore as DemoMerchantStore,
  MerchantVouchers as DemoMerchantVouchers,
} from "../features/merchant/MerchantPages";
import {
  MemberCart as DemoMemberCart,
  MemberCheckout as DemoMemberCheckout,
  MemberProduct as DemoMemberProduct,
  MemberStorefront as DemoMemberStorefront,
} from "../features/member/MemberShop";
import {
  MemberOrderResult as DemoMemberOrderResult,
  MemberOrders as DemoMemberOrders,
  MemberRewards as DemoMemberRewards,
  MemberVouchers as DemoMemberVouchers,
  MemberWallet as DemoMemberWallet,
} from "../features/member/MemberLoyalty";
import {
  AdminOverview,
  AdminMerchants,
  AdminUsers,
  AdminBlacklist,
  AdminAuditLogs,
  AdminAbuseReports,
} from "../features/admin/BackendAdminPages";
import {
  MerchantLoyalty,
  MerchantOrders,
  MerchantOverview,
  MerchantProducts,
  MerchantStore,
  MerchantVouchers,
} from "../features/merchant/BackendMerchantPages";
import {
  BackendMemberLayout,
  MemberCart,
  MemberCheckout,
  MemberOrderResult,
  MemberOrders,
  MemberProduct,
  MemberRewards,
  MemberStorefront,
  MemberVouchers,
  MemberWallet,
} from "../features/member/BackendMemberPages";
import { MemberLanding } from "../features/member/MemberLanding";

// Production and local development use real endpoints. Fixtures are opt-in only.
const useBackend = import.meta.env.VITE_API_MODE !== "mock";

export function App() {
  return <AuthSessionProvider>{useBackend ? <BackendRoutes /> : <DemoRoutes />}</AuthSessionProvider>;
}

function BackendRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/application/status" element={<ApplicationStatusPage />} />
      <Route element={<RequireRole role="ADMIN" />}>
        <Route path="/admin" element={<BackendConsoleLayout role="admin" />}>
          <Route index element={<AdminOverview />} />
          <Route path="applications" element={<AdminApplicationsM2 />} />
          <Route path="merchants" element={<AdminMerchants />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="blacklist" element={<AdminBlacklist />} />
          <Route path="email-blacklist" element={<AdminBlacklist />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="abuse-reports" element={<AdminAbuseReports />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="MERCHANT" />}>
        <Route path="/merchant" element={<BackendConsoleLayout role="merchant" />}>
          <Route index element={<MerchantOverview />} />
          <Route path="store" element={<MerchantStore />} />
          <Route path="products" element={<MerchantProducts />} />
          <Route path="orders" element={<MerchantOrders />} />
          <Route path="loyalty" element={<MerchantLoyalty />} />
          <Route path="vouchers" element={<MerchantVouchers />} />
          <Route path="rewards" element={<Navigate to="/merchant/orders" replace />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="MEMBER" />}>
        <Route path="/member" element={<MemberLanding />} />
        <Route path="/member/:merchantId" element={<BackendMemberLayout />}>
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function DemoRoutes() {
  return (
    <ApiProvider>
      <Routes>
        <Route path="/" element={<DemoWelcome />} />
        <Route path="/admin" element={<DemoConsoleLayout role="admin" />}>
          <Route index element={<DemoAdminOverview />} />
          <Route path="applications" element={<DemoAdminApplications />} />
          <Route path="merchants" element={<DemoAdminMerchants />} />
        </Route>
        <Route path="/merchant/:merchantId" element={<DemoConsoleLayout role="merchant" />}>
          <Route index element={<DemoMerchantOverview />} />
          <Route path="store" element={<DemoMerchantStore />} />
          <Route path="products" element={<DemoMerchantProducts />} />
          <Route path="orders" element={<DemoMerchantOrders />} />
          <Route path="loyalty" element={<DemoMerchantLoyalty />} />
          <Route path="vouchers" element={<DemoMerchantVouchers />} />
          <Route path="rewards" element={<DemoMerchantRewards />} />
        </Route>
        <Route path="/member/:merchantId" element={<DemoMemberLayout />}>
          <Route index element={<DemoMemberStorefront />} />
          <Route path="product/:productId" element={<DemoMemberProduct />} />
          <Route path="cart" element={<DemoMemberCart />} />
          <Route path="checkout" element={<DemoMemberCheckout />} />
          <Route path="wallet" element={<DemoMemberWallet />} />
          <Route path="vouchers" element={<DemoMemberVouchers />} />
          <Route path="rewards" element={<DemoMemberRewards />} />
          <Route path="orders" element={<DemoMemberOrders />} />
          <Route path="orders/:orderId" element={<DemoMemberOrderResult />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ApiProvider>
  );
}

function DemoWelcome() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#f5f5ef] px-5 py-6 sm:px-9 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <LandingHeader demo />
        <LandingBody>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/member/moc">
                Trải nghiệm Member <span aria-hidden="true">→</span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/merchant/moc">Merchant</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full px-7">
              <Link to="/admin">Admin</Link>
            </Button>
          </div>
        </LandingBody>
      </div>
    </main>
  );
}

function Welcome() {
  const { user } = useAuthSession();
  if (user)
    return (
      <Navigate
        to={user.role === "ADMIN" ? "/admin" : user.role === "MERCHANT" ? "/merchant" : "/member"}
        replace
      />
    );
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#f5f5ef] px-5 py-6 sm:px-9 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <LandingHeader />
        <LandingBody>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="group rounded-full px-7">
              <Link to="/login">
                Đăng nhập{" "}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/register">Tạo tài khoản</Link>
            </Button>
          </div>
        </LandingBody>
      </div>
    </main>
  );
}

function LandingHeader({ demo = false }: { demo?: boolean }) {
  return (
    <header className="flex h-12 items-center justify-between">
      <Link
        to="/"
        className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-.06em] text-[#24452f]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#335e3d] text-lg text-[#c9f097]">
          L
        </span>
        loyalty<span className="text-[#89b461]">.</span>
      </Link>
      {demo ? (
        <span className="text-sm font-medium text-[#55705b]">Mua sắm thân quen</span>
      ) : (
        <Link to="/application/status" className="text-sm font-semibold text-[#55705b] hover:text-[#24452f]">
          Trạng thái hồ sơ
        </Link>
      )}
    </header>
  );
}

function LandingBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid min-h-[calc(100dvh-6rem)] items-center gap-9 py-10 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:py-8">
      <div className="relative z-10 max-w-[36rem] lg:py-12">
        <h1 className="serif max-w-[11ch] text-[clamp(3.5rem,7.4vw,6.8rem)] leading-[.94] tracking-[-.06em] text-[#24452f]">
          Mua ở nơi bạn yêu.
          <span className="mt-2 block text-[#77975e]">Quay lại vì được nhớ.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-[#65766a] sm:text-lg sm:leading-8">
          Tích điểm và nhận ưu đãi riêng tại từng cửa hàng thân quen.
        </p>
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative mx-auto w-full max-w-[39rem] lg:mr-0">
        <div className="absolute -inset-4 -rotate-2 rounded-[2.4rem] bg-[#dfe8d5] sm:-inset-6 sm:rounded-[3rem]" />
        <EditorialArtPanel className="rounded-[2rem] shadow-[0_28px_70px_rgba(38,63,43,.18)] sm:rounded-[2.6rem]" />
      </div>
    </section>
  );
}
