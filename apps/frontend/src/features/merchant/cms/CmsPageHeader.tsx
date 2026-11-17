import type { ReactNode } from "react";
import { Breadcrumb, Flex, Typography, type BreadcrumbProps } from "antd";

type CmsPageHeaderProps = {
  title: string;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbProps["items"];
  action?: ReactNode;
};

export function CmsPageHeader({ title, description, breadcrumbs, action }: CmsPageHeaderProps) {
  return (
    <Flex vertical gap={12} className="mb-6">
      {breadcrumbs?.length ? (
        <Breadcrumb aria-label="Breadcrumb" items={breadcrumbs} />
      ) : null}
      <Flex align="center" justify="space-between" gap={16} wrap>
        <div className="min-w-0">
          <Typography.Title level={2} className="!mb-0 !text-[22px]">
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Paragraph type="secondary" className="!mb-0 !mt-1">
              {description}
            </Typography.Paragraph>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </Flex>
    </Flex>
  );
}
