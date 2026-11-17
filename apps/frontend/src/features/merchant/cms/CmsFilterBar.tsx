import type { ReactNode } from "react";
import { Flex } from "antd";

export function CmsFilterBar({ label = "Bộ lọc", children }: { label?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="mb-4 rounded-lg border border-[#e3e9e2] bg-white p-3">
      <Flex align="end" gap={12} wrap>
        {children}
      </Flex>
    </section>
  );
}
