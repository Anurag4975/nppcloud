"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { XIcon, CheckIcon } from "./icons";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};
export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal — focus-trapped, ESC to close, backdrop click to close
// ---------------------------------------------------------------------------
export function Modal({
  open, onClose, title, children, footer,
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="w-full max-w-md rounded-lg bg-white shadow-xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <XIcon width={16} height={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DropdownMenu — click-outside to close
// ---------------------------------------------------------------------------
export function DropdownMenu({
  trigger, items, align = "right",
}: {
  trigger: React.ReactNode;
  items: { label: string; onClick: () => void; danger?: boolean }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="More actions">
        {trigger}
      </button>
      {open && (
        <div className={`absolute z-20 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { it.onClick(); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${it.danger ? "text-red-600" : "text-slate-700"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast — lightweight context-based toasts
// ---------------------------------------------------------------------------
type Toast = { id: number; message: string; kind: "success" | "error" };
const ToastCtx = createContext<(message: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-md px-3.5 py-2.5 text-sm text-white shadow-lg ${t.kind === "error" ? "bg-red-600" : "bg-slate-900"}`}
            role="status"
          >
            {t.kind === "success" && <CheckIcon width={16} height={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// UsageBar
// ---------------------------------------------------------------------------
export function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-14 text-center">
      <div className="mb-3 text-slate-300">{icon}</div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileTypeIcon — color-coded by mime type
// ---------------------------------------------------------------------------
export function FileTypeIcon({ mime, className = "" }: { mime: string | null; className?: string }) {
  const m = mime ?? "";
  let color = "text-slate-400";
  let label = "FILE";
  if (m.startsWith("image/")) { color = "text-violet-500"; label = "IMG"; }
  else if (m.startsWith("video/")) { color = "text-rose-500"; label = "VID"; }
  else if (m.startsWith("audio/")) { color = "text-amber-500"; label = "AUD"; }
  else if (m === "application/pdf") { color = "text-red-500"; label = "PDF"; }
  else if (/zip|tar|rar|7z/.test(m)) { color = "text-yellow-600"; label = "ZIP"; }
  else if (m.startsWith("text/") || /json|xml|javascript|csv/.test(m)) { color = "text-emerald-600"; label = "TXT"; }
  else if (/word|document/.test(m)) { color = "text-blue-600"; label = "DOC"; }
  else if (/sheet|excel/.test(m)) { color = "text-green-700"; label = "XLS"; }
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-[9px] font-bold ${color} ${className}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
