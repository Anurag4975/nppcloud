"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
  label?: string;
}

/**
 * Dropdown with slide-down/fade enter animation, click-outside + ESC to close.
 * Panel uses transform-based animation (compositor-only) for zero jank.
 */
export function DropdownMenu({
  trigger,
  items,
  align = "right",
  className,
  triggerClassName,
  label,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label ?? "Open menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-ink-400",
          "transition-all duration-150 ease-in-out",
          "hover:bg-ink-100 hover:text-ink-700",
          "active:scale-95",
          open && "bg-ink-100 text-ink-700",
          triggerClassName
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-30 mt-1.5 min-w-[180px] origin-top overflow-hidden rounded-xl border border-ink-200/80 bg-white p-1 shadow-pop",
            "animate-slide-down",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((it, i) => (
            <button
              key={`${it.label}-${i}`}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                it.onClick();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium",
                "transition-colors duration-100",
                it.danger
                  ? "text-red-600 hover:bg-red-50"
                  : "text-ink-700 hover:bg-ink-100",
                it.disabled && "pointer-events-none opacity-40"
              )}
            >
              {it.icon && <span className="text-ink-400">{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
