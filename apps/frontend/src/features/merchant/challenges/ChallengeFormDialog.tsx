import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createChallengesClient, translateChallengeError } from "../../../api/challenges-client";
import type { ChallengeType, CreateChallengeInput, MerchantChallengeDto } from "../../../api/challenges-types";
import { Button, Field, Input, Select, Textarea } from "../../../components/ui";

const api = createChallengesClient();
type Props = { editing: MerchantChallengeDto | "new" | null; token: string; onClose(): void; onSaved(): void };
type Form = { title: string; description: string; type: ChallengeType; targetValue: string; rewardPoints: string; budgetTotal: string; startsAt: string; endsAt: string; isFeatured: boolean; status: "DRAFT" | "ACTIVE" };
const empty: Form = { title: "", description: "", type: "ORDER_COUNT", targetValue: "1", rewardPoints: "1", budgetTotal: "1", startsAt: "", endsAt: "", isFeatured: false, status: "DRAFT" };
const localInput = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const trimDecimal = (value: string) => value.includes(".") ? value.replace(/\.?0+$/, "") : value;
function decimalAtLeast(left: string, right: string) {
  const precision = Math.max(left.split(".")[1]?.length ?? 0, right.split(".")[1]?.length ?? 0);
  const scale = 10n ** BigInt(precision);
  const exact = (value: string) => { const [whole = "0", fraction = ""] = value.split("."); return BigInt(whole) * scale + BigInt((fraction + "0".repeat(precision)).slice(0, precision) || "0"); };
  try { return exact(left) >= exact(right); } catch { return false; }
}

export function ChallengeFormDialog({ editing, token, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = editing === "new";
  const locked = editing !== null && editing !== "new" && editing.lockedFields;
  useEffect(() => {
    if (!editing) return;
    setError("");
    setForm(editing === "new" ? empty : { title: editing.title, description: editing.description, type: editing.type, targetValue: editing.targetValue, rewardPoints: trimDecimal(editing.rewardPoints), budgetTotal: trimDecimal(editing.budgetTotal), startsAt: localInput(editing.startsAt), endsAt: localInput(editing.endsAt), isFeatured: editing.isFeatured, status: editing.status === "ACTIVE" ? "ACTIVE" : "DRAFT" });
  }, [editing]);
  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!form.title.trim() || Number(form.targetValue) <= 0 || Number(form.rewardPoints) <= 0 || Number(form.budgetTotal) < 0) { setError("Vui lòng nhập tiêu đề, mục tiêu và điểm thưởng hợp lệ."); return; }
    if (!form.startsAt || !form.endsAt || new Date(form.endsAt) <= new Date(form.startsAt)) { setError("Ngày kết thúc phải lớn hơn ngày bắt đầu."); return; }
    if (form.status === "ACTIVE" && !decimalAtLeast(form.budgetTotal, form.rewardPoints)) { setError("Ngân sách phải lớn hơn hoặc bằng điểm thưởng để kích hoạt."); return; }
    if (editing && editing !== "new" && !decimalAtLeast(form.budgetTotal, editing.budgetSpent)) { setError("Ngân sách không được thấp hơn số điểm đã phát."); return; }
    setBusy(true);
    try {
      if (editing === "new") {
        const input: CreateChallengeInput = { title: form.title.trim(), description: form.description, type: form.type, targetValue: form.targetValue, rewardPoints: form.rewardPoints, budgetTotal: form.budgetTotal, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), isFeatured: form.isFeatured, status: form.status };
        await api.createMerchantChallenge(input, token);
      } else if (editing) {
        const patch = locked
          ? { title: form.title.trim(), description: form.description, budgetTotal: form.budgetTotal, endsAt: new Date(form.endsAt).toISOString(), isFeatured: form.isFeatured }
          : { title: form.title.trim(), description: form.description, type: form.type, targetValue: form.targetValue, rewardPoints: form.rewardPoints, budgetTotal: form.budgetTotal, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), isFeatured: form.isFeatured };
        await api.updateMerchantChallenge(editing.id, patch, token);
      }
      onSaved();
    } catch (reason) { setError(translateChallengeError(reason instanceof Error ? reason.message : "INVALID_INPUT")); }
    finally { setBusy(false); }
  }
  return <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && !busy && onClose()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" /><Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6"><Dialog.Title className="text-xl font-bold">{isNew ? "Tạo nhiệm vụ" : "Sửa nhiệm vụ"}</Dialog.Title><form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
    <Field label="Tiêu đề"><Input required value={form.title} onChange={(e) => update("title", e.target.value)} /></Field><Field label="Mô tả"><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></Field>
    {locked && <p className="text-xs muted">Loại, mục tiêu, điểm thưởng và ngày bắt đầu đã khóa sau khi kích hoạt.</p>}
    <Field label="Loại nhiệm vụ"><Select disabled={locked} value={form.type} onChange={(e) => update("type", e.target.value as ChallengeType)}><option value="ORDER_COUNT">Số đơn hàng</option><option value="DAILY_CHECKIN">Điểm danh mỗi ngày</option><option value="SPEND_TOTAL">Tổng chi tiêu</option></Select></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Mục tiêu"><Input disabled={locked} type="number" min="1" value={form.targetValue} onChange={(e) => update("targetValue", e.target.value)} /></Field><Field label="Điểm thưởng"><Input disabled={locked} type="number" min="0.000000000001" step="any" value={form.rewardPoints} onChange={(e) => update("rewardPoints", e.target.value)} /></Field><Field label="Tổng ngân sách"><Input type="number" min="0" step="any" value={form.budgetTotal} onChange={(e) => update("budgetTotal", e.target.value)} /></Field><Field label="Trạng thái ban đầu"><Select disabled={!isNew} value={form.status} onChange={(e) => update("status", e.target.value as Form["status"])}><option value="DRAFT">Bản nháp</option><option value="ACTIVE">Kích hoạt</option></Select></Field><Field label="Ngày bắt đầu"><Input disabled={locked} type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></Field><Field label="Ngày kết thúc"><Input type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></Field></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => update("isFeatured", e.target.checked)} />Nổi bật trên cửa hàng</label>{form.isFeatured && <p className="text-xs muted">Nhiệm vụ nổi bật hiện tại sẽ được thay thế.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</Button></div>
  </form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
