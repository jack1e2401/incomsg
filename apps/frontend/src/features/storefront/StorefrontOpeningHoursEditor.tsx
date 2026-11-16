import type { StorefrontOpeningHoursDay } from "../../api/storefront-types";
import { Button, Field, Input } from "../../components/ui";

const WEEKDAYS = [
  { day: 1, label: "Thứ 2" },
  { day: 2, label: "Thứ 3" },
  { day: 3, label: "Thứ 4" },
  { day: 4, label: "Thứ 5" },
  { day: 5, label: "Thứ 6" },
  { day: 6, label: "Thứ 7" },
  { day: 7, label: "Chủ nhật" },
];

export function StorefrontOpeningHoursEditor({
  value,
  onChange,
}: {
  value: StorefrontOpeningHoursDay[] | null;
  onChange: (value: StorefrontOpeningHoursDay[] | null) => void;
}) {
  function startSchedule() {
    onChange(WEEKDAYS.map(({ day }) => ({ day, closed: false, openTime: null, closeTime: null })));
  }

  function updateDay(day: number, patch: Partial<StorefrontOpeningHoursDay>) {
    onChange(value?.map((item) => (item.day === day ? { ...item, ...patch } : item)) ?? null);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[#e5ece3] bg-[#fcfdf9] p-4" aria-labelledby="opening-hours-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="opening-hours-title" className="font-bold text-[#24452f]">Giờ mở cửa</h3>
          <p className="mt-1 text-xs muted">Thiết lập lịch tuần. Đánh dấu ngày nghỉ hoặc để trống ngày chưa cập nhật.</p>
        </div>
        {value ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>
            Xóa lịch
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={startSchedule}>
            Thiết lập giờ
          </Button>
        )}
      </div>
      {value && WEEKDAYS.map(({ day, label }) => {
        const schedule = value.find((item) => item.day === day);
        if (!schedule) return null;
        return (
          <div key={day} className="grid items-center gap-3 border-t border-[#e8eee6] pt-3 sm:grid-cols-[7rem_8rem_1fr_1fr]">
            <span className="text-sm font-semibold text-[#405b47]">{label}</span>
            <label className="flex items-center gap-2 text-sm text-[#53685a]">
              <input
                type="checkbox"
                checked={schedule.closed}
                onChange={(event) => updateDay(day, {
                  closed: event.target.checked,
                  openTime: null,
                  closeTime: null,
                })}
                className="size-4 accent-[#335e3d]"
              />
              Nghỉ
            </label>
            <Field label={`Mở cửa ${label}`}>
              <Input
                type="time"
                disabled={schedule.closed}
                value={schedule.openTime ?? ""}
                onChange={(event) => updateDay(day, { openTime: event.target.value || null })}
              />
            </Field>
            <Field label={`Đóng cửa ${label}`}>
              <Input
                type="time"
                disabled={schedule.closed}
                value={schedule.closeTime ?? ""}
                onChange={(event) => updateDay(day, { closeTime: event.target.value || null })}
              />
            </Field>
          </div>
        );
      })}
    </section>
  );
}
