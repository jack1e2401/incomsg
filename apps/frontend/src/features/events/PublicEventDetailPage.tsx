import { useState } from "react";
import { ArrowLeft, CalendarBlank, MapPin } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { createEventsClient, translateEventError } from "../../api/events-client";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, LoadingState } from "../../components/ui";
import { useEnsureMembership } from "../customers/useEnsureMembership";
import { formatEventSchedule } from "./event-format";

const eventsApi = createEventsClient();

export function PublicEventDetailPage() {
  const { slug = "", eventSlug = "" } = useParams();
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  useEnsureMembership({ slug });

  const resource = useResource(
    () => eventsApi.getPublicStoreEvent(slug, eventSlug),
    [slug, eventSlug],
  );

  const storeName = resource.data?.merchant?.name ?? slug;
  const event = resource.data?.event;

  return (
    <main className="min-h-dvh bg-[#f7f8f4]">
      <header className="border-b border-[#e7ede6] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/s/${encodeURIComponent(slug)}/events`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#335e3d] hover:text-[#20392a]"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Tất cả sự kiện
            </Link>
            <span className="text-sm font-bold text-[#20392a]">{storeName}</span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to={`/s/${encodeURIComponent(slug)}`}>Quay lại cửa hàng</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        {resource.loading ? (
          <LoadingState cards={1} />
        ) : resource.error || !event ? (
          <ErrorState
            message={translateEventError(resource.error ?? "EVENT_NOT_FOUND")}
            retry={resource.reload}
          />
        ) : (
          <Card className="overflow-hidden">
            {event.bannerUrl && failedBanner !== event.bannerUrl && (
              <div className="aspect-[16/8] w-full overflow-hidden bg-[#e8efe4]">
                <img
                  src={resolveStorefrontAssetUrl(event.bannerUrl) ?? event.bannerUrl}
                  alt={event.title}
                  onError={() => setFailedBanner(event.bannerUrl)}
                  className="size-full object-cover"
                />
              </div>
            )}
            <div className="space-y-6 p-6 sm:p-8">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#20392a] sm:text-3xl">
                  {event.title}
                </h1>
              </div>

              <div className="grid gap-3 rounded-2xl bg-[#f4f7f2] p-4 text-sm text-[#2c4a35] sm:grid-cols-2 sm:p-5">
                <div className="flex items-start gap-2.5">
                  <CalendarBlank size={18} weight="light" className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-[#5d6f62]">Thời gian</p>
                    <p className="mt-0.5 font-semibold">
                      {formatEventSchedule(event.startAt, event.endAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin size={18} weight="light" className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-[#5d6f62]">Địa điểm</p>
                    <p className="mt-0.5 font-semibold">{event.locationName}</p>
                    {event.locationAddress && (
                      <p className="mt-0.5 text-xs text-[#5d6f62]">{event.locationAddress}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#e7ede6] pt-6">
                <h2 className="mb-3 text-base font-extrabold text-[#20392a]">Thông tin chi tiết</h2>
                <p className="whitespace-pre-line text-base leading-7 text-[#34493b]">
                  {event.description}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
