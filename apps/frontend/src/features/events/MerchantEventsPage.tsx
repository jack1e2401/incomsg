import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Plus } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import { createEventsClient, translateEventError } from "../../api/events-client";
import type {
  CreateEventInput,
  EventStatus,
  MerchantEventDto,
  UpdateEventInput,
} from "../../api/events-types";
import { useResource } from "../../api/useResource";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { EventFormDialog } from "./EventFormDialog";
import { MerchantEventCard } from "./MerchantEventCard";
import { MerchantEventFilters } from "./MerchantEventFilters";

const eventsApi = createEventsClient();
const commerceApi = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function errorText(reason: unknown): string {
  return translateEventError(reason instanceof Error ? reason.message : "Yêu cầu thất bại");
}

export function MerchantEventsPage() {
  const { accessToken } = useAuthSession();
  const token = accessToken ?? "";
  const [statusFilter, setStatusFilter] = useState<EventStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  const [formTarget, setFormTarget] = useState<MerchantEventDto | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MerchantEventDto | null>(null);
  const [publishTarget, setPublishTarget] = useState<MerchantEventDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    commerceApi
      .getOwnMerchant(token)
      .then((res) => {
        if (active && res?.merchant?.slug) setStoreSlug(res.merchant.slug);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);

  const resource = useResource(
    () => eventsApi.listMerchantEvents({ status: statusFilter, q: searchQuery, page, limit: 10 }, token),
    [token, statusFilter, searchQuery, page],
  );

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  }

  async function handleSaveEvent(payload: CreateEventInput | UpdateEventInput) {
    if (!formTarget || busy) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      if (formTarget === "new") {
        await eventsApi.createMerchantEvent(payload as CreateEventInput, token);
        setNotice("Đã tạo sự kiện nháp.");
      } else {
        await eventsApi.updateMerchantEvent(formTarget.id, payload as UpdateEventInput, token);
        setNotice("Đã cập nhật sự kiện.");
      }
      setFormTarget(null);
      resource.reload();
    } catch (reason) {
      setFormError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  function requestTogglePublish(item: MerchantEventDto) {
    setPublishError("");
    setPublishTarget(item);
  }

  async function handleConfirmTogglePublish() {
    if (!publishTarget || busy) return;
    setBusy(true);
    setPublishError("");
    setNotice("");
    try {
      if (publishTarget.status === "DRAFT") {
        await eventsApi.publishMerchantEvent(publishTarget.id, token);
        setNotice(`Đã xuất bản "${publishTarget.title}".`);
      } else {
        await eventsApi.unpublishMerchantEvent(publishTarget.id, token);
        setNotice(`Đã chuyển "${publishTarget.title}" về trạng thái Nháp.`);
      }
      setPublishTarget(null);
      resource.reload();
    } catch (reason) {
      setPublishError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setDeleteError("");
    setNotice("");
    try {
      await eventsApi.deleteMerchantEvent(deleteTarget.id, token);
      setNotice(`Đã xóa bản nháp "${deleteTarget.title}".`);
      setDeleteTarget(null);
      resource.reload();
    } catch (reason) {
      setDeleteError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination;
  const hasActiveFilters = Boolean(statusFilter || searchQuery);

  function clearFilters() {
    setStatusFilter("");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Sự kiện"
        description="Quản lý bài giới thiệu sự kiện và lịch trình hiển thị tại trang công khai của cửa hàng."
        action={
          <div className="flex flex-wrap gap-2">
            {storeSlug && (
              <Button asChild variant="outline">
                <Link to={`/s/${storeSlug}/events`}>
                  Trang sự kiện công khai <ArrowUpRight size={16} />
                </Link>
              </Button>
            )}
            <Button
              onClick={() => {
                setFormError("");
                setFormTarget("new");
              }}
            >
              <Plus size={16} /> Tạo sự kiện
            </Button>
          </div>
        }
      />

      <MerchantEventFilters
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setPage(1);
          setStatusFilter(val);
        }}
        onSubmit={handleSearchSubmit}
      />

      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-[#e1f2df] p-4 text-sm text-[#357044]">
          {notice}
        </p>
      )}
      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={translateEventError(resource.error)} retry={resource.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "Không tìm thấy sự kiện" : "Chưa có sự kiện"}
          description={
            hasActiveFilters
              ? "Thử đổi từ khóa hoặc trạng thái để xem thêm sự kiện."
              : "Tạo sự kiện mới để thông báo workshop, buổi ra mắt sản phẩm hoặc hoạt động cộng đồng."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setFormError("");
                  setFormTarget("new");
                }}
              >
                Tạo sự kiện đầu tiên
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <MerchantEventCard
              key={item.id}
              item={item}
              storeSlug={storeSlug}
              busy={busy}
              onEdit={(target) => {
                setFormError("");
                setFormTarget(target);
              }}
              onTogglePublish={requestTogglePublish}
              onDelete={(target) => {
                setDeleteError("");
                setDeleteTarget(target);
              }}
            />
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-[#5d6f62]">
                Trang {pagination.page} / {pagination.totalPages} ({pagination.totalItems} sự kiện)
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
        </div>
      )}

      <EventFormDialog
        target={formTarget}
        busy={busy}
        error={formError}
        onClose={() => setFormTarget(null)}
        onSubmit={handleSaveEvent}
      />

      <ConfirmActionDialog
        open={publishTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPublishTarget(null);
            setPublishError("");
          }
        }}
        title={publishTarget?.status === "DRAFT" ? "Xuất bản sự kiện?" : "Gỡ sự kiện khỏi trang công khai?"}
        description={
          publishTarget?.status === "DRAFT"
            ? `“${publishTarget.title}” sẽ hiển thị trên trang sự kiện công khai của cửa hàng.`
            : `“${publishTarget?.title}” sẽ không còn hiển thị công khai. Nội dung vẫn được giữ ở trạng thái nháp.`
        }
        confirmLabel={publishTarget?.status === "DRAFT" ? "Xác nhận xuất bản" : "Xác nhận gỡ xuất bản"}
        busy={busy}
        error={publishError}
        onConfirm={handleConfirmTogglePublish}
      />
      <ConfirmActionDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xóa bản nháp sự kiện?"
        description={
          deleteTarget ? `Bản nháp "${deleteTarget.title}" sẽ bị xóa vĩnh viễn và không thể khôi phục.` : ""
        }
        confirmLabel="Xóa bản nháp"
        destructive
        busy={busy}
        error={deleteError}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
