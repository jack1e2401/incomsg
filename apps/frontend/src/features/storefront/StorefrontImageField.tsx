import { useState, type ChangeEvent } from "react";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import { Button, Field, Input } from "../../components/ui";

function translateUploadError(code: string): string {
  switch (code) {
    case "FILE_REQUIRED":
      return "Vui lòng chọn tệp ảnh hợp lệ.";
    case "FILE_TOO_LARGE":
      return "Ảnh vượt quá giới hạn 5 MB.";
    case "INVALID_FILE_TYPE":
      return "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.";
    default:
      return code;
  }
}

export function StorefrontImageField({
  label,
  value,
  onChange,
  onUpload,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (nextUrl: string | null) => void;
  onUpload: (file: File) => Promise<string>;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const previewSrc = resolveStorefrontAssetUrl(value);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await onUpload(file);
      onChange(url);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "Tải ảnh thất bại";
      setUploadError(translateUploadError(code));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[#e5ece3] bg-[#fcfdf9] p-4">
      <Field label={label} hint={hint}>
        <Input
          type="text"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
          placeholder="https://... hoặc /uploads/..."
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#d7e2d5] bg-white px-3.5 py-2 text-xs font-bold text-[#2f563a] hover:bg-[#edf4e9]">
          <UploadSimple aria-hidden="true" size={15} />
          {uploading ? "Đang tải ảnh..." : "Tải ảnh lên"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="text-[#a4473a] hover:text-[#8d382d]"
          >
            <Trash aria-hidden="true" size={15} /> Xóa ảnh
          </Button>
        )}
      </div>
      {uploadError && (
        <p role="alert" className="text-xs font-semibold text-[#a4473a]">
          {uploadError}
        </p>
      )}
      {previewSrc && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#e5ece3] bg-[#edf2e9]">
          <img src={previewSrc} alt={label} className="max-h-40 w-full object-cover" />
        </div>
      )}
    </div>
  );
}
