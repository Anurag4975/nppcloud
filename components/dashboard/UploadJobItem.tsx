"use client";
import React from "react";
import { formatBytes } from "@/components/ui/core";
import { FileIcon, XIcon } from "@/components/ui/icons";
import type { UploadJobState } from "@/lib/upload";

/**
 * Memoized per-file upload row. The parent re-renders on every progress tick
 * of EVERY job unless each row is isolated — React.memo + a stable onCancel
 * callback means a progress update only re-renders the one job that changed.
 * (Phase 1: "per-file progress that doesn't re-render the whole list".)
 */
function UploadJobItemBase({ job, onCancel }: { job: UploadJobState; onCancel: (id: string) => void }) {
  const barColor =
    job.status === "error" ? "bg-danger" : job.status === "done" ? "bg-success" : "bg-accent";
  return (
    <div className="flex items-center gap-3 text-xs">
      <FileIcon width={16} height={16} className="shrink-0 text-text-faint" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-text">{job.name}</span>
          <span className="shrink-0 text-text-faint">
            {job.status === "done" ? "Done" : job.status === "error" ? "Failed" : job.status === "queued" ? "Queued" : `${job.progress}%`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${job.progress}%` }} />
        </div>
        {job.error && <p className="mt-1 text-danger">{job.error}</p>}
      </div>
      {job.status === "uploading" && (
        <button
          onClick={() => onCancel(job.id)}
          className="shrink-0 rounded p-1 text-text-faint hover:bg-surface-2 hover:text-text"
          aria-label={`Cancel upload of ${job.name}`}
        >
          <XIcon width={13} height={13} />
        </button>
      )}
      <span className="hidden w-14 shrink-0 text-right text-text-faint sm:block">{formatBytes(job.size)}</span>
    </div>
  );
}

export const UploadJobItem = React.memo(UploadJobItemBase);
