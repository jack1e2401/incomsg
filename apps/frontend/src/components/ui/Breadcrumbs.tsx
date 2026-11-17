import { Link, useLocation } from "react-router-dom";

export function Breadcrumbs({ basePath, merchantName }: { basePath: string; merchantName: string }) {
  const { pathname } = useLocation();
  const path = pathname.slice(basePath.length).replace(/\/$/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const titles: Record<string, string> = {
    products: "Sản phẩm", challenges: "Nhiệm vụ", vouchers: "Ưu đãi", rewards: "Đổi quà",
    events: "Sự kiện", wallet: "Ví điểm", orders: "Đơn hàng", cart: "Giỏ hàng",
    checkout: "Thanh toán", profile: "Cá nhân",
  };
  const current = parts.length > 1
    ? ({ products: "Chi tiết sản phẩm", challenges: "Chi tiết nhiệm vụ", events: "Chi tiết sự kiện", orders: "Chi tiết đơn hàng" }[parts[0]] ?? titles[parts[0]] ?? "Chi tiết")
    : titles[parts[0]] ?? "Chi tiết";
  const root = { label: "Cửa hàng", to: basePath };
  const ancestors = [root];
  if (parts[0] === "orders") {
    ancestors.push({ label: titles.profile, to: `${basePath}/profile` });
  }
  parts.slice(0, -1).forEach((part, index) => {
    ancestors.push({
      label: titles[part] ?? current,
      to: `${basePath}/${parts.slice(0, index + 1).join("/")}`,
    });
  });
  const parent = ancestors.at(-1) ?? root;

  return (
    <>
      <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-xs text-[#66776a] md:flex">
        {ancestors.map((crumb, index) => (
          <span key={crumb.to} className="inline-flex items-center gap-2">
            <Link className="hover:underline" to={crumb.to}>{index === 0 ? merchantName : crumb.label}</Link>
            <span aria-hidden="true">›</span>
          </span>
        ))}
        <span aria-current="page" className="font-semibold text-[#294833]">{current}</span>
      </nav>
      <div className="flex items-center gap-3 md:hidden">
        <Link to={parent.to} aria-label={`Quay lại ${parent.label}`} className="rounded-lg px-2 py-1 text-sm font-bold text-[#335e3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]">← {parent.label}</Link>
        <span className="truncate text-sm font-semibold text-[#294833]">{current}</span>
      </div>
    </>
  );
}
