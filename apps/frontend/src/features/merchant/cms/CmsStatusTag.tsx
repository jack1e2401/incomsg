import { Tag } from "antd";

export type CmsStatusTone = "neutral" | "success" | "warning" | "error" | "info";

const colors: Record<CmsStatusTone, { color: string; background: string }> = {
  neutral: { color: "#475569", background: "#f1f5f9" },
  success: { color: "#166534", background: "#dcfce7" },
  warning: { color: "#92400e", background: "#fef3c7" },
  error: { color: "#991b1b", background: "#fee2e2" },
  info: { color: "#1e40af", background: "#dbeafe" },
};

export function CmsStatusTag({ label, tone = "neutral" }: { label: string; tone?: CmsStatusTone }) {
  return <Tag style={{ ...colors[tone], border: "none", whiteSpace: "normal", marginInlineEnd: 0 }}>{label}</Tag>;
}
