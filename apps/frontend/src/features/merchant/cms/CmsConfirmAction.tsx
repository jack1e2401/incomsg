import type { ReactElement, ReactNode } from "react";
import { Popconfirm } from "antd";

type CmsConfirmActionProps = {
  children: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onConfirm(): void | Promise<void>;
};

export function CmsConfirmAction({
  children,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Quay lại",
  destructive = false,
  pending = false,
  disabled = false,
  onConfirm,
}: CmsConfirmActionProps) {
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={confirmLabel}
      cancelText={cancelLabel}
      okButtonProps={{ danger: destructive, loading: pending }}
      disabled={disabled || pending}
      onConfirm={onConfirm}
    >
      {children}
    </Popconfirm>
  );
}
