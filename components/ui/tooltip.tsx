"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight CSS-only tooltip — no JS state, no re-render. Appears on
 * hover/focus with a fade+translate. Safe for dense toolbars.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const positions: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] font-medium text-white shadow-pop",
          "opacity-0 transition-all duration-150 ease-out",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          side === "top" && "translate-y-1 group-hover/tooltip:translate-y-0",
          side === "bottom" && "-translate-y-1 group-hover/tooltip:translate-y-0",
          positions[side]
        )}
      >
        {label}
      </span>
    </span>
  );
}
