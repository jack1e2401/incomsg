import { ArrowUpRight, CalendarBlank, MapPin } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { MerchantEventDto } from "../../api/events-types";
import { Button, Card, StatusText } from "../../components/ui";
import { formatEventSchedule } from "./event-format";

export interface MerchantEventCardProps {
  item: MerchantEventDto;
  storeSlug: string | null;
  busy: boolean;
  onEdit: (item: MerchantEventDto) => void;
  onTogglePublish: (item: MerchantEventDto) => void;
  onDelete: (item: MerchantEventDto) => void;
}

export function MerchantEventCard({
  item,
  storeSlug,
  busy,
  onEdit,
  onTogglePublish,
  onDelete,
}: MerchantEventCardProps) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusText tone={item.status === "PUBLISHED" ? "green" : "amber"}>
              {item.status === "PUBLISHED" ? "Đã xuất bản" : "Nháp"}
            </StatusText>
            <span className="text-xs font-medium text-[#637269]">/{item.slug}</span>
          </div>
          <h2 className="text-lg font-extrabold text-[#20392a]">{item.title}</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[#4a6251]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank size={16} weight="light" aria-hidden="true" />
              {formatEventSchedule(item.startAt, item.endAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={16} weight="light" aria-hidden="true" />
              {item.locationName}
              {item.locationAddress ? ` — ${item.locationAddress}` : ""}
            </span>
          </div>
          <p className="line-clamp-2 whitespace-pre-line text-sm text-[#5d6f62]">
            {item.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
          {item.status === "PUBLISHED" && storeSlug && (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/s/${storeSlug}/events/${item.slug}`}>
                Xem công khai <ArrowUpRight size={14} />
              </Link>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onEdit(item)}
          >
            Chỉnh sửa
          </Button>
          <Button
            type="button"
            size="sm"
            variant={item.status === "DRAFT" ? "default" : "outline"}
            disabled={busy}
            onClick={() => onTogglePublish(item)}
          >
            {item.status === "DRAFT" ? "Xuất bản" : "Gỡ xuất bản"}
          </Button>
          {item.status === "DRAFT" && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => onDelete(item)}
            >
              Xóa
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
