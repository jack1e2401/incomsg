import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const variants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-300 ease-[cubic-bezier(.32,.72,0,1)] active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b6dabc]",
  {
    variants: {
      variant: {
        default: "bg-[#335e3d] text-white hover:bg-[#264c30] shadow-[0_8px_22px_rgba(51,94,61,.17)]",
        secondary: "bg-[#e8f1e2] text-[#335e3d] hover:bg-[#d9e9d1]",
        outline: "bg-white text-[#335e3d] ring-1 ring-[#dce6da] hover:bg-[#f7faf5]",
        ghost: "bg-transparent text-[#516357] hover:bg-[#edf3e9]",
        danger: "bg-[#a4473a] text-white hover:bg-[#8d382d]",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants> & { asChild?: boolean };
export function Button({ className, variant, size, asChild = false, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(variants({ variant, size }), className)} {...props} />;
}
