import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Storefront,
  TrendUp,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react";
import { useApi } from "../../api/client";
import { useResource } from "../../api/useResource";
import type { Application } from "../../api/types";
import {
  StatusText,
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "../../components/ui";
import { money, shortDate } from "../../lib/utils";

const applicationStatus = (status: Application["status"]) =>
  status === "PENDING" ? (
    <StatusText tone="amber">Đang chờ</StatusText>
  ) : status === "APPROVED" ? (
    <StatusText tone="green">Đã duyệt</StatusText>
  ) : (
    <StatusText tone="red">Đã từ chối</StatusText>
  );

export function AdminOverview() {
  const api = useApi();
  const stats = useResource(() => api.getDashboardStats(), []);
  const apps = useResource(() => api.listApplications(), []);
  const orders = useResource(() => api.listOrders(), []);
  if (stats.loading || apps.loading || orders.loading) return <LoadingState cards={4} />;
  if (stats.error || apps.error || orders.error)
    return (
      <ErrorState
        message={stats.error ?? apps.error ?? orders.error ?? "Lỗi dữ liệu"}
        retry={() => {
          stats.reload();
          apps.reload();
          orders.reload();
        }}
      />
    );
  const s = stats.data!;
  return (
    <>
      <PageHeader
        title="Tổng quan hệ thống"
        description="Theo dõi hoạt động cửa hàng, đơn hàng và hồ sơ đang chờ xử lý."
        action={
          <Button asChild>
            <Link to="/admin/applications">
              Duyệt hồ sơ <ArrowRight size={17} />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cửa hàng hoạt động"
          value={s.merchants}
          icon={<Storefront size={20} weight="light" />}
          note="Đã được Admin duyệt"
        />
        <StatCard
          label="Hồ sơ đang chờ"
          value={s.pendingApplications}
          icon={<UsersThree size={20} weight="light" />}
          note="Cần xem xét"
        />
        <StatCard
          label="Đơn đã thanh toán"
          value={s.paidOrders}
          icon={<CheckCircle size={20} weight="light" />}
          note="Chỉ tính trạng thái PAID"
        />
        <StatCard
          label="Doanh số"
          value={money(s.totalVolume)}
          icon={<TrendUp size={20} weight="light" />}
          note="Từ đơn đã thanh toán"
        />
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#edf1ea] p-6">
            <div>
              <h2 className="text-lg font-extrabold">Đơn hàng gần đây</h2>
              <p className="mt-1 text-xs muted">Toàn bộ cửa hàng</p>
            </div>
          </div>
          <div className="divide-y divide-[#eef1ec]">
            {orders.data?.slice(0, 4).map((o) => (
              <div key={o.id} className="flex items-center gap-4 px-6 py-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff4e9] text-[#5b795e]">
                  <Storefront size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {o.id} <span className="font-medium muted">· {o.memberName}</span>
                  </p>
                  <p className="mt-1 text-xs muted">
                    {shortDate(o.createdAt)} · {o.merchantId === "moc" ? "Mộc Studio" : "Hikari Coffee"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{money(o.total)}</p>
                  <StatusText tone={o.status === "PAID" ? "green" : "amber"}>
                    {o.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
                  </StatusText>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Cần chú ý</h2>
              <p className="mt-1 text-xs muted">Hồ sơ mới trong hàng đợi</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff2db] text-[#a77837]">
              <Clock size={20} />
            </span>
          </div>
          {apps.data
            ?.filter((a) => a.status === "PENDING")
            .map((a) => (
              <div key={a.id} className="rounded-2xl bg-[#f7f9f4] p-4">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-bold">{a.owner}</p>
                  {applicationStatus(a.status)}
                </div>
                <p className="mt-1 text-xs muted">{a.email}</p>
                <p className="mt-4 text-xs leading-5 text-[#637569]">{a.note}</p>
              </div>
            ))}
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link to="/admin/applications">
              Xem hàng đợi <ArrowRight size={16} />
            </Link>
          </Button>
        </Card>
      </div>
    </>
  );
}

export function AdminApplications() {
  const api = useApi();
  const resource = useResource(() => api.listApplications(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const applications = resource.data ?? [];
  const current =
    applications.find((a) => a.id === selected) ??
    applications.find((a) => a.status === "PENDING") ??
    applications[0];
  async function decide(id: string, decision: "approve" | "reject") {
    if (busy) return;
    setBusy(id);
    setActionError(null);
    try {
      const updated =
        decision === "approve" ? await api.approveApplication(id) : await api.rejectApplication(id);
      resource.setData((prev) => prev?.map((a) => (a.id === id ? updated : a)) ?? null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Không xử lý được hồ sơ");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeader
        title="Duyệt cửa hàng"
        description="Merchant chỉ quản lý cửa hàng sau khi hồ sơ được duyệt."
      />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !applications.length ? (
        <EmptyState title="Chưa có hồ sơ" description="Hồ sơ Merchant mới sẽ xuất hiện tại đây." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
          <div className="space-y-3">
            {applications.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`surface w-full rounded-2xl p-5 text-left transition hover:-translate-y-0.5 ${current?.id === a.id ? "ring-2 ring-[#9bc798]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{a.owner}</p>
                  {applicationStatus(a.status)}
                </div>
                <p className="mt-1 text-xs muted">{a.email}</p>
                <p className="mt-3 text-xs muted">Gửi ngày {shortDate(a.submittedAt)}</p>
              </button>
            ))}
          </div>
          {current && (
            <Card className="p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f1e2] text-[#416a47]">
                  <Storefront size={27} weight="light" />
                </span>
                {applicationStatus(current.status)}
              </div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                {current.merchantId === "gommay" ? "Gốm Mây" : current.merchantId}
              </h2>
              <p className="mt-5 text-sm leading-7 text-[#627469]">{current.note}</p>
              <div className="mt-7 grid gap-4 border-y border-[#edf1ea] py-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs muted">Người đăng ký</p>
                  <p className="mt-1 text-sm font-bold">{current.owner}</p>
                </div>
                <div>
                  <p className="text-xs muted">Email liên hệ</p>
                  <p className="mt-1 text-sm font-bold">{current.email}</p>
                </div>
              </div>
              {actionError && (
                <p role="alert" className="mt-4 rounded-xl bg-[#fae7e3] p-3 text-xs text-[#a4473a]">
                  {actionError}
                </p>
              )}
              {current.status === "PENDING" && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => decide(current.id, "approve")} disabled={!!busy}>
                    {busy === current.id ? (
                      <BusyLabel>Đang xử lý</BusyLabel>
                    ) : (
                      <>
                        <CheckCircle size={18} /> Duyệt cửa hàng
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => decide(current.id, "reject")} disabled={!!busy}>
                    <XCircle size={18} /> Từ chối
                  </Button>
                </div>
              )}
              {current.status === "APPROVED" && (
                <Button asChild className="mt-6">
                  <Link to={`/merchant/${current.merchantId}/loyalty`}>
                    Mở Loyalty của Merchant <ArrowRight size={16} />
                  </Link>
                </Button>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}

export function AdminMerchants() {
  const api = useApi();
  const resource = useResource(() => api.listMerchants(), []);
  return (
    <>
      <PageHeader title="Cửa hàng trên hệ thống" />
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState title="Chưa có cửa hàng" description="Merchant sẽ xuất hiện sau khi gửi hồ sơ." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resource.data.map((m) => (
            <Card key={m.id} className="card-hover p-6">
              <div className="flex items-start justify-between">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-extrabold text-[#37593e]"
                  style={{ background: m.color }}
                >
                  {m.initials}
                </span>
                <StatusText
                  tone={m.status === "APPROVED" ? "green" : m.status === "PENDING" ? "amber" : "red"}
                >
                  {m.status === "APPROVED" ? "Hoạt động" : m.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                </StatusText>
              </div>
              <h2 className="mt-5 text-lg font-extrabold">{m.name}</h2>
              <p className="mt-1 text-xs muted">
                {m.category} · {m.location}
              </p>
              <p className="mt-4 min-h-12 text-xs leading-6 text-[#68796c]">{m.description}</p>
              <div className="mt-5 flex gap-2">
                {m.status === "APPROVED" ? (
                  <>
                    <Button size="sm" variant="secondary" asChild>
                      <Link to={`/merchant/${m.id}`}>
                        Quản lý <ArrowRight size={14} />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/member/${m.id}`}>Gian hàng</Link>
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
