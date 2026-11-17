import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createChallengesClient, translateChallengeError } from "../../../api/challenges-client";
import type { ChallengeType, CreateChallengeInput, MerchantChallengeDto, UpdateChallengeInput } from "../../../api/challenges-types";
import { useResource } from "../../../api/useResource";
import { Button, Card, ErrorState, Field, Input, LoadingState, PageHeader, Select, Textarea } from "../../../components/ui";
import { useToken } from "../merchant-page-support";
import { challengeTypeLabel } from "./challenge-labels";
import { ChallengeEditorStep } from "./ChallengeEditorStep";

const api = createChallengesClient();
type Form = { title: string; description: string; type: ChallengeType; targetValue: string; rewardPoints: string; budgetTotal: string; startsAt: string; endsAt: string; isFeatured: boolean };
const empty: Form = { title: "", description: "", type: "ORDER_COUNT", targetValue: "1", rewardPoints: "1", budgetTotal: "1", startsAt: "", endsAt: "", isFeatured: false };

function localInput(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function trimDecimal(value: string) {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

function decimalAtLeast(left: string, right: string) {
  const precision = Math.max(left.split(".")[1]?.length ?? 0, right.split(".")[1]?.length ?? 0);
  const scale = 10n ** BigInt(precision);
  const exact = (value: string) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return BigInt(whole) * scale + BigInt((fraction + "0".repeat(precision)).slice(0, precision) || "0");
  };
  try { return exact(left) >= exact(right); } catch { return false; }
}

function toForm(challenge: MerchantChallengeDto): Form {
  return {
    title: challenge.title,
    description: challenge.description,
    type: challenge.type,
    targetValue: challenge.targetValue,
    rewardPoints: trimDecimal(challenge.rewardPoints),
    budgetTotal: trimDecimal(challenge.budgetTotal),
    startsAt: localInput(challenge.startsAt),
    endsAt: localInput(challenge.endsAt),
    isFeatured: challenge.isFeatured,
  };
}

function validate(step: number, form: Form, existing?: MerchantChallengeDto): string {
  if (step === 0 && !form.title.trim()) return "Vui lòng nhập tên nhiệm vụ.";
  if (step === 1 && (!Number.isFinite(Number(form.targetValue)) || Number(form.targetValue) <= 0 || !Number.isFinite(Number(form.rewardPoints)) || Number(form.rewardPoints) <= 0)) {
    return "Mục tiêu và điểm thưởng phải lớn hơn 0.";
  }
  if (step === 2) {
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (!form.startsAt || !form.endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return "Ngày kết thúc phải lớn hơn ngày bắt đầu.";
    }
    if (!Number.isFinite(Number(form.budgetTotal)) || Number(form.budgetTotal) < 0) return "Ngân sách phải là số không âm.";
    if (existing && !decimalAtLeast(form.budgetTotal, existing.budgetSpent)) return "Ngân sách không được thấp hơn số điểm ngân sách đã sử dụng.";
  }
  return "";
}

function campaignGoal(form: Form) {
  const value = Number(form.targetValue).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
  if (form.type === "ORDER_COUNT") return `${value} đơn hàng`;
  if (form.type === "DAILY_CHECKIN") return `${value} ngày điểm danh`;
  return `${value} ₫ chi tiêu`;
}

export function MerchantChallengeEditorPage() {
  const { challengeId = "" } = useParams();
  const id = Number(challengeId);
  const isNew = challengeId.length === 0;
  const token = useToken();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(empty);
  const [formChallengeId, setFormChallengeId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = useResource(
    () => isNew ? Promise.resolve(null) : api.getMerchantChallenge(id, token, 1, 20),
    [isNew, id, token],
  );
  const challenge = resource.data?.challenge;
  const locked = Boolean(challenge?.lockedFields);

  useEffect(() => {
    if (challenge) {
      setForm(toForm(challenge));
      setFormChallengeId(challenge.id);
    }
  }, [challenge]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function next() {
    const validationError = validate(step, form, challenge);
    if (validationError) { setError(validationError); return; }
    setError("");
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = [0, 1, 2].map((index) => validate(index, form, challenge)).find(Boolean);
    if (validationError) { setError(validationError); setStep(validationError.includes("tên") ? 0 : validationError.includes("Mục tiêu") ? 1 : 2); return; }
    setBusy(true);
    setError("");
    try {
      const dates = { startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() };
      const saved = isNew
        ? await api.createMerchantChallenge({
          title: form.title.trim(), description: form.description, type: form.type,
          targetValue: form.targetValue, rewardPoints: form.rewardPoints, budgetTotal: form.budgetTotal,
          ...dates, isFeatured: form.isFeatured, status: "DRAFT",
        } satisfies CreateChallengeInput, token)
        : await api.updateMerchantChallenge(id, (locked ? {
          title: form.title.trim(), description: form.description, budgetTotal: form.budgetTotal,
          endsAt: dates.endsAt, isFeatured: form.isFeatured,
        } : {
          title: form.title.trim(), description: form.description, type: form.type,
          targetValue: form.targetValue, rewardPoints: form.rewardPoints, budgetTotal: form.budgetTotal,
          ...dates, isFeatured: form.isFeatured,
        }) satisfies UpdateChallengeInput, token);
      navigate(`/merchant/challenges/${saved.challenge.id}`);
    } catch (reason) {
      setError(translateChallengeError(reason instanceof Error ? reason.message : "INVALID_INPUT"));
    } finally {
      setBusy(false);
    }
  }

  if (!isNew && resource.loading) return <LoadingState cards={2} />;
  if (!isNew && resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
  if (!isNew && !challenge) return <ErrorState message="Không tìm thấy nhiệm vụ." retry={resource.reload} />;
  if (!isNew && formChallengeId !== id) return <LoadingState cards={2} />;

  const titles = ["Thông tin nhiệm vụ", "Mục tiêu và điểm thưởng", "Thời hạn và ngân sách", "Rà soát nhiệm vụ"];
  const descriptions = [
    "Đặt tên ngắn gọn để thành viên dễ hiểu nhiệm vụ cần làm.",
    "Chỉ mục tiêu cuối cùng mới trao điểm thưởng đã cấu hình.",
    "Chọn thời gian chạy và ngân sách dành cho chiến dịch.",
    "Kiểm tra cấu hình trước khi lưu nhiệm vụ dưới dạng bản nháp.",
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <Link to={isNew ? "/merchant/challenges" : `/merchant/challenges/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#49654e] hover:text-[#20392a]"><ArrowLeft size={17} /> Quay lại</Link>
      <PageHeader title={isNew ? "Tạo nhiệm vụ" : "Chỉnh sửa nhiệm vụ"} description={isNew ? "Thiết lập chiến dịch mới theo từng bước." : challenge?.title} />
      {locked && <p className="rounded-2xl border border-[#e8e3cb] bg-[#fff9e8] px-4 py-3 text-sm text-[#795b27]">Nhiệm vụ đã có tiến độ hoặc được kích hoạt. Loại, mục tiêu, điểm thưởng và ngày bắt đầu đã khóa.</p>}

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <ChallengeEditorStep activeStep={step} title={titles[step]} description={descriptions[step]}>
          {step === 0 && <>
            <Field label="Tiêu đề"><Input autoFocus required maxLength={120} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Ví dụ: Mộc thân quen — 3 đơn hàng" /></Field>
            <Field label="Mô tả"><Textarea maxLength={500} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Mô tả ngắn về nhiệm vụ và cách hoàn thành." /></Field>
          </>}

          {step === 1 && <>
            <Field label="Loại nhiệm vụ"><Select disabled={locked} value={form.type} onChange={(event) => update("type", event.target.value as ChallengeType)}><option value="ORDER_COUNT">Số đơn hàng</option><option value="DAILY_CHECKIN">Điểm danh hằng ngày</option><option value="SPEND_TOTAL">Tổng chi tiêu</option></Select></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mục tiêu"><Input disabled={locked} type="number" min="1" step="any" value={form.targetValue} onChange={(event) => update("targetValue", event.target.value)} /></Field>
              <Field label="Điểm thưởng cuối nhiệm vụ"><Input disabled={locked} type="number" min="0.000000000001" step="any" value={form.rewardPoints} onChange={(event) => update("rewardPoints", event.target.value)} /></Field>
            </div>
            <p className="rounded-2xl bg-[#f5f8f2] px-4 py-3 text-sm leading-6 text-[#5f7063]">Thành viên chỉ nhận điểm thưởng sau khi hoàn thành toàn bộ mục tiêu.</p>
          </>}

          {step === 2 && <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ngày bắt đầu"><Input disabled={locked} type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} /></Field>
              <Field label="Ngày kết thúc"><Input type="datetime-local" value={form.endsAt} onChange={(event) => update("endsAt", event.target.value)} /></Field>
              <Field label="Ngân sách tổng (điểm)"><Input type="number" min="0" step="any" value={form.budgetTotal} onChange={(event) => update("budgetTotal", event.target.value)} /></Field>
            </div>
            {challenge && <p className="text-sm muted">Đã sử dụng {Number(challenge.budgetSpent).toLocaleString("vi-VN")} điểm · Còn {Number(challenge.budgetRemaining).toLocaleString("vi-VN")} điểm.</p>}
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#e5ebe2] px-4 text-sm font-semibold text-[#435748]"><input className="size-4 accent-[#315e3d]" type="checkbox" checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} />Nổi bật trên cửa hàng</label>
          </>}

          {step === 3 && <>
            <Card className="space-y-4 bg-[#f8faf6] p-5">
              <div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Tên nhiệm vụ</p><p className="mt-1 font-extrabold text-[#20392a]">{form.title || "Chưa đặt tên"}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Loại</p><p className="mt-1 font-semibold">{challengeTypeLabel(form.type)}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Mục tiêu</p><p className="mt-1 font-semibold">{campaignGoal(form)}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Thưởng cuối</p><p className="mt-1 font-semibold">{Number(form.rewardPoints).toLocaleString("vi-VN")} điểm</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Ngân sách</p><p className="mt-1 font-semibold">{Number(form.budgetTotal).toLocaleString("vi-VN")} điểm</p></div>
                <div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Thời gian</p><p className="mt-1 font-semibold">{form.startsAt ? new Date(form.startsAt).toLocaleString("vi-VN") : "Chưa chọn"} → {form.endsAt ? new Date(form.endsAt).toLocaleString("vi-VN") : "Chưa chọn"}</p></div>
              </div>
            </Card>
            <p className="flex items-start gap-2 text-sm leading-6 text-[#637269]"><Check size={18} className="mt-0.5 shrink-0 text-[#4d8057]" />Nhiệm vụ mới sẽ được lưu thành bản nháp. Hãy kích hoạt riêng sau khi kiểm tra xong.</p>
          </>}
        </ChallengeEditorStep>

        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
          <Button type="button" variant="outline" disabled={step === 0 || busy} onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1)); }}>Quay lại</Button>
          {step < 3 ? (
            <Button type="button" onClick={next}>Tiếp tục <ArrowRight size={17} /></Button>
          ) : (
            <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : isNew ? "Lưu bản nháp" : "Lưu thay đổi"}</Button>
          )}
        </div>
      </form>
    </div>
  );
}
