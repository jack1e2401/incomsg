import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpRight, FloppyDisk, RocketLaunch } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { createStorefrontClient } from "../../api/storefront-client";
import type {
  StorefrontConfig,
  StorefrontSectionConfig,
  StorefrontSectionKey,
  StorefrontVersionSummaryDto,
} from "../../api/storefront-types";
import { useResource } from "../../api/useResource";
import {
  BusyLabel,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  StatusText,
  Textarea,
} from "../../components/ui";
import { StorefrontImageField } from "./StorefrontImageField";
import { StorefrontOpeningHoursEditor } from "./StorefrontOpeningHoursEditor";
import { StorefrontVersionHistory } from "./StorefrontVersionHistory";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const storefrontApi = createStorefrontClient(apiBase);
const commerceApi = createCommerceClient(apiBase);

const SECTION_LABELS: Record<StorefrontSectionKey, string> = {
  hero: "Hero đầu trang",
  featured_products: "Sản phẩm nổi bật",
  categories: "Danh mục sản phẩm",
  upcoming_events: "Sự kiện sắp tới",
  store_info: "Thông tin cửa hàng",
  footer: "Chân trang",
};

function translateStorefrontError(code: string): string {
  switch (code) {
    case "INVALID_FEATURED_PRODUCTS":
      return "Có sản phẩm nổi bật không hợp lệ hoặc không còn đang bán.";
    case "INVALID_INPUT":
      return "Dữ liệu chưa hợp lệ. Kiểm tra màu hex (#RRGGBB), đường dẫn (/s/... hoặc https://...) và không dùng thẻ HTML.";
    case "VERSION_NOT_FOUND":
      return "Không tìm thấy phiên bản để khôi phục.";
    default:
      return code;
  }
}

