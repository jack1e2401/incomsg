import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, LockKey, Storefront, UserCircle } from "@phosphor-icons/react";
import { createMilestone2Client } from "../../api/milestone2-client";
import { useAuthSession, routeForRole } from "../../api/auth-session";
import { Badge, Button, BusyLabel, Card, Field, Input } from "../../components/ui";

const authApi = createMilestone2Client(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function explainAuthError(message: string) {
  const explanations: Record<string, string> = {
    INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
    MERCHANT_PENDING: "Hồ sơ cửa hàng đang chờ Admin duyệt. Bạn sẽ đăng nhập được sau khi được duyệt.",
    MERCHANT_REJECTED: "Hồ sơ đăng ký chưa được chấp thuận. Liên hệ đội hỗ trợ nếu cần biết thêm.",
    ACCOUNT_INACTIVE: "Tài khoản đang bị vô hiệu hóa.",
  };
  return explanations[message] ?? message;
}

function AuthFrame({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-[100dvh] bg-[#f7f8f4] lg:grid-cols-[.85fr_1.15fr]">
      <section className="relative hidden overflow-hidden bg-[#23442e] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-3 text-xl font-extrabold">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c4f093] text-[#24442c]">L</span>
          loyalty.
        </Link>
        <div className="relative z-1 max-w-lg">
          <Badge tone="green" className="bg-white/10 text-[#cde9b2]">
            MILESTONE 2 · AUTH & MERCHANT APPROVAL
          </Badge>
          <h1 className="serif mt-6 text-5xl leading-tight">Một tài khoản, đúng vai trò, đúng cửa hàng.</h1>
          <p className="mt-5 text-sm leading-7 text-white/65">
            Đăng nhập và phân quyền được xác nhận bởi backend. Hồ sơ Merchant cần Admin duyệt trước khi kích
            hoạt.
          </p>
        </div>
        <p className="text-xs text-white/45">Loyalty Commerce · Kết nối API backend</p>
        <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-[#71985c]/30 blur-3xl" />
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-[#55715a]">
            <ArrowLeft size={16} /> Về trang đầu
          </Link>
          <Card className="p-6 sm:p-9">
            <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#6d9b6c]">
              Loyalty Commerce · M2
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#20392a]">{title}</h2>
            <p className="mt-2 text-sm leading-6 muted">{description}</p>
            <div className="mt-7">{children}</div>
          </Card>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const { user, login } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={routeForRole(user.role)} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login({ email, password });
      navigate(routeForRole(result.user.role), { replace: true });
    } catch (reason) {
      setError(explainAuthError(reason instanceof Error ? reason.message : "Không thể đăng nhập."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Đăng nhập"
      description="Dùng tài khoản đã đăng ký. Quyền truy cập được cấp theo role từ backend."
    >
      {searchParams.get("registered") === "member" && (
        <p role="status" className="mb-4 rounded-xl bg-[#edf4e9] p-3 text-sm text-[#376743]">
          Tài khoản Member đã được tạo. Đăng nhập để tiếp tục.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            maxLength={191}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
          />
        </Field>
        <Field label="Mật khẩu">
          <Input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-sm leading-6 text-[#a4473a]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (
            <BusyLabel>Đang xác thực</BusyLabel>
          ) : (
            <>
              Đăng nhập <ArrowRight size={17} />
            </>
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm muted">
        Chưa có tài khoản?{" "}
        <Link className="font-bold accent" to="/register">
          Tạo tài khoản Member hoặc Merchant
        </Link>
      </p>
      <p className="mt-5 flex items-center justify-center gap-2 text-[11px] muted">
        <LockKey size={14} /> Token và role do API cấp sau khi đăng nhập thành công.
      </p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const [role, setRole] = useState<"MEMBER" | "MERCHANT">("MEMBER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingApplication, setPendingApplication] = useState<{
    storeName: string;
    applicationId: number;
  } | null>(null);
  const [registeredMember, setRegisteredMember] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (role === "MEMBER") {
        await authApi.registerMember({ email, password });
        setRegisteredMember(email);
        return;
      }
      const result = await authApi.registerMerchant({ email, password, storeName: name });
      setPendingApplication({
        storeName: result.application.storeName,
        applicationId: result.application.id,
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể tạo tài khoản.";
      setError(message === "EMAIL_TAKEN" ? "Email này đã được đăng ký." : message);
    } finally {
      setBusy(false);
    }
  }

  if (registeredMember) {
    return (
      <AuthFrame title="Tài khoản đã sẵn sàng" description="Backend đã tạo tài khoản Member active.">
        <div className="rounded-2xl bg-[#edf4e9] p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#4c8054]">
            <CheckCircle size={23} />
          </span>
          <h3 className="mt-4 text-lg font-extrabold">Đăng ký thành công</h3>
          <p className="mt-2 text-sm leading-6 text-[#5d715f]">
            {registeredMember} đã được tạo bằng API. Đăng nhập để tiếp tục.
          </p>
        </div>
        <Link
          to="/login?registered=member"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#335e3d] text-sm font-bold text-white"
        >
          Đăng nhập <ArrowRight size={16} />
        </Link>
      </AuthFrame>
    );
  }

  if (pendingApplication) {
    return (
      <AuthFrame title="Đã gửi hồ sơ" description="Backend đã nhận đăng ký Merchant của bạn.">
        <div className="rounded-2xl bg-[#edf4e9] p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#4c8054]">
            <CheckCircle size={23} />
          </span>
          <h3 className="mt-4 text-lg font-extrabold">{pendingApplication.storeName}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5d715f]">
            Hồ sơ #{pendingApplication.applicationId} đang chờ Admin duyệt. Merchant chưa thể đăng nhập hoặc
            quản lý cửa hàng khi trạng thái còn PENDING.
          </p>
        </div>
        <Link
          to="/login"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#335e3d] text-sm font-bold text-white"
        >
          Về đăng nhập <ArrowRight size={16} />
        </Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Tạo tài khoản"
      description="Member có thể dùng ngay. Merchant gửi hồ sơ để Admin xét duyệt."
    >
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0f4ed] p-1.5">
        <RoleOption
          selected={role === "MEMBER"}
          icon={<UserCircle size={18} />}
          label="Member"
          onClick={() => setRole("MEMBER")}
        />
        <RoleOption
          selected={role === "MERCHANT"}
          icon={<Storefront size={18} />}
          label="Merchant"
          onClick={() => setRole("MERCHANT")}
        />
      </div>
      {role === "MERCHANT" && (
        <div className="mb-4 rounded-xl bg-[#fff4df] p-3 text-xs leading-5 text-[#836337]">
          Sau khi gửi hồ sơ, chờ Admin phê duyệt. Tài khoản chưa hoạt động trước khi được duyệt.
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        {role === "MERCHANT" && (
          <Field label="Tên cửa hàng">
            <Input
              required
              minLength={1}
              maxLength={191}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tên cửa hàng của bạn"
            />
          </Field>
        )}
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            maxLength={191}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
          />
        </Field>
        <Field label="Mật khẩu" hint="Từ 12 đến 128 ký tự.">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tạo mật khẩu mạnh"
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-sm text-[#a4473a]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (
            <BusyLabel>Đang gửi</BusyLabel>
          ) : role === "MEMBER" ? (
            "Tạo tài khoản Member"
          ) : (
            "Gửi hồ sơ Merchant"
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm muted">
        Đã có tài khoản?{" "}
        <Link className="font-bold accent" to="/login">
          Đăng nhập
        </Link>
      </p>
    </AuthFrame>
  );
}

function RoleOption({
  selected,
  icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${selected ? "bg-white text-[#31563a] shadow-sm" : "text-[#79877b] hover:text-[#31563a]"}`}
    >
      {icon}
      {label}
    </button>
  );
}
