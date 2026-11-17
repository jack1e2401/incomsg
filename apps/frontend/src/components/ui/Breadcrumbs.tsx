import { Link, useLocation } from "react-router-dom";

type Crumb = { label: string; to?: string };

export function Breadcrumbs({ basePath, merchantName }: { basePath: string; merchantName: string }) {
  const { pathname } = useLocation();
  const path = pathname.slice(basePath.length).replace(/\/$/, "");
  const parts = path.split("/").filter(Boolean);
  const titles: Record<string, string> = {
    products: "Sản phẩm", challenges: "Nhiệm vụ", vouchers: "Ưu đãi", rewards: "Đổi quà",
    events: "Sự kiện", wallet: "Ví điểm", orders: "Đơn hàng", cart: "Giỏ hàng",
    checkout: "Thanh toán", profile: "Cá nhân",
  };
  const current = parts.length > 1
    ? ({ products: "Chi tiết sản phẩm", challenges: "Chi tiết nhiệm vụ", events: "Chi tiết sự kiện", orders: "Chi tiết đơn hàng" }[parts[0]] ?? titles[parts[0]] ?? "Chi tiết")
    : parts.length ? titles[parts[0]] ?? "Chi tiết" : "Trang chủ";
  const parentPath = parts.length > 1 ? `${basePath}/${parts.slice(0, -1).join("/")}` : basePath;
  const parentLabel = parts.length > 1 ? titles[parts[0]] ?? "Quay lại" : "Cửa hàng";
  const crumbs: Crumb[] = [{ label: "Cửa hàng", to: basePath }];
  if (parts.length) {
    let url = basePath;
    parts.forEach((part, index) => {
      url += `/${part}`;
      crumbs.push({ label: index === 0 ? titles[part] ?? current : current, to: index < parts.length - 1 ? url : undefined });
    });
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-xs text-[#66776a] md:flex">
        {crumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">›</span>}
          {crumb.to ? <Link className="hover:underline" to={crumb.to}>{crumb.label === "Cửa hàng" ? merchantName : crumb.label}</Link> : <span aria-current="page" className="font-semibold text-[#294833]">{crumb.label}</span>}
        </span>)}
      </nav>
      <div className="flex items-center gap-3 md:hidden">
        <Link to={parentPath} aria-label={`Quay lại ${parentLabel}`} className="rounded-lg px-2 py-1 text-sm font-bold text-[#335e3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]">← {parentLabel}</Link>
        <span className="truncate text-sm font-semibold text-[#294833]">{current === "Trang chủ" ? merchantName : current}</span>
      </div>
    </>
  );
}
