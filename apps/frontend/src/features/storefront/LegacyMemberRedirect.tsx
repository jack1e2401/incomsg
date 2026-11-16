import { Navigate, useLocation, useParams } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import { LoadingState } from "../../components/ui";
import { BackendMemberLayout } from "../member/BackendMemberPages";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function mapLegacySubpath(restPath: string): string {
  const cleaned = restPath.replace(/^\/+/, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("product/")) {
    return `products/${cleaned.slice("product/".length)}`;
  }
  return cleaned;
}

export function LegacyMemberRedirect() {
  const { merchantId: rawId, "*": rest = "" } = useParams();
  const location = useLocation();
  const merchantId = Number(rawId);

  const merchants = useResource(
    () =>
      Number.isInteger(merchantId) && merchantId > 0
        ? commerce.listMerchants().then((res) => res.merchants)
        : Promise.resolve([]),
    [merchantId],
  );

  if (merchants.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-7">
        <LoadingState cards={2} />
      </main>
    );
  }

  const matched = merchants.data?.find((m) => m.id === merchantId && m.slug);
  if (matched) {
    const mappedSubpath = mapLegacySubpath(rest);
    const target = `/s/${encodeURIComponent(matched.slug)}${mappedSubpath ? `/${mappedSubpath}` : ""}${location.search}`;
    return <Navigate to={target} replace />;
  }

  return <BackendMemberLayout />;
}
