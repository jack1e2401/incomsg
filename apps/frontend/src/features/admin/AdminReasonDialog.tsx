import { useState, useEffect, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { WarningCircle, X } from "@phosphor-icons/react";
import { Button, BusyLabel, Field, Textarea } from "../../components/ui";

interface AdminReasonDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm(reason: string): void;
}

export function AdminReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
}: AdminReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setValidationError("");
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 1 || trimmed.length > 255) {
      setValidationError("Lý do là bắt buộc (từ 1 đến 255 ký tự).");
      return;
    }
    setValidationError("");
    onConfirm(trimmed);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
          <div className="flex items-start justify-between">
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl ${
                destructive ? "bg-[#fae7e3] text-[#a4473a]" : "bg-[#edf4e9] text-[#4c8054]"
              }`}
            >
              <WarningCircle size={24} weight="light" />
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                disabled={busy}
                className="rounded-xl p-1.5 text-[#5e7264] hover:bg-[#edf2ea] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-5 text-xl font-extrabold text-[#20392a]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 muted">{description}</Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <Field label="Lý do thực hiện *" hint={`${reason.trim().length}/255 ký tự (bắt buộc)`}>
              <Textarea
                required
                maxLength={255}
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError("");
                }}
                placeholder="Nhập lý do thực hiện thao tác kiểm duyệt này..."
                disabled={busy}
                className="min-h-24 resize-none"
              />
            </Field>

            {(validationError || error) && (
              <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-xs leading-5 text-[#a4473a]">
                {validationError || error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Hủy
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                variant={destructive ? "danger" : "default"}
                disabled={busy}
              >
                {busy ? <BusyLabel>Đang xử lý</BusyLabel> : confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
