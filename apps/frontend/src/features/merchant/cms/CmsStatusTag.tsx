import { Tag } from "antd";

export type CmsStatusTone = "neutral" | "success" | "warning" | "error" | "info";

const colors: Record<CmsStatusTone, string> = {
  neutral: "default",
  success: "success",
  warning: "warning",
  error: "error",
  info: "processing",
};

export function CmsStatusTag({ label, tone = "neutral" }: { label: string; tone?: CmsStatusTone }) {
  return <Tag color={colors[tone]}>{label}</Tag>;
}
