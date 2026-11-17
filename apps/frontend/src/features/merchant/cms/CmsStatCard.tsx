import type { ReactNode } from "react";
import { Card, Flex, Typography } from "antd";

export function CmsStatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Card size="small" className="h-full">
      <Flex vertical gap={4}>
        <Typography.Text type="secondary">{label}</Typography.Text>
        <Typography.Text strong className="text-xl tabular-nums">{value}</Typography.Text>
        {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
      </Flex>
    </Card>
  );
}
