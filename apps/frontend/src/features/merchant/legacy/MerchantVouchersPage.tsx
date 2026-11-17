import { useState, type FormEvent } from "react";
import { Gift, Plus, Ticket } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import type { VoucherDefinition } from "../../../api/types";
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
  Select,
  StatusText,
  Textarea,
} from "../../../components/ui";
import { number } from "../../../lib/utils";
import { useMerchantId } from "./useMerchantId";

export function MerchantVouchers() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listVoucherDefinitions(id), [id]);
  const blank = {
    title: "",
    description: "",
    kind: "DISCOUNT" as VoucherDefinition["kind"],
    pointsCost: "",
    discountAmount: "",
  };
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function edit(v: VoucherDefinition) {
    setForm({
      title: v.title,
      description: v.description,
      kind: v.kind,
      pointsCost: String(v.pointsCost),
      discountAmount: String(v.discountAmount ?? ""),
    });
    setEditing(v.id);
    setShowForm(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveVoucherDefinition({
        id: editing ?? undefined,
        merchantId: id,
        title: form.title,
        description: form.description,
        kind: form.kind,
        pointsCost: Number(form.pointsCost),
        discountAmount: form.kind === "DISCOUNT" ? Number(form.discountAmount) : undefined,
      });
      resource.reload();
      setShowForm(false);
      setEditing(null);
      setForm(blank);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được voucher");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(v: VoucherDefinition) {
    setBusy(true);
    try {
      await api.toggleVoucherDefinition(v.id, id);
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
        title="Voucher & quà tặng"
        description="Thiết kế quyền lợi để Member đổi bằng điểm trong cửa hàng của bạn."
        action={
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditing(null);
              setForm(blank);
            }}
          >
            <Plus size={17} />
            {showForm ? "Đóng form" : "Tạo mới"}
          </Button>
        }
      />
      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-5 text-lg font-extrabold">{editing ? "Chỉnh sửa ưu đãi" : "Ưu đãi mới"}</h2>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên ưu đãi">
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Loại">
              <Select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as VoucherDefinition["kind"] })}
              >
                <option value="DISCOUNT">Voucher giảm giá</option>
                <option value="REWARD">Voucher nhận quà</option>
              </Select>
            </Field>
            <Field label="Điểm cần đổi">
              <Input
                required
                type="number"
                min="1"
                value={form.pointsCost}
                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
              />
            </Field>
            {form.kind === "DISCOUNT" && (
              <Field label="Giá trị giảm (đ)">
                <Input
                  required
                  type="number"
                  min="1"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Mô tả">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </div>
            {error && (
              <p role="alert" className="text-xs text-[#a4473a] sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu ưu đãi"}</Button>
            </div>
          </form>
        </Card>
      )}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState title="Chưa có ưu đãi" description="Tạo voucher hoặc reward đầu tiên." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resource.data.map((v) => (
            <Card key={v.id} className="p-6">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4e9] accent">
                  {v.kind === "DISCOUNT" ? (
                    <Ticket size={23} weight="light" />
                  ) : (
                    <Gift size={23} weight="light" />
                  )}
                </span>
                <StatusText tone={v.active ? "green" : "neutral"}>
                  {v.active ? "Đang bật" : "Đã tắt"}
                </StatusText>
              </div>
              <h2 className="mt-5 text-lg font-extrabold">{v.title}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 muted">{v.description}</p>
              <div className="mt-5 flex items-end justify-between border-t border-[#edf1ea] pt-4">
                <div>
                  <p className="text-xs muted">Giá đổi</p>
                  <p className="mt-1 text-xl font-extrabold accent">{number(v.pointsCost)} điểm</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => edit(v)}>
                    Sửa
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(v)}>
                    {v.active ? "Tắt" : "Bật"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
