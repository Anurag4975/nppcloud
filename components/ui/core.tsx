"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { XIcon, CheckIcon, AlertIcon } from "./icons";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading = false, disabled, className = "", children, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300",
    secondary:
      "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-300",
    ghost:
      "text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:bg-red-200",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs rounded-lg", md: "px-3.5 py-2 text-sm rounded-lg" };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none
        transition-all duration-150 placeholder:text-slate-400
        focus:border-slate-400 focus:ring-4 focus:ring-slate-100
        disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400
        ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal — focus-trapped, ESC to close, backdrop click to close, animated
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
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input,button")?.focus(), 10);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        className="w-full max-w-md animate-scale-in rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-slate-900/10"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            aria-label="Close"
          >
            <XIcon width={16} height={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DropdownMenu — click-outside to close, animated
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
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${open ? "bg-slate-100 text-slate-600" : ""}`}
        aria-label="More actions"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute z-20 mt-1.5 w-44 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg shadow-slate-900/10 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { it.onClick(); setOpen(false); }}
              className={`block w-full px-3.5 py-2 text-left text-sm transition-colors ${it.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
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
// Toast — lightweight context-based toasts, animated
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
            className={`pointer-events-auto flex animate-slide-up items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${t.kind === "error" ? "bg-red-600" : "bg-slate-900"}`}
            role="status"
          >
            {t.kind === "success" ? <CheckIcon width={16} height={16} className="shrink-0" /> : <AlertIcon width={16} height={16} className="shrink-0" />}
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
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
    <div className="flex animate-fade-in flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">{icon}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-xs text-slate-400">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileTypeIcon — color-coded by mime type
// ---------------------------------------------------------------------------
export function FileTypeIcon({ mime, className = "" }: { mime: string | null; className?: string }) {
  const m = mime ?? "";
  let color = "text-slate-400 bg-slate-100";
  let label = "FILE";
  if (m.startsWith("image/")) { color = "text-violet-600 bg-violet-50"; label = "IMG"; }
  else if (m.startsWith("video/")) { color = "text-rose-600 bg-rose-50"; label = "VID"; }
  else if (m.startsWith("audio/")) { color = "text-amber-600 bg-amber-50"; label = "AUD"; }
  else if (m === "application/pdf") { color = "text-red-600 bg-red-50"; label = "PDF"; }
  else if (/zip|tar|rar|7z/.test(m)) { color = "text-yellow-700 bg-yellow-50"; label = "ZIP"; }
  else if (m.startsWith("text/") || /json|xml|javascript|csv/.test(m)) { color = "text-emerald-600 bg-emerald-50"; label = "TXT"; }
  else if (/word|document/.test(m)) { color = "text-blue-600 bg-blue-50"; label = "DOC"; }
  else if (/sheet|excel/.test(m)) { color = "text-green-700 bg-green-50"; label = "XLS"; }
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide ${color} ${className}`}>
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
