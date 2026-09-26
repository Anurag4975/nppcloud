"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabsProps {
  tabs: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Segmented tabs with a sliding indicator pill. The indicator is absolutely
 * positioned and animated via transform — no layout reflow on switch.
 */
export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0 });
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.value === value));

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const btn = container.children[activeIndex] as HTMLElement | undefined;
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activeIndex, tabs.length]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-xl border border-ink-200/80 bg-ink-100/70 p-1",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-soft transition-all duration-300 ease-out-expo"
        style={{
          left: indicator.left,
          width: indicator.width,
          transitionProperty: "left, width",
        }}
      />
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium",
            "transition-colors duration-150",
            value === t.value ? "text-ink-900" : "text-ink-500 hover:text-ink-700"
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
