import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { Button, Input } from "../../components/ui";

export type GalleryDraft = { url: string; altText: string };

type Props = {
  images: GalleryDraft[];
  onChange(images: GalleryDraft[]): void;
};

export function MerchantProductGalleryEditor({ images, onChange }: Props) {
  function addRow() {
    if (images.length >= 10) return;
    onChange([...images, { url: "", altText: "" }]);
  }

  function updateRow(index: number, patch: Partial<GalleryDraft>) {
    onChange(images.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function removeRow(index: number) {
    onChange(images.filter((_, idx) => idx !== index));
  }

  function moveRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#294432]">
          Thư viện ảnh (tối đa 10, ảnh đầu tiên là ảnh chính)
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={images.length >= 10}
          onClick={addRow}
        >
          <Plus size={14} /> Thêm ảnh
        </Button>
      </div>
      {images.length === 0 ? (
        <p className="text-xs muted">
          Chưa có ảnh. Hỗ trợ https://, http://, /images/... hoặc /uploads/...
        </p>
      ) : (
        <div className="space-y-2">
          {images.map((img, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#f7f9f5] p-2.5"
            >
              <Input
                type="text"
                aria-label={`URL ảnh ${index + 1}`}
                placeholder="https://... hoặc /images/... hoặc /uploads/..."
                maxLength={2048}
                className="min-w-[12rem] flex-1"
                value={img.url}
                onChange={(event) => updateRow(index, { url: event.target.value })}
              />
              <Input
                type="text"
                aria-label={`Chú thích ảnh ${index + 1}`}
                placeholder="Alt text"
                maxLength={191}
                className="w-36"
                value={img.altText}
                onChange={(event) => updateRow(index, { altText: event.target.value })}
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Đưa ảnh ${index + 1} lên`}
                  disabled={index === 0}
                  onClick={() => moveRow(index, -1)}
                  className="rounded-lg p-1.5 text-[#516357] hover:bg-[#e8f1e2] disabled:opacity-35"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Đưa ảnh ${index + 1} xuống`}
                  disabled={index === images.length - 1}
                  onClick={() => moveRow(index, 1)}
                  className="rounded-lg p-1.5 text-[#516357] hover:bg-[#e8f1e2] disabled:opacity-35"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Xóa ảnh ${index + 1}`}
                  onClick={() => removeRow(index)}
                  className="rounded-lg p-1.5 text-[#a4473a] hover:bg-[#fae7e3]"
                >
                  <Trash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
