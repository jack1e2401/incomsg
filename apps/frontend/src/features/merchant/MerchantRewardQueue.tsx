import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { MemberVoucherDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  BusyLabel,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  StatusText,
  Textarea,
} from "../../components/ui";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function useToken() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  return accessToken;
}

function formatActionDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : null;
}

export function MerchantRewardQueue({ voucherId }: { voucherId?: number } = {}) {
  const token = useToken();
  const resource = useResource(
    () => api.listMerchantRewards(token).then(({ rewards }) => voucherId === undefined ? rewards : rewards.filter((reward) => reward.id === voucherId)),
    [token, voucherId],
  );
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "FULFILLED" | "CANCELLED">("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rewardToCancel, setRewardToCancel] = useState<MemberVoucherDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function fulfill(voucher: MemberVoucherDto) {
    if (busyId !== null) return;
    setBusyId(voucher.id);
    setError("");
    setNotice("");
    try {
      const response = await api.fulfillReward(
        voucher.id,
        notes[voucher.id]?.trim() ? { note: notes[voucher.id].trim() } : {},
        token,
      );
      resource.setData((current) =>
        (current ?? []).map((item) =>
          item.id === response.reward.id ? { ...item, ...response.reward } : item,
        ),
      );
      setNotice(`Đã xác nhận trao “${response.reward.title}” cho thành viên #${response.reward.memberId}.`);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Không thể xác nhận trao quà";
      setError(msg);
      if (msg.includes("REWARD_ALREADY_FULFILLED") || msg.includes("REWARD_NOT_FOUND")) resource.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function submitCancelReward() {
    if (!rewardToCancel || !cancelReason.trim() || cancelBusy) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      const response = await api.cancelReward(rewardToCancel.id, { reason: cancelReason.trim() }, token);
      const updatedReward = response.reward;
      resource.setData((current) =>
        (current ?? []).map((item) =>
          item.id === rewardToCancel.id ? { ...item, ...updatedReward, status: "CANCELLED" as const } : item,
        ),
      );
      setNotice(`Đã hủy trao “${rewardToCancel.title}” cho thành viên #${rewardToCancel.memberId}.`);
      setRewardToCancel(null);
    } catch (reason) {
      setCancelError(reason instanceof Error ? reason.message : "Không thể hủy trao quà");
    } finally {
      setCancelBusy(false);
    }
  }

  if (resource.loading) return <LoadingState cards={1} />;
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;

  const pending = (resource.data ?? []).filter(
    (voucher) => voucher.status === "AVAILABLE" || voucher.status === "PENDING_FULFILLMENT",
  );
  const fulfilled = (resource.data ?? []).filter((voucher) => voucher.status === "FULFILLED");
  const cancelled = (resource.data ?? []).filter((voucher) => voucher.status === "CANCELLED");

  const displayedRewards =
    filterTab === "PENDING"
      ? pending
      : filterTab === "FULFILLED"
        ? fulfilled
        : filterTab === "CANCELLED"
          ? cancelled
          : (resource.data ?? []);

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm text-[#357044]">
          {notice}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={filterTab === "ALL" ? "default" : "outline"}
          onClick={() => setFilterTab("ALL")}
        >
          Tất cả ({resource.data?.length ?? 0})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filterTab === "PENDING" ? "default" : "outline"}
          onClick={() => setFilterTab("PENDING")}
        >
          Chờ trao ({pending.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filterTab === "FULFILLED" ? "default" : "outline"}
          onClick={() => setFilterTab("FULFILLED")}
        >
          Đã trao ({fulfilled.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filterTab === "CANCELLED" ? "default" : "outline"}
          onClick={() => setFilterTab("CANCELLED")}
        >
          Đã hủy ({cancelled.length})
        </Button>
      </div>

      <div>
        {!displayedRewards.length ? (
          <p className="surface rounded-2xl px-5 py-4 text-sm muted">
            Không có quà tặng trong danh sách này.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {displayedRewards.map((voucher) => {
              const isPending = voucher.status === "AVAILABLE" || voucher.status === "PENDING_FULFILLMENT";
              const isFulfilled = voucher.status === "FULFILLED";
              const isCancelled = voucher.status === "CANCELLED";
              return (
                <Card key={voucher.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold">{voucher.title}</h4>
                      <p className="mt-1 text-sm muted">
                        Voucher #{voucher.id} · Thành viên #{voucher.memberId} · Đổi bằng{" "}
                        {voucher.pointsCost.toLocaleString("vi-VN")} điểm
                      </p>
                    </div>
                    <StatusText tone={isFulfilled ? "green" : isCancelled ? "red" : "amber"}>
                      {isFulfilled ? "Đã trao" : isCancelled ? "Đã hủy" : "Chờ trao"}
                    </StatusText>
                  </div>
                  {voucher.rewardDescription && (
                    <p className="mt-3 text-sm muted">{voucher.rewardDescription}</p>
                  )}
                  <p className="mt-3 text-xs muted">
                    Đổi ngày {new Date(voucher.redeemedAt).toLocaleDateString("vi-VN")}
                  </p>

                  {isFulfilled && (
                    <div className="mt-3 rounded-xl bg-[#f7f9f5] p-3 text-xs muted">
                      {voucher.fulfilledAt && <p>Đã trao {formatActionDate(voucher.fulfilledAt)}</p>}
                      {voucher.fulfilledById != null && <p>Người xác nhận #{voucher.fulfilledById}</p>}
                      {voucher.note && <p>Ghi chú: {voucher.note}</p>}
                    </div>
                  )}
                  {isCancelled && (
                    <div className="mt-3 rounded-xl bg-[#fae7e3] p-3 text-xs text-[#8f4338]">
                      {voucher.cancelledAt && <p>Đã hủy {formatActionDate(voucher.cancelledAt)}</p>}
                      {voucher.cancelledById != null && <p>Người xử lý #{voucher.cancelledById}</p>}
                      {voucher.cancellationReason && <p>Lý do: {voucher.cancellationReason}</p>}
                    </div>
                  )}

                  {isPending && (
                    <>
                      <Field label="Ghi chú trao quà (không bắt buộc)">
                        <Textarea
                          maxLength={255}
                          value={notes[voucher.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [voucher.id]: event.target.value }))
                          }
                        />
                      </Field>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button disabled={busyId !== null} onClick={() => void fulfill(voucher)}>
                          {busyId === voucher.id ? <BusyLabel>Đang xác nhận</BusyLabel> : "Xác nhận đã trao"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busyId !== null}
                          onClick={() => {
                            setRewardToCancel(voucher);
                            setCancelReason("");
                            setCancelError("");
                          }}
                        >
                          Hủy quà
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {rewardToCancel && (
        <Dialog.Root open onOpenChange={(open) => !cancelBusy && !open && setRewardToCancel(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
            <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
              <Dialog.Title className="text-xl font-extrabold text-[#20392a]">Hủy trao quà tặng</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 muted">
                Hủy trao quà sẽ hoàn lại {rewardToCancel.pointsCost.toLocaleString("vi-VN")} điểm đã đổi cho
                thành viên #{rewardToCancel.memberId}.
              </Dialog.Description>
              <div className="mt-4">
                <Field label="Lý do hủy quà">
                  <Input
                    required
                    aria-label="Lý do hủy quà"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy quà..."
                  />
                </Field>
              </div>
              {cancelError && (
                <p role="alert" className="mt-4 rounded-xl bg-[#fae7e3] p-3 text-sm text-[#a4473a]">
                  {cancelError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelBusy}
                  onClick={() => setRewardToCancel(null)}
                >
                  Đóng
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={cancelBusy || !cancelReason.trim()}
                  onClick={() => void submitCancelReward()}
                >
                  {cancelBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Xác nhận hủy quà"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
