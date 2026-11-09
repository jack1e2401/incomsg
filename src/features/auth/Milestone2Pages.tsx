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
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";

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
  const [decisionNotice, setDecisionNotice] = useState("");
  const [applications, setApplications] = useState<BackendApplicationDto[] | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    application: BackendApplicationDto;
    decision: "approve" | "reject";
  } | null>(null);
  const allApplications = applications ?? resource.data?.applications ?? [];
  const pending = allApplications.filter((application) => application.status === "PENDING");

  async function decide(id: number, decision: "approve" | "reject") {
    if (!accessToken || busyId !== null) return;
    setBusyId(id);
    setActionError("");
    setDecisionNotice("");
    try {
      let resultApplication: BackendApplicationDto;
      if (decision === "approve") {
        const result = await api.approveApplication(id, accessToken);
        resultApplication = result.application;
        setApplications((current) =>
          (current ?? resource.data?.applications ?? []).map((item) =>
            item.id === id ? result.application : item,
          ),
        );
      } else {
        const result = await api.rejectApplication(id, accessToken);
        resultApplication = result.application;
        setApplications((current) =>
          (current ?? resource.data?.applications ?? []).map((item) =>
            item.id === id ? result.application : item,
          ),
        );
      }
      const statusLabel =
        resultApplication.status === "APPROVED"
          ? "Đã duyệt"
          : resultApplication.status === "REJECTED"
            ? "Đã từ chối"
            : "Đang chờ";
      setDecisionNotice(`${statusLabel} ${resultApplication.storeName}.`);
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
        titleClassName="text-2xl tracking-[-0.015em] sm:text-[2.55rem]"
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm muted">{pending.length} cần duyệt</span>
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
      {decisionNotice && (
        <p role="status" className="mb-4 text-sm font-semibold text-[#357044]">
          {decisionNotice}
        </p>
      )}
      {resource.loading && !applications ? (
        <LoadingState cards={2} />
      ) : resource.error && !applications ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : pending.length === 0 ? (
        <EmptyState title="Không có hồ sơ cần xử lý" description="Hàng chờ đã được cập nhật." />
      ) : (
        <section aria-label="Danh sách hồ sơ" className="surface overflow-hidden rounded-[1.5rem]">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_7rem_14rem] items-center gap-4 border-b border-[#e8ece5] bg-[#f7f8f4] px-5 py-4 text-xs font-semibold muted md:grid">
            <span>Cửa hàng</span>
            <span>Mã hồ sơ</span>
            <span>Mã người nộp</span>
            <span>Trạng thái</span>
            <span className="text-right">Thao tác</span>
          </div>
          <div role="list" className="divide-y divide-[#edf0eb]">
            {pending.map((application) => (
              <article
                key={application.id}
                role="listitem"
                className="grid gap-4 px-4 py-5 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#fbfcf9] sm:px-5 md:grid-cols-[minmax(0,1fr)_7rem_8rem_7rem_14rem] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <h2 className="break-words text-base font-bold text-[#294432]">{application.storeName}</h2>
                  <p className="mt-1 text-xs muted md:hidden">
                    Hồ sơ #{application.id} · User #{application.applicantId}
                  </p>
                </div>
                <p className="hidden text-sm muted md:block">#{application.id}</p>
                <p className="hidden text-sm muted md:block">#{application.applicantId}</p>
                <div className="flex items-center justify-between md:justify-start">
                  <span className="text-xs muted md:hidden">Trạng thái</span>
                  <ApplicationStatusText status={application.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex">
                  <Button
                    size="sm"
                    className="w-full whitespace-nowrap md:w-auto"
                    aria-label={`Duyệt ${application.storeName}`}
                    onClick={() => setPendingDecision({ application, decision: "approve" })}
                    disabled={busyId !== null || resource.loading}
                  >
                    {busyId === application.id && pendingDecision?.decision === "approve" ? (
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
                    className="w-full whitespace-nowrap md:w-auto"
                    aria-label={`Từ chối ${application.storeName}`}
                    onClick={() => setPendingDecision({ application, decision: "reject" })}
                    disabled={busyId !== null || resource.loading}
                  >
                    {busyId === application.id && pendingDecision?.decision === "reject" ? (
                      <BusyLabel>Đang xử lý</BusyLabel>
                    ) : (
                      <>
                        <XCircle size={15} /> Từ chối
                      </>
                    )}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
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
