import { Link } from "react-router-dom";
import { Calendar, Envelope, MapPin, Phone, ShoppingCart, Storefront } from "@phosphor-icons/react";
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
import { Button, Card, EmptyState } from "../../components/ui";
import { money } from "../../lib/utils";

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
}: {
  section: StorefrontSectionConfig;
  merchant: StorefrontMerchantSummaryDto;
  branding: StorefrontBrandingConfig;
  products: StorefrontProductDto[];
  categories: StorefrontCategoryDto[];
  events: StorefrontEventDto[];
  canAdd: (productId: number, availableQuantity?: number) => boolean;
  onBuy: (product: ProductDto) => void;
}) {
  const accent = branding.primaryColor || "#335e3d";
  const bannerSrc = resolveStorefrontAssetUrl(branding.bannerUrl);
  const heroImgSrc = resolveStorefrontAssetUrl(branding.heroImageUrl) ?? bannerSrc;

  switch (section.key) {
    case "hero":
      return (
        <section
          aria-label="Giới thiệu cửa hàng"
          className="grid overflow-hidden rounded-[2rem] border border-[#e3ebe0] bg-[#edf4e9] md:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
            <h1 className="serif text-balance text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em] text-[#20392a]">
              {branding.heroTitle}
            </h1>
            {branding.heroDescription && (
              <p className="mt-4 max-w-lg whitespace-pre-line text-sm leading-relaxed text-[#405b47] sm:text-base">
                {branding.heroDescription}
              </p>
            )}
            {branding.heroCtaText && branding.heroCtaLink && (
              <div className="mt-6">
                <StorefrontLink
                  href={branding.heroCtaLink}
                  className="inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-bold text-white transition hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  {branding.heroCtaText}
                </StorefrontLink>
              </div>
            )}
          </div>
          <div className="relative min-h-56 bg-[#dce6d5] sm:min-h-72">
            {heroImgSrc ? (
              <img src={heroImgSrc} alt={branding.heroTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[#65846a]">
                <Storefront aria-hidden="true" size={56} weight="light" />
              </div>
            )}
          </div>
        </section>
      );

    case "featured_products":
      return (
        <section id="featured-products" aria-labelledby="section-featured-products" className="space-y-4">
          <div>
            <h2 id="section-featured-products" className="text-xl font-extrabold text-[#20392a] sm:text-2xl">
              {section.title || "Sản phẩm nổi bật"}
            </h2>
            {section.subtitle && <p className="mt-1 text-sm muted">{section.subtitle}</p>}
          </div>
          {!products.length ? (
            <EmptyState
              title="Chưa có sản phẩm nổi bật"
              description="Cửa hàng sẽ cập nhật sản phẩm mới sớm."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const imgSrc = resolveStorefrontAssetUrl(product.imageUrl);
                const available = product.inventory.availableQuantity;
                return (
                  <Card key={product.id} className="flex flex-col overflow-hidden">
                    <Link to={`/s/${merchant.slug}/products/${product.id}`} className="block aspect-[4/3] bg-[#edf2e9]">
                      {imgSrc ? (
                        <img src={imgSrc} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-[#709275]">
                          <Storefront aria-hidden="true" size={36} />
                        </div>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      {product.category && (
                        <span className="text-xs font-bold" style={{ color: accent }}>
                          {product.category.name}
                        </span>
                      )}
                      <h3 className="mt-1 font-extrabold text-[#294432] break-words">
                        <Link to={`/s/${merchant.slug}/products/${product.id}`} className="hover:underline">
                          {product.name}
                        </Link>
                      </h3>
                      {product.description && (
                        <p className="mt-2 line-clamp-2 text-sm muted break-words">{product.description}</p>
                      )}
                      <p className="mt-auto pt-4 text-lg font-extrabold tabular-nums" style={{ color: accent }}>
                        {money(Number(product.price))}
                      </p>
                      <p className="mt-1 text-xs muted">Còn {available} sản phẩm</p>
                      <Button
                        type="button"
                        className="mt-4 w-full"
                        style={{ backgroundColor: available > 0 ? accent : undefined }}
                        disabled={!canAdd(product.id, available)}
                        onClick={() =>
                          onBuy({
                            id: product.id,
                            merchantId: product.merchantId,
                            categoryId: product.categoryId,
                            category: product.category,
                            sku: product.sku,
                            name: product.name,
                            description: product.description,
                            richDescription: null,
                            imageUrl: product.imageUrl,
                            images: [],
                            lowStockThreshold: 5,
                            isLowStock: false,
                            kind: product.kind,
                            status: product.status,
                            price: product.price,
                            inventory: product.inventory,
                          })
                        }
                      >
                        <ShoppingCart aria-hidden="true" size={16} />
                        {available > 0 ? "Chọn mua" : "Hết hàng"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      );

    case "categories":
      return (
        <section aria-labelledby="section-categories" className="space-y-4">
          <div>
            <h2 id="section-categories" className="text-xl font-extrabold text-[#20392a] sm:text-2xl">
              {section.title || "Danh mục"}
            </h2>
            {section.subtitle && <p className="mt-1 text-sm muted">{section.subtitle}</p>}
          </div>
          {!categories.length ? (
            <Card className="p-5 text-sm muted">Cửa hàng chưa tạo danh mục sản phẩm.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <Card key={category.id} className="p-4 sm:p-5">
                  <h3 className="font-extrabold text-[#24452f]">{category.name}</h3>
                  {category.description && (
                    <p className="mt-1.5 text-sm muted break-words">{category.description}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      );

    case "upcoming_events":
      return (
        <section aria-labelledby="section-events" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="section-events" className="text-xl font-extrabold text-[#20392a] sm:text-2xl">
                {section.title || "Sự kiện sắp tới"}
              </h2>
              {section.subtitle && <p className="mt-1 text-sm muted">{section.subtitle}</p>}
            </div>
            <Link
              to={`/s/${merchant.slug}/events`}
              className="text-xs font-bold hover:underline"
              style={{ color: accent }}
            >
              Xem tất cả sự kiện →
            </Link>
          </div>
          {!events.length ? (
            <Card className="p-5 text-sm muted">Hiện chưa có sự kiện sắp diễn ra.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((event) => {
                const eventBanner = resolveStorefrontAssetUrl(event.bannerUrl);
                return (
                  <Card key={event.id} className="overflow-hidden">
                    {eventBanner && (
                      <Link to={`/s/${merchant.slug}/events/${event.slug}`} className="block aspect-[16/9] bg-[#edf2e9]">
                        <img src={eventBanner} alt={event.title} className="h-full w-full object-cover" />
                      </Link>
                    )}
                    <div className="p-4 sm:p-5">
                      <h3 className="font-extrabold text-[#24452f]">
                        <Link to={`/s/${merchant.slug}/events/${event.slug}`} className="hover:underline">
                          {event.title}
                        </Link>
                      </h3>
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#53685a]">
                        <Calendar aria-hidden="true" size={14} />
                        {new Date(event.startAt).toLocaleString("vi-VN")}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs muted">
                        <MapPin aria-hidden="true" size={14} />
                        {event.locationName}
                      </p>
                      <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm muted break-words">
                        {event.description}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      );

    case "store_info":
      return (
        <section aria-labelledby="section-store-info">
          <Card className="p-5 sm:p-6">
            <h2 id="section-store-info" className="text-xl font-extrabold text-[#20392a]">
              {section.title || `Thông tin ${merchant.name}`}
            </h2>
            {section.subtitle && <p className="mt-1 text-sm muted">{section.subtitle}</p>}
            <div className="mt-4 grid gap-3 text-sm text-[#405b47] sm:grid-cols-3">
              {branding.contactEmail && (
                <p className="flex items-center gap-2 break-all">
                  <Envelope aria-hidden="true" size={16} /> {branding.contactEmail}
                </p>
              )}
              {branding.contactPhone && (
                <p className="flex items-center gap-2">
                  <Phone aria-hidden="true" size={16} /> {branding.contactPhone}
                </p>
              )}
              {branding.address && (
                <p className="flex items-center gap-2 break-words">
                  <MapPin aria-hidden="true" size={16} /> {branding.address}
                </p>
              )}
              {!branding.contactEmail && !branding.contactPhone && !branding.address && (
                <p className="muted">Thông tin liên hệ đang được cập nhật.</p>
              )}
            </div>
          </Card>
        </section>
      );

    case "footer":
      return (
        <footer className="border-t border-[#e5ece3] pt-6 text-sm text-[#53685a]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md space-y-2">
              <p className="font-extrabold text-[#24452f]">{merchant.name}</p>
              {branding.footerDescription && (
                <p className="whitespace-pre-line text-xs leading-6 muted break-words">
                  {branding.footerDescription}
                </p>
              )}
            </div>
            {branding.allowedLinks.length > 0 && (
              <nav aria-label="Liên kết cửa hàng" className="flex flex-wrap gap-4">
                {branding.allowedLinks.map((link, index) => (
                  <StorefrontLink
                    key={`${link.url}-${index}`}
                    href={link.url}
                    className="text-xs font-bold hover:underline"
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
