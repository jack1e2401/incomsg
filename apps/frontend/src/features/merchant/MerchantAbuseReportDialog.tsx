import { useState, useEffect, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { WarningCircle, X } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type { MerchantAbuseReportDto, OrderDto } from "../../api/commerce-types";
import { Button, BusyLabel, Field, Textarea } from "../../components/ui";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function useToken() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  return accessToken;
}

export interface MerchantAbuseReportDialogProps {
  order: (OrderDto & { memberEmail?: string }) | null;
  onClose: () => void;
  onReportSubmitted: (report: MerchantAbuseReportDto, notice: string) => void;
}

export function MerchantAbuseReportDialog({
  order,
  onClose,
  onReportSubmitted,
}: MerchantAbuseReportDialogProps) {
  const token = useToken();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (order) {
      setReason("");
      setError("");
      setValidationError("");
    }
  }, [order?.id]);

  if (!order) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("Vui lòng nhập lý do báo cáo vi phạm.");
      return;
    }
    if (trimmed.length > 2000) {
      setValidationError("Lý do báo cáo không được vượt quá 2.000 ký tự.");
      return;
    }
    setValidationError("");
    setError("");
    setBusy(true);

    try {
      const response = await api.createMerchantAbuseReport(
        {
          memberId: order.memberId,
          orderId: order.id,
          reason: trimmed,
        },
        token,
      );
      onReportSubmitted(response.report, `Đã gửi báo cáo vi phạm cho đơn #${order.id}.`);
      onClose();
    } catch (err) {
      setError(translateApiError(err instanceof Error ? err.message : "Gửi báo cáo thất bại"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !busy && !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
          <div className="flex items-start justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fae7e3] text-[#a4473a]">
              <WarningCircle size={24} weight="light" />
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                disabled={busy}
                onClick={onClose}
                className="rounded-xl p-1.5 text-[#5e7264] hover:bg-[#edf2ea] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-5 text-xl font-extrabold text-[#20392a]">
            Báo cáo vi phạm đơn #{order.id}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 muted">
            Gửi báo cáo bất thường về thành viên{" "}
            <span className="font-semibold text-[#20392a]">#{order.memberId}</span>
            {order.memberEmail ? ` (${order.memberEmail})` : ""} để quản trị viên xem xét.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <Field
              label="Lý do báo cáo *"
              hint={`${reason.trim().length}/2.000 ký tự (bắt buộc)`}
            >
              <Textarea
                required
                maxLength={2000}
                rows={4}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError("");
                  if (error) setError("");
                }}
                placeholder="Mô tả cụ thể hành vi vi phạm hoặc sự cố bất thường liên quan đến đơn hàng này..."
                disabled={busy}
                className="min-h-24 resize-none"
              />
            </Field>

            {(validationError || error) && (
              <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-xs leading-5 text-[#a4473a]">
                {validationError || error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onClose}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={busy}
              >
                {busy ? <BusyLabel>Đang gửi...</BusyLabel> : "Gửi báo cáo"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
