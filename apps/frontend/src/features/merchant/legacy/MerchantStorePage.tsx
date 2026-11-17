import { useEffect, useState, type FormEvent } from "react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import {
  Button,
  BusyLabel,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  StatusText,
  Textarea,
} from "../../../components/ui";
import { useMerchantId } from "./useMerchantId";

export function MerchantStore() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.getMerchant(id), [id]);
  const [form, setForm] = useState({ name: "", tagline: "", description: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (resource.data)
      setForm({
        name: resource.data.name,
        tagline: resource.data.tagline,
        description: resource.data.description,
        location: resource.data.location,
      });
  }, [resource.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const updated = await api.updateMerchant(id, form);
      resource.setData(updated);
      setMessage("Thông tin cửa hàng đã được lưu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Thông tin cửa hàng" description="Giới thiệu cửa hàng của bạn với Member." />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="p-6 sm:p-8">
            <form onSubmit={save} className="space-y-5">
              <Field label="Tên cửa hàng">
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Thông điệp ngắn">
                <Input
                  required
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </Field>
              <Field label="Giới thiệu">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field label="Địa điểm">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
              {message && (
                <p role="status" className="rounded-xl bg-[#edf4e9] p-3 text-xs accent">
                  {message}
                </p>
              )}
              <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu thay đổi"}</Button>
            </form>
          </Card>
          <Card className="h-fit overflow-hidden">
            <div className="h-32" style={{ background: resource.data?.color }} />
            <div className="p-6">
              <span className="-mt-12 grid h-14 w-14 place-items-center rounded-2xl border-4 border-white bg-[#335e3d] text-xl font-extrabold text-white">
                {resource.data?.initials}
              </span>
              <h2 className="mt-4 text-xl font-extrabold">{form.name}</h2>
              <p className="mt-1 text-sm muted">{form.tagline}</p>
              <p className="mt-5 text-xs leading-6 muted">{form.description}</p>
              <StatusText tone="green" className="mt-5">
                Cửa hàng đang hoạt động
              </StatusText>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
