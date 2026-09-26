import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps {
  value: number; // 0-100
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
  barClassName?: string;
  animated?: boolean;
}

/**
 * GPU-accelerated progress bar. Animates `transform: scaleX()` (compositor
 * only) — never `width`, which triggers layout and feels janky.
 */
export function Progress({
  value,
  variant = "default",
  className,
  barClassName,
  animated = false,
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const colors: Record<string, string> = {
    default: "bg-brand-500",
    success: "bg-brand-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };
  const tone =
    variant === "default"
      ? pct > 90
        ? "bg-red-500"
        : pct > 70
        ? "bg-amber-500"
        : "bg-brand-500"
      : colors[variant];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-100", className)}
    >
      <div
        className={cn(
          "progress-fill h-full rounded-full transition-transform duration-500 ease-out-expo",
          tone,
          animated &&
            "bg-[linear-gradient(45deg,rgba(255,255,255,0.25)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.25)_50%,rgba(255,255,255,0.25)_75%,transparent_75%)] bg-[length:24px_24px] [animation:progress-stripes_1s_linear_infinite]",
          barClassName
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
