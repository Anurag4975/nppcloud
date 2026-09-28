"use client";
import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
} from "lucide-react";
import { Progress, cn, formatBytes } from "@/components/ui";

export interface UploadJob {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  /** Bytes/sec, computed from xhr.upload.onprogress deltas. Undefined until
   *  the first progress tick after upload start. */
  speedBps?: number;
}

/** "1.2 MB/s", "340 KB/s", etc. — same unit ladder as formatBytes. */
export function formatSpeed(bps?: number): string {
  if (!bps || bps <= 0) return "";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bps;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

interface UploadPanelProps {
  jobs: UploadJob[];
  onDismiss: (id: string) => void;
  onCancel: (id: string) => void;
  onClearDone: () => void;
}

/**
 * Collapsible upload panel pinned bottom-right. Progress bars animate via
 * transform scaleX (compositor-only). Auto-collapses when all jobs finish.
 */
export function UploadPanel({
  jobs,
  onDismiss,
  onCancel,
  onClearDone,
}: UploadPanelProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const active = jobs.filter((j) => j.status === "uploading").length;
  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "error").length;

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,360px)] animate-slide-in-right">
      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-pop">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/80 px-3.5 py-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <UploadCloud className="h-4 w-4" />
            {active > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                {active}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-800">
              {active > 0
                ? `Uploading ${active} file${active > 1 ? "s" : ""}…`
                : "Uploads complete"}
            </p>
            <p className="text-[10px] text-ink-400">
              {done} done{failed > 0 ? ` · ${failed} failed` : ""}
            </p>
          </div>
          {done > 0 && (
            <button
              onClick={onClearDone}
              className="rounded-md px-1.5 py-1 text-[10px] font-medium text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              Clear done
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand" : "Collapse"}
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Job list */}
        {!collapsed && (
          <div className="max-h-56 space-y-1 overflow-y-auto p-2">
            {jobs.map((j) => (
              <div
                key={j.id}
                className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-ink-50"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    j.status === "done" && "bg-brand-50 text-brand-600",
                    j.status === "error" && "bg-red-50 text-red-600",
                    j.status === "uploading" && "bg-ink-100 text-ink-500",
                  )}
                >
                  {j.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : j.status === "error" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-500" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-ink-700">
                    {j.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress
                      value={j.progress}
                      variant={j.status === "error" ? "danger" : "success"}
                      className="h-1 flex-1"
                      animated={j.status === "uploading"}
                    />
                    <span className="w-10 shrink-0 text-right text-[10px] text-ink-400">
                      {j.status === "done"
                        ? "Done"
                        : j.status === "error"
                          ? "Failed"
                          : `${j.progress}%`}
                    </span>
                  </div>
                  {j.status === "uploading" && j.speedBps !== undefined && (
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {formatSpeed(j.speedBps)}
                    </p>
                  )}
                  {j.error && (
                    <p className="mt-0.5 text-[10px] text-red-500">{j.error}</p>
                  )}
                </div>
                <button
                  onClick={() =>
                    j.status === "uploading" ? onCancel(j.id) : onDismiss(j.id)
                  }
                  aria-label={
                    j.status === "uploading" ? "Cancel upload" : "Dismiss"
                  }
                  className="shrink-0 rounded p-1 text-ink-300 opacity-0 transition-all hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { formatBytes };
