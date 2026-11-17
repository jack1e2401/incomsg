import { useState } from "react";
import { CheckCircle, Gift } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../../components/ui";
import { shortDate } from "../../../lib/utils";
import { useMerchantId } from "./useMerchantId";

export function MerchantRewards() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listRewardFulfillments(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function fulfill(voucherId: string) {
    if (busy) return;
    setBusy(voucherId);
    setError("");
    try {
      const updated = await api.fulfillReward(voucherId, id);
      resource.setData((prev) => prev?.map((v) => (v.id === voucherId ? updated : v)) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận trao quà");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeader
        title="Trao thưởng"
        description="Chỉ xác nhận sau khi Merchant đã trao quà thực tế cho Member."
      />
      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có yêu cầu nhận quà"
          description="Reward Voucher đã đổi sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {resource.data.map((v) => (
            <Card key={v.id} className="p-6">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3ebdf] text-[#a27646]">
                  <Gift size={23} />
                </span>
                <StatusText tone={v.status === "FULFILLED" ? "green" : "amber"}>
                  {v.status === "FULFILLED" ? "Đã trao quà" : "Chờ trao quà"}
                </StatusText>
              </div>
              <h2 className="mt-5 text-lg font-extrabold">{v.title}</h2>
              <p className="mt-1 text-xs muted">
                Mã {v.id} · Đổi ngày {shortDate(v.issuedAt)}
              </p>
              {v.status === "PENDING_FULFILLMENT" && (
                <Button className="mt-5" disabled={!!busy} onClick={() => fulfill(v.id)}>
                  {busy === v.id ? (
                    <BusyLabel>Đang xác nhận</BusyLabel>
                  ) : (
                    <>
                      <CheckCircle size={17} /> Xác nhận đã trao
                    </>
                  )}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
