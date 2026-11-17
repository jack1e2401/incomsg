import type { ReactNode } from "react";

export const challengeEditorSteps = [
  { title: "Thông tin", hint: "Tên và mô tả" },
  { title: "Mục tiêu & điểm", hint: "Điều kiện hoàn thành" },
  { title: "Thời hạn & ngân sách", hint: "Lịch chạy chiến dịch" },
  { title: "Rà soát", hint: "Kiểm tra trước khi lưu" },
] as const;

export function ChallengeEditorStep({
  activeStep,
  title,
  description,
  children,
}: {
  activeStep: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <nav aria-label="Các bước tạo nhiệm vụ" className="surface rounded-3xl p-4 sm:p-5">
        <ol className="grid grid-cols-4 gap-2 sm:gap-4">
          {challengeEditorSteps.map((step, index) => (
            <li key={step.title} aria-label={`Bước ${index + 1}: ${step.title}`} aria-current={activeStep === index ? "step" : undefined} className="min-w-0">
              <div className={`flex items-center gap-2 ${index < activeStep ? "text-[#397347]" : activeStep === index ? "text-[#20392a]" : "text-[#87948a]"}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${index < activeStep ? "bg-[#dff0d3]" : activeStep === index ? "bg-[#315e3d] text-white" : "bg-[#edf1ea]"}`}>
                  {index + 1}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-xs font-bold md:text-sm">{step.title}</span>
                  <span className="hidden truncate text-[11px] text-[#87948a] lg:block">{step.hint}</span>
                </span>
              </div>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-[#edf1ea]">
          <div className="h-full rounded-full bg-[#7daa69] transition-[width] duration-300" style={{ width: `${((activeStep + 1) / challengeEditorSteps.length) * 100}%` }} />
        </div>
      </nav>
      <section aria-labelledby="challenge-editor-step-title" className="surface rounded-3xl p-5 sm:p-8">
        <h2 id="challenge-editor-step-title" className="text-xl font-extrabold tracking-[-.025em] text-[#20392a] sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm muted">{description}</p>
        <div className="mt-6 space-y-5">{children}</div>
      </section>
    </>
  );
}
