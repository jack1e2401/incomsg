import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { useResource } from "../../api/useResource";
import { useAuthSession } from "../../api/auth-session";
import { createMilestone2Client } from "../../api/milestone2-client";
import type { BackendApplicationDto, BackendRole } from "../../api/contracts/milestone2";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
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
        title="Duyệt hồ sơ cửa hàng"
        description="Xét duyệt các cửa hàng đăng ký mới."
        action={
          <div className="flex items-center gap-2">
            <StatusText tone="amber">
              {pending.filter((item) => item.status === "PENDING").length} đang chờ
            </StatusText>
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
        <div className="grid items-start gap-5">
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
                  <ApplicationStatusText status={application.status} />
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
            ? `Duyệt ${pendingDecision.application.storeName} sẽ kích hoạt cửa hàng và tài khoản Merchant.`
            : `Từ chối ${pendingDecision?.application.storeName ?? "hồ sơ này"} sẽ khóa tài khoản Merchant.`
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

function ApplicationStatusText({ status }: { status: BackendApplicationDto["status"] }) {
  const tone = status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : "amber";
  const label = status === "APPROVED" ? "Đã duyệt" : status === "REJECTED" ? "Đã từ chối" : "Đang chờ";
  return <StatusText tone={tone}>{label}</StatusText>;
}
