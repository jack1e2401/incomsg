import { useState } from "react";
import { ArrowRight, SignOut, Storefront } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { MerchantDirectoryItem } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { Button, EmptyState, ErrorState, LoadingState } from "../../components/ui";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function MemberLanding() {
  const navigate = useNavigate();
  const { logout } = useAuthSession();
  const merchants = useResource(async () => {
    const { merchants: items } = await commerce.listMerchants({ includeCover: true });
    return items
      .filter((merchant) => merchant.isActive !== false)
      .sort((left, right) => Number(Boolean(right.coverImageUrl)) - Number(Boolean(left.coverImageUrl)));
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 pb-14 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5 sm:py-6">
        <span className="text-lg font-extrabold tracking-tight text-[#24452f]">IncomSG</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          <SignOut size={17} weight="light" aria-hidden="true" /> Đăng xuất
        </Button>
      </header>

      <section className="grid overflow-hidden rounded-[2rem] bg-[#e8efe2] md:grid-cols-[0.95fr_1.05fr]">
        <div className="flex min-h-48 flex-col justify-center px-6 py-8 sm:px-10 md:min-h-76 lg:px-13">
          <h1 className="serif max-w-sm text-balance text-[clamp(2.5rem,5vw,4.75rem)] leading-[0.98] tracking-[-0.045em] text-[#24452f]">
            Khám phá cửa hàng
          </h1>
          <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-[#405b47] sm:text-base">
            Chọn cửa hàng để mua sắm và xem điểm thưởng của bạn.
          </p>
        </div>
        <div className="relative min-h-36 bg-[#c6b8a3] sm:min-h-48">
          <img
            src="/images/independent-cafe.jpg"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
      </section>

      <section aria-labelledby="merchant-directory-title" className="mt-8 sm:mt-10">
        <h2
          id="merchant-directory-title"
          className="mb-4 text-xl font-extrabold tracking-tight text-[#24452f] sm:text-2xl"
        >
          Cửa hàng
        </h2>
        {merchants.loading ? (
          <LoadingState cards={3} />
        ) : merchants.error ? (
          <ErrorState message={merchants.error} retry={merchants.reload} />
        ) : !merchants.data?.length ? (
          <EmptyState title="Chưa có cửa hàng" description="Hiện chưa có cửa hàng đang hoạt động." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {merchants.data.map((merchant) => (
              <li key={merchant.id} className="min-w-0">
                <MerchantCard merchant={merchant} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MerchantCard({ merchant }: { merchant: MerchantDirectoryItem }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = merchant.coverImageUrl;
  return (
    <Link
      to={`/member/${merchant.id}`}
      className="group block h-full rounded-[1.5rem] bg-white p-1.5 shadow-[0_8px_24px_rgba(37,67,47,.05)] ring-1 ring-[#e2e9df] outline-none hover:ring-[#a5bca0] focus-visible:ring-2 focus-visible:ring-[#335e3d]"
    >
      <div className="relative grid aspect-[2/1] place-items-center overflow-hidden rounded-[1.125rem] bg-[#e8efe2] text-[#54725a]">
        <Storefront size={44} weight="light" aria-hidden="true" />
        {image && image !== failedImage && (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(.32,.72,0,1)] motion-safe:group-hover:scale-[1.035]"
            onError={() => setFailedImage(image)}
          />
        )}
      </div>
      <div className="flex min-h-20 items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <h3 className="min-w-0 break-words font-extrabold text-[#24452f]">{merchant.name}</h3>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#edf4e9] py-1 pl-2.5 pr-1 text-xs font-bold text-[#335e3d] group-hover:bg-[#e0ecd9]">
          Vào cửa hàng{" "}
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/80">
            <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </span>
        </span>
      </div>
    </Link>
  );
}
