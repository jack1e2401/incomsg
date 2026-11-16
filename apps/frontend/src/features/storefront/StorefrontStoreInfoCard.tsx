import { Clock, Envelope, MapPin, Phone, Storefront } from "@phosphor-icons/react";
import type { StorefrontBrandingConfig, StorefrontMerchantSummaryDto } from "../../api/storefront-types";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";

const WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export function StorefrontStoreInfoCard({
  merchant,
  branding,
}: {
  merchant: StorefrontMerchantSummaryDto;
  branding: StorefrontBrandingConfig;
}) {
  const imageSrc = resolveStorefrontAssetUrl(branding.storeImageUrl ?? branding.logoUrl);
  const contactHref = branding.contactPhone
    ? `tel:${branding.contactPhone.replace(/[^+\d]/g, "")}`
    : branding.contactEmail
      ? `mailto:${branding.contactEmail}`
      : null;
  const mapsHref = branding.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branding.address)}`
    : null;

  return (
    <section aria-labelledby="store-info-title" className="rounded-2xl border border-[#e5ece3] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        {imageSrc ? (
          <img src={imageSrc} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#edf4e9] text-[#335e3d]">
            <Storefront aria-hidden="true" size={24} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="store-info-title" className="text-base font-extrabold text-[#20392a]">Thông tin cửa hàng</h2>
          <p className="mt-0.5 text-sm font-semibold text-[#53685a]">{merchant.name}</p>
          <div className="mt-3 grid gap-2 text-sm text-[#405b47] sm:grid-cols-2">
            {branding.address && (
              <p className="flex items-start gap-2 break-words">
                <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
                {branding.address}
              </p>
            )}
            {branding.openingHours && (
              <div className="flex items-start gap-2">
                <Clock aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
                <ul className="space-y-0.5">
                  {branding.openingHours.map((hours) => (
                    <li key={hours.day}>
                      <span className="font-semibold">{WEEKDAYS[hours.day - 1]}:</span>{" "}
                      {hours.closed
                        ? "Nghỉ"
                        : hours.openTime && hours.closeTime
                          ? `${hours.openTime}–${hours.closeTime}`
                          : "Chưa cập nhật"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {branding.contactPhone && (
              <a href={`tel:${branding.contactPhone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 hover:underline">
                <Phone aria-hidden="true" size={16} /> {branding.contactPhone}
              </a>
            )}
            {branding.contactEmail && (
              <a href={`mailto:${branding.contactEmail}`} className="flex min-w-0 items-center gap-2 break-all hover:underline">
                <Envelope aria-hidden="true" size={16} className="shrink-0" /> {branding.contactEmail}
              </a>
            )}
          </div>
          {(mapsHref || contactHref) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#edf4e9] px-4 text-sm font-bold text-[#294833] hover:bg-[#e1ecd9]"
                >
                  <MapPin aria-hidden="true" size={16} /> Chỉ đường
                </a>
              )}
              {contactHref && (
                <a
                  href={contactHref}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#335e3d] px-4 text-sm font-bold text-white hover:bg-[#294833]"
                >
                  {branding.contactPhone ? <Phone aria-hidden="true" size={16} /> : <Envelope aria-hidden="true" size={16} />}
                  Liên hệ
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
