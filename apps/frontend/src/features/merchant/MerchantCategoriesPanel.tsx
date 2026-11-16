import { useState, type FormEvent } from "react";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type { ProductCategoryDto } from "../../api/commerce-types";
import { Button, BusyLabel, Card, Field, Input } from "../../components/ui";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

type Props = {
  token: string;
  categories: ProductCategoryDto[];
  loading: boolean;
  error: string | null;
  onChanged(): void;
};

type CategoryFormState = {
  id: number | null;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
};

const emptyForm: CategoryFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
};

export function MerchantCategoriesPanel({ token, categories, loading, error, onChanged }: Props) {
  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  function openNew() {
    setForm(emptyForm);
    setActionError("");
    setNotice("");
  }

  function openEdit(cat: ProductCategoryDto) {
    setForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      sortOrder: String(cat.sortOrder),
    });
    setActionError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const sortOrder = Number(form.sortOrder || "0");
      const payload = {
        name: form.name.trim(),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        description: form.description.trim() || null,
        sortOrder,
      };
      if (form.id === null) {
        await api.createCategory(payload, token);
        setNotice("Đã tạo danh mục.");
      } else {
        await api.updateCategory(form.id, payload, token);
        setNotice("Đã cập nhật danh mục.");
      }
      setForm(null);
      onChanged();
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "Không thể lưu danh mục.";
      setActionError(translateApiError(raw));
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: ProductCategoryDto) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await api.deleteCategory(category.id, token);
      if (form?.id === category.id) setForm(null);
      setNotice(`Đã xóa danh mục "${category.name}". Các sản phẩm thuộc danh mục này đã được gỡ liên kết.`);
      onChanged();
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "Không thể xóa danh mục.";
      setActionError(translateApiError(raw));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#20392a]">Danh mục sản phẩm</h2>
          <p className="mt-0.5 text-xs muted">
            Phân nhóm sản phẩm để khách dễ lọc trên gian hàng. Xóa danh mục sẽ giữ nguyên sản phẩm.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openNew}>
          <Plus size={15} /> Thêm danh mục
        </Button>
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-[#e1f2df] p-3 text-sm text-[#357044]">
          {notice}
        </p>
      )}
      {(actionError || error) && (
        <p role="alert" className="mt-4 rounded-xl bg-[#fae7e3] p-3 text-sm text-[#a4473a]">
          {actionError || error}
        </p>
      )}

      {form && (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl bg-[#f7f9f5] p-4 sm:grid-cols-4">
          <Field label="Tên danh mục">
            <Input
              required
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Slug (tùy chọn)">
            <Input
              maxLength={120}
              placeholder="tu-dong-tao"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Mô tả danh mục">
            <Input
              maxLength={255}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label="Thứ tự">
            <Input
              type="number"
              min={0}
              max={100000}
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-4">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <BusyLabel>Đang lưu</BusyLabel> : form.id === null ? "Tạo danh mục" : "Lưu danh mục"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setForm(null)}>
              Hủy
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="mt-4 text-sm muted">Đang tải danh mục…</p>
      ) : categories.length === 0 ? (
        <p className="mt-4 text-sm muted">Chưa có danh mục nào.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#edf1ea]">
          {categories.map((cat) => (
            <li key={cat.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1">
              <div className="min-w-0">
                <p className="font-bold text-[#20392a]">
                  {cat.name} <span className="ml-2 text-xs font-normal muted">/{cat.slug}</span>
                </p>
                {cat.description && <p className="text-xs muted">{cat.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs muted">Thứ tự: {cat.sortOrder}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Sửa danh mục ${cat.name}`}
                  onClick={() => openEdit(cat)}
                >
                  <PencilSimple size={15} /> Sửa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Xóa danh mục ${cat.name}`}
                  onClick={() => void remove(cat)}
                >
                  <Trash size={15} /> Xóa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
