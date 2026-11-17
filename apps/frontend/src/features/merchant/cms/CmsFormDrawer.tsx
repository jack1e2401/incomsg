import type { ReactNode } from "react";
import { Drawer } from "antd";

type CmsFormDrawerProps = {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
};

export function CmsFormDrawer({ open, title, onClose, children, footer, width = 520 }: CmsFormDrawerProps) {
  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={width}
      footer={footer}
      destroyOnHidden
      keyboard
      rootClassName="merchant-cms-drawer"
    >
      {children}
    </Drawer>
  );
}
