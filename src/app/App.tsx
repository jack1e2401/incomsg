import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthSessionProvider, useAuthSession } from "../api/auth-session";
import { Button, Card, PageHeader, ErrorState, LoadingState, EmptyState } from "../components/ui";
import { ApplicationStatusPage, LoginPage, RegisterPage } from "../features/auth/AuthPages";
import { LoyaltyIllustration } from "../components/LoyaltyIllustration";
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
import { createCommerceClient } from "../api/commerce-http";
import { useResource } from "../api/useResource";
import {
  MerchantLoyalty,
  MerchantOrders,
  MerchantOverview,
  MerchantProducts,
  MerchantRewards,
  MerchantStore,
  MerchantVouchers,
} from "../features/merchant/BackendMerchantPages";
import {
  BackendMemberLayout,
  MemberCart,
  MemberCheckout,
  MemberLanding,
  MemberOrderResult,
  MemberOrders,
  MemberProduct,
  MemberRewards,
  MemberStorefront,
  MemberVouchers,
  MemberWallet,
} from "../features/member/BackendMemberPages";

const useBackend = import.meta.env.VITE_API_MODE === "http";

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
          <Route path="rewards" element={<MerchantRewards />} />
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
    <main className="mx-auto max-w-4xl p-8">
      <PageHeader title="Loyalty commerce demo" description="Demo mode · dữ liệu mẫu chạy offline" />
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/member/moc">Mở trải nghiệm Member</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/merchant/moc">Mở Merchant</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin">Mở Admin</Link>
        </Button>
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
    <main className="min-h-[100dvh] overflow-hidden bg-[#f7f8f4] px-5 pb-12 pt-7 sm:px-8 sm:pb-16 sm:pt-9">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-[-.06em] text-[#24452f]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#335e3d] text-lg text-[#c9f097]">
              L
            </span>
            loyalty<span className="text-[#89b461]">.</span>
          </Link>
          <Link
            to="/application/status"
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#54725a] transition-colors duration-300 hover:bg-white hover:text-[#24452f]"
          >
            Trạng thái hồ sơ
          </Link>
        </header>

        <section className="grid min-h-[calc(100dvh-7rem)] items-center gap-10 py-12 md:gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:py-8">
          <div className="relative z-10 max-w-2xl">
            <h1 className="serif text-[clamp(3.25rem,7.5vw,6.5rem)] leading-[.98] tracking-[-.055em] text-[#24452f]">
              Mỗi cửa hàng,
              <span className="mt-2 block text-[#83a969]">một hành trình</span>
              thân thiết.
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[#738276] sm:text-lg sm:leading-8">
              Mua sắm và nhận ưu đãi từ những cửa hàng bạn yêu thích.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="group rounded-full px-6 shadow-[0_12px_28px_rgba(47,88,58,.16)] transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98]"
              >
                <Link to="/login">
                  Đăng nhập{" "}
                  <span
                    aria-hidden="true"
                    className="ml-2 transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[#dce6d7] bg-white/70 px-6 transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98]"
              >
                <Link to="/register">Tạo tài khoản</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem] lg:mr-0">
            <div className="absolute -inset-5 rotate-[-4deg] rounded-[2.75rem] bg-[#e7eedf] sm:-inset-7" />
            <div className="relative aspect-[.92] overflow-hidden rounded-[2.4rem] bg-[#31583a] p-3 shadow-[0_32px_80px_rgba(47,88,58,.16)] sm:rounded-[2.8rem] sm:p-4">
              <div className="relative h-full overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_50%_36%,rgba(194,228,163,.26),transparent_55%),linear-gradient(145deg,#31583a,#24452f)] sm:rounded-[2.3rem]">
                <div className="absolute left-[12%] top-[14%] h-24 w-24 rounded-full border border-white/10" />
                <div className="absolute right-[9%] top-[23%] h-14 w-14 rounded-full border border-[#c9f097]/25" />
                <div className="absolute bottom-[12%] left-[12%] h-px w-[76%] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="absolute inset-[10%]">
                  <LoyaltyIllustration />
                </div>
                <div className="absolute bottom-[8%] right-[8%] h-16 w-16 rounded-[1.35rem] bg-[#c9f097] shadow-[0_16px_32px_rgba(13,38,20,.18)] sm:h-20 sm:w-20 sm:rounded-[1.7rem]" />
                <div className="absolute bottom-[12%] right-[12%] h-8 w-8 rounded-full border-[5px] border-[#31583a] sm:h-10 sm:w-10" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminOverview() {
  const { accessToken } = useAuthSession();
  const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
  const resource = useResource(
    () => api.getAdminDashboard(accessToken!).then(({ stats }) => stats),
    [accessToken],
  );
  return (
    <>
      <PageHeader title="Tổng quan" />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm muted">Cửa hàng</p>
            <p className="mt-2 text-2xl font-extrabold">{resource.data.merchants}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm muted">Hồ sơ chờ duyệt</p>
            <p className="mt-2 text-2xl font-extrabold">{resource.data.pendingApplications}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm muted">Đơn đã thanh toán</p>
            <p className="mt-2 text-2xl font-extrabold">{resource.data.paidOrders}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm muted">Tổng doanh thu</p>
            <p className="mt-2 text-2xl font-extrabold">
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
              }).format(Number(resource.data.totalVolume))}
            </p>
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-sm muted">Chưa có số liệu.</Card>
      )}
      <Card className="mt-5 p-6">
        <Button asChild className="mt-5">
          <Link to="/admin/applications">Mở hàng chờ duyệt</Link>
        </Button>
      </Card>
    </>
  );
}

function AdminMerchants() {
  const { accessToken } = useAuthSession();
  const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
  const resource = useResource(
    () => api.listAdminMerchants(accessToken!).then(({ merchants }) => merchants),
    [accessToken],
  );
  return (
    <>
      <PageHeader title="Danh sách cửa hàng" />
      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState title="Chưa có cửa hàng" description="Danh sách cửa hàng sẽ xuất hiện tại đây." />
      ) : (
        <div className="space-y-3">
          {resource.data.map((merchant) => (
            <Card key={merchant.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <h2 className="font-extrabold">{merchant.name}</h2>
                <p className="mt-1 text-xs muted">
                  {merchant.slug} · #{merchant.id}
                </p>
              </div>
              <span className="text-xs font-bold">
                {merchant.isActive === false ? "Tạm ngưng" : "Hoạt động"}
              </span>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
