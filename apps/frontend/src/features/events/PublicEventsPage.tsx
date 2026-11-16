import { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarBlank, MapPin } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { createEventsClient, translateEventError } from "../../api/events-client";
import type { MerchantEventDto, PublicEventScope } from "../../api/events-types";
import { useResource } from "../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { formatEventSchedule } from "./event-format";

const eventsApi = createEventsClient();

const scopeTabs: { key: PublicEventScope; label: string }[] = [
  { key: "upcoming", label: "Sắp diễn ra" },
  { key: "past", label: "Đã qua" },
  { key: "all", label: "Tất cả" },
];

export function PublicEventsPage() {
  const { slug = "" } = useParams();
  const [scope, setScope] = useState<PublicEventScope>("upcoming");
  const [page, setPage] = useState(1);

  const resource = useResource(
    () => eventsApi.listPublicStoreEvents(slug, { scope, page, limit: 12 }),
    [slug, scope, page],
  );

  const storeName = resource.data?.merchant?.name ?? slug;
  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination;

  return (
    <main className="min-h-dvh bg-[#f7f8f4]">
      <header className="border-b border-[#e7ede6] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <Link
              to={`/s/${encodeURIComponent(slug)}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#335e3d] hover:text-[#20392a]"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Quay lại cửa hàng
            </Link>
            <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-[#20392a]">
              Sự kiện tại {storeName}
            </h1>
          </div>
          <Link
            to={`/s/${encodeURIComponent(slug)}`}
            className="hidden shrink-0 rounded-full bg-[#edf4e9] px-4 py-2 text-xs font-bold text-[#335e3d] hover:bg-[#e1eed9] sm:inline-flex"
          >
            /s/{slug}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Lọc thời gian sự kiện">
          {scopeTabs.map((tab) => {
            const active = scope === tab.key;
            return (
              <Button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPage(1);
                  setScope(tab.key);
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>

        {resource.loading ? (
          <LoadingState cards={3} />
        ) : resource.error ? (
          <ErrorState message={translateEventError(resource.error)} retry={resource.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Chưa có sự kiện phù hợp"
            description="Hiện chưa có sự kiện nào được xuất bản trong mục này."
            action={
              <Button asChild variant="outline">
                <Link to={`/s/${encodeURIComponent(slug)}`}>Quay lại cửa hàng</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((eventItem) => (
                <li key={eventItem.id} className="min-w-0">
                  <PublicEventCard storeSlug={slug} event={eventItem} />
                </li>
              ))}
            </ul>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm text-[#5d6f62]">
                  Trang {pagination.page} / {pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Trước
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function PublicEventCard({ storeSlug, event }: { storeSlug: string; event: MerchantEventDto }) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const detailPath = `/s/${encodeURIComponent(storeSlug)}/events/${encodeURIComponent(event.slug)}`;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-[#e8efe4] text-[#54725a]">
        <CalendarBlank size={40} weight="light" aria-hidden="true" />
        {event.bannerUrl && failedBanner !== event.bannerUrl && (
          <img
            src={event.bannerUrl}
            alt={event.title}
            loading="lazy"
            decoding="async"
            onError={() => setFailedBanner(event.bannerUrl)}
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="text-lg font-extrabold leading-snug text-[#20392a]">
          <Link to={detailPath} className="hover:text-[#335e3d]">
            {event.title}
          </Link>
        </h2>
        <div className="space-y-1.5 text-sm text-[#4a6251]">
          <p className="flex items-start gap-2">
            <CalendarBlank size={16} weight="light" className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{formatEventSchedule(event.startAt, event.endAt)}</span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin size={16} weight="light" className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {event.locationName}
              {event.locationAddress ? ` — ${event.locationAddress}` : ""}
            </span>
          </p>
        </div>
        <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#5d6f62]">
          {event.description}
        </p>
        <div className="mt-auto pt-2">
          <Button asChild size="sm" variant="outline">
            <Link to={detailPath}>
              Xem chi tiết <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
