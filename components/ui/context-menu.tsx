"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Right-click context menu. Portal-rendered to document.body with fixed
 * coordinates (same approach as DropdownMenu), clamped to the viewport so it
 * never opens off-screen. Closes on outside click, Escape, scroll, or resize.
 * Usage (controlled):
 *   const [menu, setMenu] = useState<{x,y,items}|null>(null);
 *   onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [...] }); }}
 *   {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ top: y, left: x });

  // Clamp to viewport after first paint (we don't know the panel size until then).
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = y;
    let left = x;
    if (top + rect.height > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - rect.height - 8);
    }
    if (left + rect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - rect.width - 8);
    }
    setPos({ top, left });
  }, [x, y]);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: 208 }}
      className="z-[1000] origin-top overflow-hidden rounded-xl border border-ink-200/80 bg-white p-1 shadow-pop animate-slide-down"
    >
      {items.map((it, i) => (
        <button
          key={`${it.label}-${i}`}
          role="menuitem"
          disabled={it.disabled}
          onClick={() => {
            it.onClick();
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors duration-100",
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
  );
}
