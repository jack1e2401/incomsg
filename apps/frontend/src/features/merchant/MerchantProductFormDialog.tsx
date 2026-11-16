import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type { ProductCategoryDto, ProductDto } from "../../api/commerce-types";
import { Button, BusyLabel, Field, Input, Select, Textarea } from "../../components/ui";
import { MerchantProductGalleryEditor, type GalleryDraft } from "./MerchantProductGalleryEditor";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

type ProductFormState = {
  kind: ProductDto["kind"];
  name: string;
  price: string;
  sku: string;
  categoryId: string;
  lowStockThreshold: string;
  description: string;
  richDescription: string;
  images: GalleryDraft[];
  status: ProductDto["status"];
  initialQuantity: string;
};

function toInitialState(product: ProductDto | "new"): ProductFormState {
  if (product === "new") {
    return {
      kind: "SALE",
      name: "",
      price: "",
      sku: "",
      categoryId: "",
      lowStockThreshold: "5",
      description: "",
      richDescription: "",
      images: [],
      status: "ACTIVE",
      initialQuantity: "0",
    };
  }
  const existingImages: GalleryDraft[] =
    product.images && product.images.length > 0
      ? product.images.map((img) => ({ url: img.url, altText: img.altText ?? "" }))
      : product.imageUrl
        ? [{ url: product.imageUrl, altText: "" }]
        : [];
  return {
    kind: product.kind ?? "SALE",
    name: product.name,
    price: product.price,
    sku: product.sku ?? "",
    categoryId: product.categoryId ? String(product.categoryId) : "",
    lowStockThreshold: String(product.lowStockThreshold ?? 5),
    description: product.description ?? "",
    richDescription: product.richDescription ?? "",
    images: existingImages,
    status: product.status,
    initialQuantity: "0",
  };
}

type Props = {
  editing: ProductDto | "new" | null;
  categories: ProductCategoryDto[];
  token: string;
  onClose(): void;
  onSaved(product: ProductDto, isNew: boolean): void;
};

export function MerchantProductFormDialog({ editing, categories, token, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProductFormState>(() => toInitialState(editing ?? "new"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editing !== null) {
      setForm(toInitialState(editing));
      setError("");
    }
  }, [editing]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !editing) return;
    setError("");
    setBusy(true);
    try {
      const cleanedImages = form.images
        .map((img, index) => ({
          url: img.url.trim(),
          altText: img.altText.trim() || null,
          sortOrder: index,
        }))
        .filter((img) => img.url.length > 0);
      const threshold = Number(form.lowStockThreshold || "5");
      const categoryId = form.categoryId ? Number(form.categoryId) : null;
      const sku = form.sku.trim() || null;
      const richDescription = form.richDescription.trim() ? form.richDescription : null;

      if (editing === "new") {
        const baseFields = {
          name: form.name.trim(),
          description: form.description || null,
          imageUrl: cleanedImages[0]?.url ?? null,
          ...(cleanedImages.length > 0 ? { images: cleanedImages } : {}),
          ...(richDescription !== null ? { richDescription } : {}),
          ...(sku !== null ? { sku } : {}),
          ...(categoryId !== null ? { categoryId } : {}),
          ...(threshold !== 5 ? { lowStockThreshold: threshold } : {}),
          initialQuantity: Number(form.initialQuantity || "0"),
        };
        const result = await api.createProduct(
          form.kind === "REWARD"
            ? { ...baseFields, kind: "REWARD" }
            : { ...baseFields, price: form.price.trim() },
          token,
        );
        onSaved(result.product, true);
      } else {
        const result = await api.updateProduct(
          editing.id,
          {
            name: form.name.trim(),
            description: form.description || null,
            richDescription,
            sku,
            categoryId,
            lowStockThreshold: threshold,
            images: cleanedImages,
            ...(form.kind === "SALE" ? { price: form.price.trim() } : {}),
            status: form.status,
          },
          token,
        );
        onSaved(result.product, false);
      }
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "Không thể lưu sản phẩm.";
      setError(translateApiError(raw));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      {editing && (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-8">
            <Dialog.Title className="text-lg font-extrabold">
              {editing === "new" ? "Thêm sản phẩm" : `Sửa sản phẩm #${editing.id}`}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Nhập thông tin sản phẩm và lưu thay đổi.
            </Dialog.Description>
            <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Loại sản phẩm">
                <Select
                  disabled={editing !== "new" || busy}
                  value={form.kind}
                  onChange={(event) =>
                    setForm({ ...form, kind: event.target.value as ProductDto["kind"] })
                  }
                >
                  <option value="SALE">Sản phẩm bán</option>
                  <option value="REWARD">Chỉ đổi thưởng</option>
                </Select>
              </Field>
              <Field label="Tên sản phẩm">
                <Input
                  required
                  maxLength={191}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Mã SKU">
                <Input
                  maxLength={64}
                  placeholder="Ví dụ: CF-001"
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                />
              </Field>
              <Field label="Danh mục">
                <Select
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  <option value="">Không có danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {form.kind === "SALE" && (
                <Field label="Giá (VND)">
                  <Input
                    required
                    inputMode="numeric"
                    pattern="[1-9][0-9]{0,14}"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                  />
                </Field>
              )}
              {editing === "new" && (
                <Field label="Số lượng ban đầu">
                  <Input
                    required
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    value={form.initialQuantity}
                    onChange={(event) => setForm({ ...form, initialQuantity: event.target.value })}
                  />
                </Field>
              )}
              <Field label="Ngưỡng cảnh báo tồn kho thấp">
                <Input
                  required
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  value={form.lowStockThreshold}
                  onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })}
                />
              </Field>
              {editing !== "new" && (
                <Field label="Trạng thái">
                  <Select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as ProductDto["status"] })
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="HIDDEN">HIDDEN</option>
                  </Select>
                </Field>
              )}
              <div className="sm:col-span-2">
                <Field label="Mô tả">
                  <Textarea
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Mô tả chi tiết (plain text)">
                  <Textarea
                    maxLength={5000}
                    rows={4}
                    placeholder="Thông tin nguồn gốc, hướng dẫn bảo quản..."
                    value={form.richDescription}
                    onChange={(event) => setForm({ ...form, richDescription: event.target.value })}
                  />
                </Field>
              </div>

              <MerchantProductGalleryEditor
                images={form.images}
                onChange={(images) => setForm({ ...form, images })}
              />

              {error && (
                <p role="alert" className="sm:col-span-2 text-sm text-[#a4473a]">
                  {error}
                </p>
              )}
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu sản phẩm"}
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                  Hủy
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
