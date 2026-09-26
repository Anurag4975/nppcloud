"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white shadow-soft hover:bg-ink-800 hover:shadow-card active:scale-[0.98] disabled:bg-ink-300 disabled:text-white/70 disabled:shadow-none",
  secondary:
    "bg-white text-ink-700 border border-ink-200 shadow-soft hover:bg-ink-50 hover:border-ink-300 active:scale-[0.98] disabled:opacity-50",
  outline:
    "bg-transparent text-ink-700 border border-ink-200 hover:bg-ink-50 hover:text-ink-900 active:scale-[0.98] disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900 active:scale-[0.98] disabled:opacity-40",
  danger:
    "bg-red-600 text-white shadow-soft hover:bg-red-500 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-all duration-150 ease-in-out",
        "focus-visible:outline-none disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
