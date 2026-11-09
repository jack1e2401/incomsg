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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    application: BackendApplicationDto;
    decision: "approve" | "reject";
  } | null>(null);
  const allApplications = applications ?? resource.data?.applications ?? [];
  const pending = allApplications.filter((application) => application.status === "PENDING");
  const selected = pending.find((application) => application.id === selectedId) ?? pending[0] ?? null;

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
      setSelectedId(null);
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
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
          <section className="surface overflow-hidden rounded-[1.5rem]" aria-label="Danh sách hồ sơ">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <thead className="border-b border-[#e8ece5] bg-[#f7f8f4] text-xs muted">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Cửa hàng</th>
                    <th className="px-5 py-4 font-semibold">Mã hồ sơ</th>
                    <th className="px-5 py-4 font-semibold">Trạng thái</th>
                    <th className="px-5 py-4">
                      <span className="sr-only">Chọn</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {pending.map((application) => (
                    <tr
                      key={application.id}
                      className={selected?.id === application.id ? "bg-[#f4f7f0]" : "bg-white"}
                    >
                      <td className="px-5 py-4 font-bold text-[#294432]">{application.storeName}</td>
                      <td className="px-5 py-4 text-sm muted">#{application.id}</td>
                      <td className="px-5 py-4">
                        <ApplicationStatusText status={application.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="text-sm font-bold text-[#416d48] hover:text-[#24452f]"
                          onClick={() => setSelectedId(application.id)}
                          aria-label={`Xem ${application.storeName}`}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {selected && (
            <Card className="p-6 sm:p-7">
              <p className="text-sm muted">Hồ sơ #{selected.id}</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#294432]">
                {selected.storeName}
              </h2>
              <p className="mt-4 text-sm muted">
                Trạng thái: <ApplicationStatusText status={selected.status} />
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Button
                  onClick={() => setPendingDecision({ application: selected, decision: "approve" })}
                  disabled={busyId !== null || resource.loading}
                >
                  {busyId === selected.id ? (
                    <BusyLabel>Đang duyệt</BusyLabel>
                  ) : (
                    <>
                      <CheckCircle size={16} /> Duyệt
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPendingDecision({ application: selected, decision: "reject" })}
                  disabled={busyId !== null || resource.loading}
                >
                  <XCircle size={16} /> Từ chối
                </Button>
              </div>
            </Card>
          )}
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
