import * as Dialog from "@radix-ui/react-dialog";
import { WarningCircle } from "@phosphor-icons/react";
import { Button, BusyLabel } from "./index";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm(): void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl ${destructive ? "bg-[#fae7e3] text-[#a4473a]" : "bg-[#edf4e9] text-[#4c8054]"}`}
          >
            <WarningCircle size={24} weight="light" />
          </span>
          <Dialog.Title className="mt-5 text-xl font-extrabold text-[#20392a]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 muted">{description}</Dialog.Description>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-[#fae7e3] p-3 text-sm text-[#a4473a]">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Hủy
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={destructive ? "danger" : "default"}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? <BusyLabel>Đang xử lý</BusyLabel> : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
