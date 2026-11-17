import { useEffect, useState, type FormEvent } from "react";
import { Medal } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import type { LoyaltyConfig } from "../../../api/types";
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
} from "../../../components/ui";
import { useMerchantId } from "./useMerchantId";

export function MerchantLoyalty() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.getLoyaltyConfig(id), [id]);
  const [form, setForm] = useState<LoyaltyConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (resource.data) setForm(resource.data);
  }, [resource.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setMessage("");
    try {
      if (form.baseAmount <= 0 || form.tiers.some((t) => t.threshold < 0 || t.multiplier <= 0))
        throw new Error("Ngưỡng và hệ số phải hợp lệ");
      const updated = await api.saveLoyaltyConfig(form);
      resource.setData(updated);
      setMessage("Cấu hình đã lưu. Chỉ áp dụng cho giao dịch tương lai.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading)
    return (
      <>
        <PageHeader
          title="Chương trình tích điểm"
          description="Tier dựa trên tổng điểm từng kiếm được. Tiêu điểm không làm giảm tier."
        />
        <LoadingState cards={2} />
      </>
    );
  if (resource.error)
    return (
      <>
        <PageHeader
          title="Chương trình tích điểm"
          description="Tier dựa trên tổng điểm từng kiếm được. Tiêu điểm không làm giảm tier."
        />
        <ErrorState message={resource.error} retry={resource.reload} />
      </>
    );
  if (!form) return <LoadingState cards={2} />;
  return (
    <>
      <PageHeader
        title="Chương trình tích điểm"
        description="Tier dựa trên tổng điểm từng kiếm được. Tiêu điểm không làm giảm tier."
      />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={save}>
            <Field label="Mỗi bao nhiêu đồng thực trả nhận 1 điểm cơ bản?">
              <Input
                type="number"
                min="1"
                value={form.baseAmount}
                onChange={(e) => setForm({ ...form, baseAmount: Number(e.target.value) })}
              />
            </Field>
            <div className="mt-7">
              <div className="mb-3 grid grid-cols-[1fr_1fr_1fr] gap-3 text-[10px] font-extrabold uppercase tracking-widest muted">
                <span>Tier</span>
                <span>Điểm tích lũy</span>
                <span>Hệ số</span>
              </div>
              {form.tiers.map((t, index) => (
                <div
                  key={t.tier}
                  className="grid grid-cols-[1fr_1fr_1fr] items-center gap-3 border-t border-[#edf1ea] py-3"
                >
                  <StatusText
                    tone={index === 0 ? "neutral" : index === 1 ? "green" : index === 2 ? "amber" : "purple"}
                  >
                    {t.tier}
                  </StatusText>
                  <Input
                    aria-label={`Ngưỡng ${t.tier}`}
                    type="number"
                    min="0"
                    value={t.threshold}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((x, i) =>
                          i === index ? { ...x, threshold: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label={`Hệ số ${t.tier}`}
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={t.multiplier}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((x, i) =>
                          i === index ? { ...x, multiplier: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            {message && (
              <p role="status" className="mt-4 rounded-xl bg-[#edf4e9] p-3 text-xs accent">
                {message}
              </p>
            )}
            <Button className="mt-6" disabled={busy}>
              {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}
            </Button>
          </form>
        </Card>
        <Card className="h-fit bg-[#2e5539] p-7 text-white">
          <Medal size={31} weight="light" className="text-[#c8ea9f]" />
          <h2 className="mt-5 text-lg font-bold">Quy tắc tính hạng</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
            <li>Đơn đã thanh toán đầu tiên áp dụng hệ số Bronze.</li>
            <li>Hạng tính theo tổng điểm đã tích lũy; tiêu điểm không làm giảm hạng.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
