import { Link } from "react-router-dom";
import { Calendar, CaretDown, Envelope, MapPin, Phone } from "@phosphor-icons/react";
import type { ProductDto } from "../../api/commerce-types";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import type {
  StorefrontBrandingConfig,
  StorefrontCategoryDto,
  StorefrontEventDto,
  StorefrontMerchantSummaryDto,
  StorefrontProductDto,
  StorefrontSectionConfig,
} from "../../api/storefront-types";
import { Card, EmptyState } from "../../components/ui";
import { StorefrontProductCard } from "./StorefrontProductCard";

function StorefrontLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  );
}

export function StorefrontSectionRenderer({
  section,
  merchant,
  branding,
  products,
  categories,
  events,
  canAdd,
  onBuy,
  selectedCategoryId,
  onSelectCategory,
}: {
  section: StorefrontSectionConfig;
  merchant: StorefrontMerchantSummaryDto;
  branding: StorefrontBrandingConfig;
  products: StorefrontProductDto[];
  categories: StorefrontCategoryDto[];
  events: StorefrontEventDto[];
  canAdd: (productId: number, availableQuantity?: number) => boolean;
  onBuy: (product: ProductDto) => void;
  selectedCategoryId?: number | null;
  onSelectCategory?: (categoryId: number | null) => void;
}) {
  const accent = branding.primaryColor || "#335e3d";
  const bannerSrc = resolveStorefrontAssetUrl(branding.bannerUrl);
  const heroImgSrc = resolveStorefrontAssetUrl(branding.heroImageUrl) ?? bannerSrc;
  const storeBase = `/s/${merchant.slug}`;

  switch (section.key) {
    case "hero": {
      const ctaTarget =
        branding.heroCtaLink === storeBase || branding.heroCtaLink === `${storeBase}/`
          ? `${storeBase}/products`
          : branding.heroCtaLink;

      return (
        <section
          aria-label="Giới thiệu cửa hàng"
          className="relative overflow-hidden rounded-2xl border border-[#e3ebe0] text-white sm:rounded-3xl"
          style={{ backgroundColor: accent }}
        >
          {heroImgSrc && (
            <img
              src={heroImgSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, ${accent}ee 0%, ${accent}cc 55%, ${accent}77 100%)`,
            }}
          />
          <div className="relative flex min-h-[148px] flex-col justify-center px-4 py-4 sm:min-h-[180px] sm:px-7 sm:py-6">
            <h1 className="serif line-clamp-2 max-w-xl text-xl font-bold leading-snug tracking-tight text-white sm:text-3xl">
              {branding.heroTitle}
            </h1>
            {branding.heroDescription && (
              <p className="mt-1.5 line-clamp-2 max-w-lg text-xs leading-relaxed text-white/90 sm:text-sm">
                {branding.heroDescription}
              </p>
            )}
            {branding.heroCtaText && ctaTarget && (
              <div className="mt-3">
                <StorefrontLink
                  href={ctaTarget}
                  className="inline-flex h-8 items-center justify-center rounded-full bg-white px-4 text-xs font-extrabold shadow-sm transition hover:bg-white/90 sm:h-9 sm:px-5"
                  style={{ color: accent }}
                >
                  {branding.heroCtaText}
                </StorefrontLink>
              </div>
            )}
          </div>
        </section>
      );
    }

    case "featured_products":
      return (
        <section id="featured-products" aria-labelledby="section-featured-products" className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 id="section-featured-products" className="text-base font-extrabold text-[#20392a] sm:text-xl">
                {section.title || "Sản phẩm nổi bật"}
              </h2>
              {section.subtitle && <p className="mt-0.5 text-xs muted">{section.subtitle}</p>}
            </div>
            <Link
              to={`${storeBase}/products`}
              className="shrink-0 text-xs font-bold hover:underline"
              style={{ color: accent }}
            >
              Xem tất cả →
            </Link>
          </div>
          {!products.length ? (
            <EmptyState
              title="Chưa có sản phẩm nổi bật"
              description="Cửa hàng sẽ cập nhật sản phẩm mới sớm."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  slug={merchant.slug}
                  product={product}
                  accent={accent}
                  canAdd={canAdd(product.id, product.inventory.availableQuantity)}
                  onAdd={onBuy}
                />
              ))}
            </div>
          )}
        </section>
      );

    case "categories":
      return (
        <section aria-labelledby="section-categories" className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="section-categories" className="text-base font-extrabold text-[#20392a] sm:text-xl">
              {section.title || "Danh mục"}
            </h2>
            {section.subtitle && <p className="text-xs muted">{section.subtitle}</p>}
          </div>
          {!categories.length ? (
            <p className="text-xs muted">Cửa hàng chưa tạo danh mục sản phẩm.</p>
          ) : (
            <div
              role="tablist"
              aria-label="Danh mục nổi bật"
              className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0"
            >
              {onSelectCategory ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={(selectedCategoryId ?? null) === null}
                  onClick={() => onSelectCategory(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    (selectedCategoryId ?? null) === null
                      ? "text-white shadow-sm"
                      : "border border-[#dce6da] bg-white text-[#4c6052] hover:bg-[#edf4e9]"
                  }`}
                  style={(selectedCategoryId ?? null) === null ? { backgroundColor: accent } : undefined}
                >
                  Tất cả
                </button>
              ) : (
                <Link
                  to={`${storeBase}/products`}
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: accent }}
                >
                  Tất cả
                </Link>
              )}
              {categories.map((category) => {
                const active = selectedCategoryId === category.id;
                if (onSelectCategory) {
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onSelectCategory(category.id)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        active
                          ? "text-white shadow-sm"
                          : "border border-[#dce6da] bg-white text-[#4c6052] hover:bg-[#edf4e9]"
                      }`}
                      style={active ? { backgroundColor: accent } : undefined}
                    >
                      {category.name}
                    </button>
                  );
                }
                return (
                  <Link
                    key={category.id}
                    to={`${storeBase}/products?categoryId=${category.id}`}
                    className="shrink-0 rounded-full border border-[#dce6da] bg-white px-3.5 py-1.5 text-xs font-bold text-[#4c6052] hover:bg-[#edf4e9]"
                  >
                    {category.name}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      );

    case "upcoming_events": {
      const previewEvents = events.slice(0, 2);
      return (
        <section aria-labelledby="section-events" className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 id="section-events" className="text-base font-extrabold text-[#20392a] sm:text-xl">
                {section.title || "Sự kiện sắp tới"}
              </h2>
              {section.subtitle && <p className="mt-0.5 text-xs muted">{section.subtitle}</p>}
            </div>
            <Link
              to={`${storeBase}/events`}
              className="shrink-0 text-xs font-bold hover:underline"
              style={{ color: accent }}
            >
              Xem tất cả →
            </Link>
          </div>
          {!previewEvents.length ? (
            <Card className="p-4 text-xs muted">Hiện chưa có sự kiện sắp diễn ra.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {previewEvents.map((event) => {
                const eventBanner = resolveStorefrontAssetUrl(event.bannerUrl);
                const eventHref = `${storeBase}/events/${event.slug}`;
                return (
                  <Card key={event.id} className="overflow-hidden">
                    {eventBanner && (
                      <Link to={eventHref} className="block aspect-[16/9] bg-[#edf2e9]">
                        <img src={eventBanner} alt={event.title} className="h-full w-full object-cover" />
                      </Link>
                    )}
                    <div className="p-3.5 sm:p-4">
                      <h3 className="line-clamp-2 text-sm font-extrabold text-[#24452f] sm:text-base">
                        <Link to={eventHref} className="hover:underline">
                          {event.title}
                        </Link>
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#53685a]">
                        <span className="inline-flex items-center gap-1">
                          <Calendar aria-hidden="true" size={13} />
                          {new Date(event.startAt).toLocaleDateString("vi-VN")}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin aria-hidden="true" size={13} />
                          {event.locationName}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      );
    }

    case "store_info":
      return (
        <section aria-labelledby="section-store-info">
          <details className="group rounded-2xl border border-[#e5ece3] bg-white px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold text-[#20392a]">
              <span id="section-store-info">{section.title || `Thông tin ${merchant.name}`}</span>
              <CaretDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-2 border-t border-[#edf2ea] pt-3 text-xs text-[#405b47] sm:grid-cols-3">
              {branding.contactEmail && (
                <p className="flex items-center gap-1.5 break-all">
                  <Envelope aria-hidden="true" size={14} /> {branding.contactEmail}
                </p>
              )}
              {branding.contactPhone && (
                <p className="flex items-center gap-1.5">
                  <Phone aria-hidden="true" size={14} /> {branding.contactPhone}
                </p>
              )}
              {branding.address && (
                <p className="flex items-center gap-1.5 break-words">
                  <MapPin aria-hidden="true" size={14} /> {branding.address}
                </p>
              )}
              {!branding.contactEmail && !branding.contactPhone && !branding.address && (
                <p className="muted">Thông tin liên hệ đang được cập nhật.</p>
              )}
            </div>
          </details>
        </section>
      );

    case "footer":
      return (
        <footer className="border-t border-[#e5ece3] pt-4 text-xs text-[#53685a]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="font-extrabold text-[#24452f]">{merchant.name}</span>
              {branding.footerDescription && (
                <span className="ml-2 line-clamp-1 muted">{branding.footerDescription}</span>
              )}
            </div>
            {branding.allowedLinks.length > 0 && (
              <nav aria-label="Liên kết cửa hàng" className="flex flex-wrap gap-3">
                {branding.allowedLinks.map((link, index) => (
                  <StorefrontLink
                    key={`${link.url}-${index}`}
                    href={link.url}
                    className="font-bold hover:underline"
                    style={{ color: accent }}
                  >
                    {link.label}
                  </StorefrontLink>
                ))}
              </nav>
            )}
          </div>
        </footer>
      );
  }
}
