import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, SignOut, Storefront, UsersThree, XCircle } from "@phosphor-icons/react";
import { useResource } from "../../api/useResource";
import { useAuthSession } from "../../api/auth-session";
import { createMilestone2Client } from "../../api/milestone2-client";
import type { BackendApplicationDto, BackendRole } from "../../api/contracts/milestone2";
import {
  Badge,
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { shortDate } from "../../lib/utils";

export function RequireRole({ role }: { role: BackendRole }) {
  const { user } = useAuthSession();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role)
    return (
      <Navigate
        to={
          user.role === "ADMIN" ? "/admin/applications" : user.role === "MERCHANT" ? "/merchant" : "/member"
        }
        replace
      />
    );
  return <Outlet />;
}

export function Milestone2Workspace({ role }: { role: BackendRole }) {
  const { user, logout } = useAuthSession();
  const navigate = useNavigate();
  const home = role === "ADMIN" ? "/admin/applications" : role === "MERCHANT" ? "/merchant" : "/member";
  const title =
    role === "ADMIN" ? "Quản trị hệ thống" : role === "MERCHANT" ? "Merchant workspace" : "Member account";

  return (
    <div className="min-h-[100dvh] bg-[#f7f8f4]">
      <header className="sticky top-0 z-10 border-b border-[#e5ebe3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-17 max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <NavLink to={home} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#335e3d] font-extrabold text-[#c9f097]">
              L
            </span>
            <span className="font-extrabold text-[#24452f]">
              loyalty<span className="text-[#89b461]">.</span>
            </span>
          </NavLink>
          <div className="flex min-w-0 items-center gap-3">
            <Badge tone="green" className="hidden sm:inline-flex">
              Backend API · M2
            </Badge>
            <div className="min-w-0 text-right">
              <p className="truncate text-xs font-bold text-[#36533c]">{user?.email}</p>
              <p className="text-[10px] muted">{title}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f0f4ed] text-[#46664c]"
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminApplicationsM2() {
  const { accessToken } = useAuthSession();
  const api = createMilestone2Client(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
  const resource = useResource(() => api.listPendingApplications(accessToken!), [accessToken]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [applications, setApplications] = useState<BackendApplicationDto[] | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    application: BackendApplicationDto;
    decision: "approve" | "reject";
  } | null>(null);
  const pending = applications ?? resource.data?.applications ?? [];

  async function decide(id: number, decision: "approve" | "reject") {
    if (!accessToken || busyId !== null) return;
    setBusyId(id);
    setActionError("");
    try {
      if (decision === "approve") {
        const result = await api.approveApplication(id, accessToken);
        setApplications((current) =>
          (current ?? resource.data?.applications ?? []).map((item) =>
            item.id === id ? result.application : item,
          ),
        );
      } else {
        const result = await api.rejectApplication(id, accessToken);
        setApplications((current) =>
          (current ?? resource.data?.applications ?? []).map((item) =>
            item.id === id ? result.application : item,
          ),
        );
      }
      setPendingDecision(null);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Không xử lý được hồ sơ. Thử tải lại danh sách.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin / Merchant onboarding"
        title="Duyệt hồ sơ cửa hàng"
        description="Danh sách và trạng thái được tải từ API. Thao tác duyệt/từ chối được lưu trực tiếp bởi backend."
        action={
          <div className="flex items-center gap-2">
            <Badge tone="amber">{pending.filter((item) => item.status === "PENDING").length} đang chờ</Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={resource.loading}
              onClick={() => {
                setApplications(null);
                resource.reload();
              }}
            >
              Làm mới
            </Button>
          </div>
        }
      />
      {actionError && (
        <p role="alert" className="mb-4 rounded-xl bg-[#fae7e3] p-3 text-sm text-[#a4473a]">
          {actionError}
        </p>
      )}
      {resource.loading && !applications ? (
        <LoadingState cards={2} />
      ) : resource.error && !applications ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : pending.length === 0 ? (
        <EmptyState
          title="Không có hồ sơ đang chờ"
          description="Hồ sơ Merchant mới sẽ xuất hiện tại đây sau khi được gửi."
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <section className="space-y-3" aria-label="Danh sách hồ sơ">
            {pending.map((application) => (
              <Card key={application.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">{application.storeName}</p>
                    <p className="mt-1 text-xs muted">
                      Hồ sơ #{application.id} · User #{application.applicantId}
                    </p>
                  </div>
                  <ApplicationBadge status={application.status} />
                </div>
                {application.reviewedAt && (
                  <p className="mt-3 text-[11px] muted">
                    Đã xét duyệt {shortDate(application.reviewedAt.slice(0, 10))}
                  </p>
                )}
                {application.status === "PENDING" && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setPendingDecision({ application, decision: "approve" })}
                      disabled={busyId !== null || resource.loading}
                    >
                      {busyId === application.id ? (
                        <BusyLabel>Đang duyệt</BusyLabel>
                      ) : (
                        <>
                          <CheckCircle size={15} /> Duyệt
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingDecision({ application, decision: "reject" })}
                      disabled={busyId !== null || resource.loading}
                    >
                      <XCircle size={15} /> Từ chối
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </section>
          <Card className="p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4e9] text-[#4b754f]">
              <Storefront size={24} />
            </span>
            <h2 className="mt-5 text-xl font-extrabold">Quy tắc xét duyệt M2</h2>
            <p className="mt-2 text-sm leading-6 muted">
              Approve tạo Merchant và kích hoạt tài khoản trong cùng transaction. Reject giữ tài khoản
              Merchant inactive. API không trả email, tên người đăng ký hoặc ghi chú hồ sơ, nên giao diện chỉ
              hiển thị dữ liệu thật có trong DTO.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f4f7f1] p-4">
              <UsersThree size={20} className="text-[#628267]" />
              <p className="text-xs leading-5 text-[#607065]">
                Đăng nhập lại bằng Merchant đã duyệt để API cấp quyền truy cập `/api/merchant/me`.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[11px] muted">
              <Clock size={15} /> Mọi thay đổi chỉ được xác nhận sau response backend.
            </div>
          </Card>
        </div>
      )}
      <ConfirmActionDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDecision(null);
        }}
        title={pendingDecision?.decision === "approve" ? "Duyệt hồ sơ Merchant?" : "Từ chối hồ sơ Merchant?"}
        description={
          pendingDecision?.decision === "approve"
            ? `Duyệt ${pendingDecision.application.storeName} sẽ tạo cửa hàng và kích hoạt tài khoản Merchant trong backend.`
            : `Từ chối ${pendingDecision?.application.storeName ?? "hồ sơ này"} sẽ giữ tài khoản Merchant ở trạng thái chưa hoạt động.`
        }
        confirmLabel={pendingDecision?.decision === "approve" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
        destructive={pendingDecision?.decision === "reject"}
        busy={pendingDecision !== null && busyId === pendingDecision.application.id}
        error={actionError}
        onConfirm={() => {
          if (pendingDecision) void decide(pendingDecision.application.id, pendingDecision.decision);
        }}
      />
    </>
  );
}

export function MerchantHomeM2() {
  const { accessToken, user } = useAuthSession();
  const api = createMilestone2Client(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
  const resource = useResource(() => api.getOwnMerchant(accessToken!), [accessToken]);

  if (resource.loading) return <LoadingState cards={1} />;
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
  if (!resource.data) return null;
  const merchant = resource.data.merchant;

  return (
    <>
      <PageHeader
        eyebrow="Merchant / Cửa hàng của bạn"
        title={merchant.name}
        description="Đây là cửa hàng backend gắn với tài khoản Merchant đang đăng nhập."
        action={
          <Badge tone={merchant.isActive ? "green" : "amber"}>
            {merchant.isActive ? "Đang hoạt động" : "Chưa hoạt động"}
          </Badge>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-bold muted">TÊN CỬA HÀNG</p>
          <p className="mt-3 text-lg font-extrabold">{merchant.name}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold muted">SLUG BACKEND</p>
          <p className="mt-3 text-lg font-extrabold">{merchant.slug}</p>
        </Card>
      </div>
      <Card className="mt-5 p-6 sm:p-8">
        <h2 className="text-lg font-extrabold">Đã kết nối cửa hàng riêng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 muted">
          API đã xác thực role Merchant và trả cửa hàng theo owner ID trong token. Catalog, đơn hàng, cấu hình
          loyalty, voucher và trao thưởng sẽ mở tại đây khi endpoint của các milestone tiếp theo sẵn sàng.
        </p>
        <p className="mt-4 text-xs text-[#718173]">Đăng nhập: {user?.email}</p>
      </Card>
    </>
  );
}

export function MemberHomeM2() {
  const { user } = useAuthSession();
  return (
    <>
      <PageHeader
        eyebrow="Member / Account"
        title="Tài khoản đã xác thực"
        description="Backend M2 đã tạo tài khoản Member active và xác nhận phiên đăng nhập này."
        action={<Badge tone="green">MEMBER · Active</Badge>}
      />
      <Card className="p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4e9] text-[#4b754f]">
          <CheckCircle size={24} />
        </span>
        <h2 className="mt-5 text-lg font-extrabold">{user?.email}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 muted">
          Ví điểm, tier theo Merchant, storefront và voucher chưa thuộc API Milestone 2. FE sẽ bật các màn này
          khi backend triển khai endpoint commerce tương ứng.
        </p>
      </Card>
    </>
  );
}

function ApplicationBadge({ status }: { status: BackendApplicationDto["status"] }) {
  const tone = status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : "amber";
  const label = status === "APPROVED" ? "Đã duyệt" : status === "REJECTED" ? "Đã từ chối" : "Đang chờ";
  return <Badge tone={tone}>{label}</Badge>;
}
