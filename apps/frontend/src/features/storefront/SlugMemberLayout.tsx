import { Navigate, useLocation, useParams } from "react-router-dom";
import { routeForRole, useAuthSession } from "../../api/auth-session";
import { createStorefrontClient } from "../../api/storefront-client";
import { useResource } from "../../api/useResource";
import { ErrorState, LoadingState } from "../../components/ui";
import { MemberStoreLayout } from "../member/BackendMemberPages";

const storefrontApi = createStorefrontClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function SlugMemberLayout() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const { user } = useAuthSession();

  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const storeResource = useResource(
    () => (user?.role === "MEMBER" && slug ? storefrontApi.getPublicStorefront(slug) : Promise.resolve(null)),
    [slug, user?.role],
  );

  if (!user) {
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  if (user.role !== "MEMBER") {
    return <Navigate to={routeForRole(user.role)} replace />;
  }
  if (storeResource.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-7">
        <LoadingState cards={2} />
      </main>
    );
  }
  if (storeResource.error || !storeResource.data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-7">
        <ErrorState
          message={storeResource.error ?? "Không tìm thấy cửa hàng."}
          retry={storeResource.reload}
        />
      </main>
    );
  }

  const merchant = storeResource.data.merchant;
  const storageKey = `loyalty.member.cart.${user.id}.${merchant.id}`;
  return (
    <MemberStoreLayout
      key={storageKey}
      merchantId={merchant.id}
      storageKey={storageKey}
      basePath={`/s/${merchant.slug}`}
      storeName={merchant.name}
    />
  );
}
