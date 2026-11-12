import type {
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { WarningCircle, CircleNotch, Package } from "@phosphor-icons/react";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import { translateApiError } from "../../api/commerce-http";

export { Button } from "./button";
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-[1.7rem]", className)} {...props} />;
}
export function StatusText({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "purple";
  className?: string;
}) {
  const tones = {
    neutral: "text-[#637269]",
    green: "text-[#357044]",
    amber: "text-[#97682a]",
    red: "text-[#a4473a]",
    purple: "text-[#7560a1]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl bg-[#f7f9f5] px-4 text-sm text-[#26352f] outline-none ring-1 ring-[#e4eae2] transition focus:ring-2 focus:ring-[#a8cdb0] placeholder:text-[#a0aca2]",
        className,
      )}
      {...props}
    />
  );
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl bg-[#f7f9f5] p-4 text-sm text-[#26352f] outline-none ring-1 ring-[#e4eae2] transition focus:ring-2 focus:ring-[#a8cdb0]",
        className,
      )}
      {...props}
    />
  );
}
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl bg-[#f7f9f5] px-4 text-sm text-[#26352f] outline-none ring-1 ring-[#e4eae2] focus:ring-2 focus:ring-[#a8cdb0]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-[#e9efe8]", className)} />;
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#edf4e9] text-[#5c7d60]">
        <Package size={25} weight="light" />
      </span>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
export function LoadingState({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải">
      <span className="sr-only">Đang tải dữ liệu</span>
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="mb-5 h-28" />
          <Skeleton className="mb-3 h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </Card>
      ))}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const displayMessage = translateApiError(message);
  return (
    <Card className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
      <WarningCircle size={30} className="text-[#a4473a]" />
      <h3 className="mt-3 font-bold">Không tải được dữ liệu</h3>
      <p className="mt-2 text-sm muted">{displayMessage}</p>
      {retry && (
        <Button variant="outline" className="mt-5" onClick={retry}>
          Thử lại
        </Button>
      )}
    </Card>
  );
}
export function PageHeader({
  title,
  description,
  action,
  titleClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1
          className={cn(
            "text-3xl font-extrabold tracking-[-.055em] text-[#20392a] sm:text-[2.55rem]",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function BusyLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <CircleNotch size={17} className="animate-spin" />
      {children}
    </>
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#506154]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs muted">{hint}</span>}
    </label>
  );
}
export function StatCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  note?: string;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold muted">{label}</p>
        {icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf4e9] accent">{icon}</span>
        )}
      </div>
      <p className="mt-4 text-[1.7rem] font-extrabold tracking-[-.06em] text-[#20392a]">{value}</p>
      {note && <p className="mt-1 text-xs muted">{note}</p>}
    </Card>
  );
}
