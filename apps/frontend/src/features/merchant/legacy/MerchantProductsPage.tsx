import { useState, type FormEvent } from "react";
import { Package, Plus } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import type { Product } from "../../../api/types";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../../components/ui";
import { money } from "../../../lib/utils";
import { useMerchantId } from "./useMerchantId";

export function MerchantProducts() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listProducts(id), [id]);
  const blank = { name: "", category: "", description: "", price: "", stock: "", image: "" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function edit(p: Product) {
    setForm({
      name: p.name,
      category: p.category,
      description: p.description,
      price: String(p.price),
      stock: String(p.stock),
      image: p.image,
    });
    setEditing(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveProduct({
        id: editing ?? undefined,
        merchantId: id,
        name: form.name,
        category: form.category,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock),
        image: form.image,
      });
      setShowForm(false);
      setEditing(null);
      setForm(blank);
      resource.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được sản phẩm");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(p: Product) {
    setBusy(true);
    setError("");
    try {
      await api.toggleProduct(p.id, id);
      resource.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description="Tạo, chỉnh sửa và ẩn sản phẩm trong gian hàng của bạn."
        action={
          <Button
            onClick={() => {
              setForm(blank);
              setEditing(null);
              setShowForm(!showForm);
            }}
          >
            <Plus size={17} />
            {showForm ? "Đóng form" : "Thêm sản phẩm"}
          </Button>
        }
      />
      {showForm && (
        <Card className="mb-6 p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-extrabold">{editing ? "Chỉnh sửa sản phẩm" : "Sản phẩm mới"}</h2>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên sản phẩm">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Danh mục">
              <Input
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
            <Field label="Giá (đ)">
              <Input
                required
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Tồn kho">
              <Input
                required
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </Field>
            <Field label="URL ảnh">
              <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            </Field>
            <Field label="Mô tả">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            {error && (
              <p role="alert" className="text-xs text-[#a4473a] sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu sản phẩm"}</Button>
            </div>
          </form>
        </Card>
      )}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Tạo sản phẩm đầu tiên để bắt đầu bán hàng."
          action={<Button onClick={() => setShowForm(true)}>Thêm sản phẩm</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-[#f8faf6] text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8a9a8d]">
                <tr>
                  <th className="p-5">Sản phẩm</th>
                  <th className="p-5">Danh mục</th>
                  <th className="p-5">Giá</th>
                  <th className="p-5">Tồn kho</th>
                  <th className="p-5">Trạng thái</th>
                  <th className="p-5">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ea]">
                {resource.data.map((p) => (
                  <tr key={p.id} className="text-sm">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-[#eef2e9]">
                          {p.image ? (
                            <img src={p.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package size={20} className="m-3 accent" />
                          )}
                        </div>
                        <span className="font-bold">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-5 muted">{p.category}</td>
                    <td className="p-5 font-bold">{money(p.price)}</td>
                    <td className="p-5">{p.stock}</td>
                    <td className="p-5">
                      <StatusText tone={p.active ? "green" : "neutral"}>
                        {p.active ? "Hiển thị" : "Đã ẩn"}
                      </StatusText>
                    </td>
                    <td className="p-5">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => edit(p)}>
                          Sửa
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggle(p)}>
                          {p.active ? "Ẩn" : "Hiện"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
