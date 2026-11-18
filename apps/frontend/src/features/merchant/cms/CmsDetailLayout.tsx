import type { ReactNode } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Breadcrumb, Flex, Typography, type BreadcrumbProps } from "antd";
import { Link } from "react-router-dom";

type CmsDetailLayoutProps = {
  title: string;
  backTo: string;
  backLabel: string;
  breadcrumbs?: BreadcrumbProps["items"];
  status?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function CmsDetailLayout({
  title,
  backTo,
  backLabel,
  breadcrumbs,
  status,
  action,
  children,
}: CmsDetailLayoutProps) {
  return (
    <section className="space-y-5">
      {breadcrumbs?.length ? <Breadcrumb aria-label="Breadcrumb" items={breadcrumbs} /> : null}
      <Flex align="center" justify="space-between" gap={16} wrap>
        <div className="min-w-0">
          <Link to={backTo} className="mb-2 inline-flex items-center gap-2 text-sm text-[#356b43]">
            <ArrowLeftOutlined aria-hidden="true" />
            {backLabel}
          </Link>
          <Flex align="center" gap={8} wrap>
            <Typography.Title level={2} className="!mb-0 !text-[22px]">
              {title}
            </Typography.Title>
            {status}
          </Flex>
        </div>
        {action ? <Flex gap={8} wrap>{action}</Flex> : null}
      </Flex>
      {children}
    </section>
  );
}
