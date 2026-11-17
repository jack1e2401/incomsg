import type { ReactNode } from "react";
import { ConfigProvider, theme } from "antd";

export const merchantCmsTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#356b43",
    colorInfo: "#356b43",
    colorSuccess: "#28734d",
    colorWarning: "#ad6b16",
    colorError: "#b5473c",
    colorText: "#26352f",
    colorTextSecondary: "#68776d",
    colorBgLayout: "#f6f8f5",
    colorBgContainer: "#ffffff",
    colorBorder: "#e3e9e2",
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: 14,
  },
  components: {
    Button: { fontWeight: 600 },
    Card: { bodyPadding: 16, borderRadiusLG: 8 },
    Table: { headerBg: "#f3f6f3", headerColor: "#53645a", rowHoverBg: "#f7faf7" },
  },
};

export function MerchantCmsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  if (!enabled) return children;
  return (
    <ConfigProvider theme={merchantCmsTheme}>
      <div className="merchant-cms min-h-full">{children}</div>
    </ConfigProvider>
  );
}
