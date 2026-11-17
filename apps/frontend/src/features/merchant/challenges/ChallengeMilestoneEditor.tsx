import { LockKey, Plus, Trash } from "@phosphor-icons/react";
import type { ChallengeMilestoneInput, ChallengeType } from "../../../api/challenges-types";
import { Button, Card, Field, Input, Textarea } from "../../../components/ui";

function nextAvailableThreshold(milestones: ChallengeMilestoneInput[], targetValue: string): string | null {
  if (!/^\d+$/.test(targetValue) || BigInt(targetValue) <= 0n) return null;
  const target = BigInt(targetValue);
  let previous = 0n;
  for (const milestone of milestones) {
    let threshold: bigint;
    try { threshold = BigInt(milestone.thresholdValue); }
    catch { return null; }
    if (threshold - previous > 1n) return (previous + 1n).toString();
    previous = threshold;
  }
  return target - previous > 1n ? (previous + 1n).toString() : null;
}

function formatThreshold(type: ChallengeType, threshold: string) {
  let formatted = threshold;
  try { formatted = BigInt(threshold).toLocaleString("vi-VN"); }
  catch { /* Keep the current input while it is being edited. */ }
  if (type === "ORDER_COUNT") return `${formatted} đơn hàng`;
  if (type === "DAILY_CHECKIN") return `${formatted} ngày điểm danh`;
  return `${formatted} ₫ chi tiêu`;
}

export function ChallengeMilestoneEditor({
  milestones,
  targetValue,
  type,
  locked,
  onChange,
}: {
  milestones: ChallengeMilestoneInput[];
  targetValue: string;
  type: ChallengeType;
  locked: boolean;
  onChange: (milestones: ChallengeMilestoneInput[]) => void;
}) {
  const finalIndex = milestones.length - 1;
  const addThreshold = nextAvailableThreshold(milestones, targetValue);
  const canAdd = !locked && milestones.length < 10 && addThreshold !== null;

  function update(index: number, patch: Partial<ChallengeMilestoneInput>) {
    onChange(milestones.map((milestone, currentIndex) => currentIndex === index ? { ...milestone, ...patch } : milestone));
  }

  function addMilestone() {
    if (!canAdd || !addThreshold) return;
    const newMilestone = { thresholdValue: addThreshold, title: `Mốc ${milestones.length + 1}`, description: "" };
    const index = milestones.findIndex((milestone) => BigInt(milestone.thresholdValue) > BigInt(addThreshold));
    const insertionIndex = index === -1 ? milestones.length : index;
    const next = [...milestones];
    next.splice(insertionIndex, 0, newMilestone);
    onChange(next);
  }

  function removeMilestone(index: number) {
    if (locked || index === finalIndex || milestones.length <= 1) return;
    onChange(milestones.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-bold text-[#2d4534]">Thiết lập hành trình thành viên</p>
          <p className="mt-1 text-sm leading-6 muted">Mỗi mốc là một cột mốc tiến độ. Điểm thưởng chỉ được trao ở mục tiêu cuối.</p>
        </div>
        <Button type="button" variant="outline" disabled={!canAdd} onClick={addMilestone}>
          <Plus size={17} weight="bold" /> Thêm mốc
        </Button>
      </div>

      {locked && (
        <p className="flex items-start gap-2 rounded-2xl border border-[#e8e3cb] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#795b27]">
          <LockKey size={17} className="mt-0.5 shrink-0" /> Cấu trúc mốc đã khóa vì nhiệm vụ được kích hoạt hoặc đã có tiến độ. Bạn vẫn có thể chỉnh tiêu đề và mô tả.
        </p>
      )}

      <div className="space-y-3">
        {milestones.map((milestone, index) => {
          const isFinal = index === finalIndex;
          return (
            <Card key={`${index}-${milestone.thresholdValue}`} className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${isFinal ? "bg-[#315e3d] text-white" : "bg-[#eaf2e5] text-[#416848]"}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#304735]">{milestone.title || `Mốc ${index + 1}`}</p>
                    <p className="text-xs muted">{formatThreshold(type, milestone.thresholdValue)}{isFinal ? " · Mục tiêu cuối" : ""}</p>
                  </div>
                </div>
                {isFinal ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eaf2e5] px-3 py-1.5 text-xs font-bold text-[#416848]">
                    <LockKey size={13} /> Mốc cuối
                  </span>
                ) : !locked ? (
                  <button type="button" aria-label={`Xóa mốc ${milestone.title || index + 1}`} onClick={() => removeMilestone(index)} className="grid size-9 shrink-0 place-items-center rounded-full text-[#7a867d] transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cdb0]">
                    <Trash size={17} />
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(8rem,.7fr)_minmax(12rem,1.2fr)]">
                <Field label={`Ngưỡng mốc ${index + 1}`} hint={isFinal ? "Tự khớp với mục tiêu chiến dịch." : undefined}>
                  <Input
                    aria-label={`Ngưỡng mốc ${index + 1}`}
                    disabled={locked || isFinal}
                    type="number"
                    min="1"
                    step="1"
                    value={milestone.thresholdValue}
                    onChange={(event) => update(index, { thresholdValue: event.target.value })}
                  />
                </Field>
                <Field label={`Tiêu đề mốc ${index + 1}`}>
                  <Input
                    aria-label={`Tiêu đề mốc ${index + 1}`}
                    maxLength={80}
                    value={milestone.title}
                    placeholder="Ví dụ: Ghé quán lần đầu"
                    onChange={(event) => update(index, { title: event.target.value })}
                  />
                </Field>
              </div>
              <Field label={`Mô tả mốc ${index + 1}`}>
                <Textarea
                  aria-label={`Mô tả mốc ${index + 1}`}
                  maxLength={240}
                  rows={2}
                  className="min-h-20"
                  value={milestone.description}
                  placeholder="Nội dung ngắn hiển thị dưới mốc tiến độ."
                  onChange={(event) => update(index, { description: event.target.value })}
                />
              </Field>
            </Card>
          );
        })}
      </div>

      <section aria-label="Xem trước hành trình" className="rounded-3xl bg-[#f5f8f2] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-extrabold text-[#304735]">Xem trước trên client</h3>
          <span className="text-xs font-semibold muted">{milestones.length}/10 mốc</span>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {milestones.map((milestone, index) => (
            <li key={`${index}-${milestone.thresholdValue}`} className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#e1e9dd] bg-white p-3.5">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${index === milestones.length - 1 ? "bg-[#315e3d] text-white" : "bg-[#eaf2e5] text-[#416848]"}`}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#304735]">{milestone.title || `Mốc ${index + 1}`}</p>
                <p className="mt-0.5 text-xs font-semibold text-[#4d8057]">{formatThreshold(type, milestone.thresholdValue)}</p>
                {milestone.description && <p className="mt-1 line-clamp-2 text-xs leading-5 muted">{milestone.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