export function MerchantStorefrontEditor() {
  const { accessToken } = useAuthSession();
  const state = useResource(
    async () => {
      const [storefront, versionsRes, productsRes] = await Promise.all([
        storefrontApi.getMerchantStorefront(accessToken!),
        storefrontApi.listVersions(accessToken!),
        commerceApi.listOwnProducts(accessToken!, { limit: 100 }),
      ]);
      return {
        storefront,
        versions: versionsRes.versions,
        saleProducts: productsRes.items.filter((p) => p.kind === "SALE" && p.status === "ACTIVE"),
      };
    },
    [accessToken],
  );

  const [draft, setDraft] = useState<StorefrontConfig | null>(null);
  const [versions, setVersions] = useState<StorefrontVersionSummaryDto[]>([]);
  const [published, setPublished] = useState<StorefrontVersionSummaryDto | null>(null);
  const [publishNote, setPublishNote] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollbackId, setRollbackId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state.data) return;
    setDraft(state.data.storefront.draft.config);
    setPublished(state.data.storefront.published);
    setVersions(state.data.versions);
  }, [state.data]);

  const orderedSections = useMemo(
    () => (draft ? draft.sections.filter((section) => section.key !== "store_info" && section.key !== "footer").sort((a, b) => a.order - b.order) : []),
    [draft],
  );

  if (state.loading && !draft) return <LoadingState cards={3} />;
  if (state.error && !draft) return <ErrorState message={state.error} retry={state.reload} />;
  if (!state.data || !draft) return null;

  const merchant = state.data.storefront.merchant;
  const saleProducts: ProductDto[] = state.data.saleProducts;

  function updateBranding<K extends keyof StorefrontConfig["branding"]>(
    key: K,
    value: StorefrontConfig["branding"][K],
  ) {
    setDraft((current) => (current ? { ...current, branding: { ...current.branding, [key]: value } } : current));
  }

  function updateSection(key: StorefrontSectionKey, patch: Partial<StorefrontSectionConfig>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => (section.key === key ? { ...section, ...patch } : section)),
      };
    });
  }

  function moveSection(index: number, delta: -1 | 1) {
    if (!draft) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= orderedSections.length) return;
    const next = [...orderedSections];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    const reindexed = next.map((section, idx) => ({ ...section, order: idx }));
    const fixedSections = ["store_info", "footer"].flatMap((key, idx) => {
      const section = draft.sections.find((item) => item.key === key);
      return section ? [{ ...section, order: reindexed.length + idx }] : [];
    });
    setDraft((current) => (current ? { ...current, sections: [...reindexed, ...fixedSections] } : current));
  }

  function toggleFeaturedProduct(productId: number) {
    setDraft((current) => {
      if (!current) return current;
      const exists = current.featuredProductIds.includes(productId);
      if (exists) {
        return {
          ...current,
          featuredProductIds: current.featuredProductIds.filter((id) => id !== productId),
        };
      }
      if (current.featuredProductIds.length >= 6) {
        setError("Tối đa 6 sản phẩm nổi bật.");
        return current;
      }
      setError("");
      return {
        ...current,
        featuredProductIds: [...current.featuredProductIds, productId],
      };
    });
  }

  async function handleSaveDraft() {
    if (!accessToken || !draft || savingDraft) return;
    setSavingDraft(true);
    setNotice("");
    setError("");
    try {
      const response = await storefrontApi.saveDraft(draft, accessToken);
      setDraft(response.draft.config);
      setNotice("Đã lưu bản nháp thành công.");
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Lưu bản nháp thất bại"));
    } finally {
      setSavingDraft(false);
    }
  }

  async function handlePublish() {
    if (!accessToken || !draft || publishing) return;
    setPublishing(true);
    setNotice("");
    setError("");
    try {
      const saved = await storefrontApi.saveDraft(draft, accessToken);
      setDraft(saved.draft.config);
      const res = await storefrontApi.publish(publishNote.trim() || undefined, accessToken);
      setPublished(res.published);
      setPublishNote("");
      const nextVersions = await storefrontApi.listVersions(accessToken);
      setVersions(nextVersions.versions);
      setNotice(`Đã xuất bản phiên bản v${res.published.version}.`);
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Xuất bản thất bại"));
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback(versionId: number) {
    if (!accessToken || rollbackId !== null) return;
    setRollbackId(versionId);
    setNotice("");
    setError("");
    try {
      const res = await storefrontApi.rollbackVersion(versionId, undefined, accessToken);
      setDraft(res.draft.config);
      setPublished(res.published);
      const nextVersions = await storefrontApi.listVersions(accessToken);
      setVersions(nextVersions.versions);
      setNotice(`Đã khôi phục thành phiên bản v${res.published.version}.`);
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Khôi phục thất bại"));
    } finally {
      setRollbackId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giao diện cửa hàng"
        description={`Đường dẫn công khai: /s/${merchant.slug}${published ? ` · Đang hiển thị v${published.version}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/s/${merchant.slug}?preview=draft`}>
                Xem trước bản nháp <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/s/${merchant.slug}`}>
                Trang công khai <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </Button>
          </div>
        }
      />

      {error && (
        <div role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-sm font-semibold text-[#a4473a]">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl bg-[#e8f1e2] p-3 text-sm font-semibold text-[#357044]">
          {notice}
        </div>
      )}

      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#20392a]">Thương hiệu & nội dung đầu trang</h2>
          <StatusText tone="neutral">/s/{merchant.slug}</StatusText>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StorefrontImageField
            label="Logo cửa hàng"
            value={draft.branding.logoUrl}
            onChange={(url) => updateBranding("logoUrl", url)}
            onUpload={(file) => storefrontApi.uploadMedia(file, accessToken!).then((r) => r.url)}
          />
          <StorefrontImageField
            label="Ảnh cửa hàng"
            value={draft.branding.storeImageUrl ?? null}
            onChange={(url) => updateBranding("storeImageUrl", url)}
            onUpload={(file) => storefrontApi.uploadMedia(file, accessToken!).then((r) => r.url)}
            hint="Nếu để trống, logo cửa hàng sẽ được dùng thay thế."
          />
          <StorefrontImageField
            label="Ảnh bìa (Banner)"
            value={draft.branding.bannerUrl}
            onChange={(url) => updateBranding("bannerUrl", url)}
            onUpload={(file) => storefrontApi.uploadMedia(file, accessToken!).then((r) => r.url)}
          />
          <StorefrontImageField
            label="Ảnh Hero"
            value={draft.branding.heroImageUrl}
            onChange={(url) => updateBranding("heroImageUrl", url)}
            onUpload={(file) => storefrontApi.uploadMedia(file, accessToken!).then((r) => r.url)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tiêu đề Hero *">
            <Input
              required
              maxLength={120}
              value={draft.branding.heroTitle}
              onChange={(event) => updateBranding("heroTitle", event.target.value)}
            />
          </Field>
          <Field label="Màu chủ đạo (#RRGGBB)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Chọn màu chủ đạo"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.branding.primaryColor) ? draft.branding.primaryColor : "#335e3d"}
                onChange={(event) => updateBranding("primaryColor", event.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-[#e4eae2] bg-white p-1"
              />
              <Input
                value={draft.branding.primaryColor}
                maxLength={7}
                onChange={(event) => updateBranding("primaryColor", event.target.value)}
                placeholder="#335e3d"
              />
            </div>
          </Field>
        </div>

        <Field label="Mô tả Hero">
          <Textarea
            maxLength={500}
            value={draft.branding.heroDescription ?? ""}
            onChange={(event) => updateBranding("heroDescription", event.target.value || null)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chữ nút kêu gọi (CTA)">
            <Input
              maxLength={60}
              value={draft.branding.heroCtaText ?? ""}
              onChange={(event) => updateBranding("heroCtaText", event.target.value || null)}
            />
          </Field>
          <Field label="Liên kết nút CTA" hint={`/s/${merchant.slug}... hoặc https://...`}>
            <Input
              maxLength={2048}
              value={draft.branding.heroCtaLink ?? ""}
              onChange={(event) => updateBranding("heroCtaLink", event.target.value || null)}
              placeholder={`/s/${merchant.slug}`}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Email liên hệ">
            <Input
              type="email"
              maxLength={191}
              value={draft.branding.contactEmail ?? ""}
              onChange={(event) => updateBranding("contactEmail", event.target.value || null)}
            />
          </Field>
          <Field label="Số điện thoại">
            <Input
              maxLength={40}
              value={draft.branding.contactPhone ?? ""}
              onChange={(event) => updateBranding("contactPhone", event.target.value || null)}
            />
          </Field>
          <Field label="Địa chỉ">
            <Input
              maxLength={255}
              value={draft.branding.address ?? ""}
              onChange={(event) => updateBranding("address", event.target.value || null)}
            />
          </Field>
        </div>

        <StorefrontOpeningHoursEditor
          value={draft.branding.openingHours ?? null}
          onChange={(openingHours) => updateBranding("openingHours", openingHours)}
        />

      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-[#20392a]">Bố cục các mục hiển thị</h2>
        <div className="space-y-3">
          {orderedSections.map((section, index) => (
            <div
              key={section.key}
              className="grid gap-3 rounded-2xl border border-[#e5ece3] bg-[#fcfdf9] p-4 md:grid-cols-[auto_1fr_1fr_auto] md:items-center"
            >
              <label className="flex items-center gap-2 text-sm font-bold text-[#24452f]">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(event) => updateSection(section.key, { enabled: event.target.checked })}
                  className="size-4 accent-[#335e3d]"
                />
                {SECTION_LABELS[section.key]}
              </label>
              <Input
                value={section.title ?? ""}
                maxLength={120}
                placeholder="Tiêu đề mục (tùy chọn)"
                onChange={(event) => updateSection(section.key, { title: event.target.value || null })}
              />
              <Input
                value={section.subtitle ?? ""}
                maxLength={255}
                placeholder="Phụ đề mục (tùy chọn)"
                onChange={(event) => updateSection(section.key, { subtitle: event.target.value || null })}
              />
              <div className="flex items-center gap-1 justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  aria-label={`Đưa ${SECTION_LABELS[section.key]} lên`}
                  onClick={() => moveSection(index, -1)}
                >
                  <ArrowUp aria-hidden="true" size={14} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === orderedSections.length - 1}
                  aria-label={`Đưa ${SECTION_LABELS[section.key]} xuống`}
                  onClick={() => moveSection(index, 1)}
                >
                  <ArrowDown aria-hidden="true" size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#20392a]">Sản phẩm nổi bật</h2>
          <span className="text-xs font-semibold muted">{draft.featuredProductIds.length}/6 đã chọn</span>
        </div>
        {!saleProducts.length ? (
          <p className="text-sm muted">Chưa có sản phẩm đang bán để chọn làm sản phẩm nổi bật.</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {saleProducts.map((product) => {
              const selected = draft.featuredProductIds.includes(product.id);
              return (
                <label
                  key={product.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    selected ? "border-[#335e3d] bg-[#edf4e9]" : "border-[#e5ece3] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleFeaturedProduct(product.id)}
                    className="size-4 accent-[#335e3d]"
                  />
                  <span className="min-w-0 flex-1 truncate font-bold text-[#24452f]">{product.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-[#53685a] tabular-nums">
                    {Number(product.price).toLocaleString("vi-VN")} ₫
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="flex-1">
          <Field label="Ghi chú xuất bản (tùy chọn)">
            <Input
              maxLength={255}
              value={publishNote}
              onChange={(event) => setPublishNote(event.target.value)}
              placeholder="Ví dụ: Cập nhật banner mùa lễ hội"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={savingDraft || publishing}
            onClick={handleSaveDraft}
          >
            {savingDraft ? (
              <BusyLabel>Đang lưu</BusyLabel>
            ) : (
              <>
                <FloppyDisk aria-hidden="true" size={16} /> Lưu bản nháp
              </>
            )}
          </Button>
          <Button type="button" disabled={savingDraft || publishing} onClick={handlePublish}>
            {publishing ? (
              <BusyLabel>Đang xuất bản</BusyLabel>
            ) : (
              <>
                <RocketLaunch aria-hidden="true" size={16} /> Xuất bản
              </>
            )}
          </Button>
        </div>
      </Card>

      <StorefrontVersionHistory
        versions={versions}
        busyVersionId={rollbackId}
        onRollback={handleRollback}
      />
    </div>
  );
}
