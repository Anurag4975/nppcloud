import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "danger" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-ink-900 text-white",
  secondary: "bg-ink-100 text-ink-700",
  success: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  outline: "bg-transparent text-ink-600 ring-1 ring-inset ring-ink-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        "transition-colors duration-150",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
