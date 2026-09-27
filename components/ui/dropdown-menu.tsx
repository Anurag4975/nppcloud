"use client";
import * as React from "react";
import { createPortal } from "react-dom";
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
 *
 * The panel is rendered through a portal into document.body with
 * `position: fixed` coordinates computed from the trigger's bounding rect.
 * This takes it out of any ancestor with `overflow-hidden` (e.g. a list
 * view's <ul>) or a hover-driven opacity wrapper (e.g. a row's
 * `opacity-0 group-hover:opacity-100` actions container) — so the menu can
 * no longer be clipped or hidden mid-hover while the cursor travels from the
 * trigger down to an item.
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
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const PANEL_WIDTH = 180;
  const MARGIN = 4;

  const computeCoords = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + MARGIN;
    const left = align === "right" ? rect.right - PANEL_WIDTH : rect.left;
    setCoords({ top, left });
  }, [align]);

  const openMenu = () => {
    computeCoords();
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Keep the panel glued to its trigger through scroll/resize instead of
    // closing it, so it survives list scrolling in a scrollable ancestor.
    const onReposition = () => computeCoords();

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, computeCoords]);

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label ?? "Open menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
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
      {open && coords &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ position: "fixed", top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className={cn(
              "z-[1000] origin-top overflow-hidden rounded-xl border border-ink-200/80 bg-white p-1 shadow-pop",
              "animate-slide-down"
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
          </div>,
          document.body
        )}
    </div>
  );
}
