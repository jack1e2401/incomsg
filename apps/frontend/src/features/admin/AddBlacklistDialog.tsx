import { useState, useEffect, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { WarningCircle, X } from "@phosphor-icons/react";
import { Button, BusyLabel, Field, Input, Textarea } from "../../components/ui";

interface AddBlacklistDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  busy: boolean;
  error?: string | null;
  onConfirm(input: { email: string; reason: string }): void;
}

export function AddBlacklistDialog({
  open,
  onOpenChange,
  busy,
  error,
  onConfirm,
}: AddBlacklistDialogProps) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setReason("");
      setClientError("");
    }
  }, [open]);

  function handleClose() {
    if (busy) return;
    setClientError("");
    onOpenChange(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const emailTrimmed = email.trim().toLowerCase();
    const reasonTrimmed = reason.trim();

    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setClientError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    if (reasonTrimmed.length < 1 || reasonTrimmed.length > 255) {
      setClientError("Lý do là bắt buộc (từ 1 đến 255 ký tự).");
      return;
    }

    setClientError("");
    onConfirm({ email: emailTrimmed, reason: reasonTrimmed });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
        <Dialog.Content
          onEscapeKeyDown={(e) => {
            if (busy) {
              e.preventDefault();
            } else {
              handleClose();
            }
          }}
          className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fae7e3] text-[#a4473a]">
              <WarningCircle size={24} weight="light" />
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                disabled={busy}
                onClick={handleClose}
                className="rounded-xl p-1.5 text-[#5e7264] hover:bg-[#edf2ea] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-5 text-xl font-extrabold text-[#20392a]">
            Thêm email vào danh sách đen
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 muted">
            Email bị chặn sẽ không thể đăng ký tài khoản mới hoặc đăng nhập vào hệ thống.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <Field label="Địa chỉ email *">
              <Input
                type="email"
                required
                maxLength={191}
                placeholder="spam@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (clientError) setClientError("");
                }}
                disabled={busy}
              />
            </Field>

            <Field label="Lý do chặn *" hint={`${reason.trim().length}/255 ký tự (bắt buộc)`}>
              <Textarea
                required
                maxLength={255}
                rows={3}
                placeholder="Nhập lý do chặn email này..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (clientError) setClientError("");
                }}
                disabled={busy}
                className="min-h-24 resize-none"
              />
            </Field>

            {(clientError || error) && (
              <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-xs leading-5 text-[#a4473a]">
                {clientError || error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy} onClick={handleClose}>
                  Hủy
                </Button>
              </Dialog.Close>
              <Button type="submit" variant="danger" disabled={busy}>
                {busy ? <BusyLabel>Đang thêm</BusyLabel> : "Thêm vào danh sách"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
