"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Share2,
  Pencil,
  Trash2,
  Star,
  Folder as FolderIcon,
  Calendar,
  Clock,
  HardDrive,
  Tag,
  Link2,
} from "lucide-react";
import { Button, FileTypeIcon, FolderGlyph, cn, formatBytes, timeAgo } from "@/components/ui";
import type { FileRow, FolderRow } from "@/lib/types";

export interface DetailsItem {
  kind: "file" | "folder";
  item: FileRow | FolderRow;
}

interface DetailsPanelProps {
  details: DetailsItem;
  /** Breadcrumb path string, e.g. "My Files / Photos". */
  location: string;
  /** Number of active share links for this file (0 for folders). */
  shareCount: number;
  onClose: () => void;
  onDownload?: (id: string) => void;
  onShare?: (file: FileRow) => void;
  onRename: (id: string, kind: "file" | "folder", name: string) => void;
  onDelete: (id: string, kind: "file" | "folder", name: string) => void;
  onToggleStar: (details: DetailsItem) => void;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-ink-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-ink-800">{value}</p>
      </div>
    </div>
  );
}

/**
 * Slide-in details sidebar (right edge). Portal-rendered, fixed position,
 * with a dimmed backdrop. Shows metadata + quick actions for the selected
 * file/folder. Folders show item count instead of size/download.
 */
export function DetailsPanel({
  details,
  location,
  shareCount,
  onClose,
  onDownload,
  onShare,
  onRename,
  onDelete,
  onToggleStar,
}: DetailsPanelProps) {
  const { kind, item } = details;
  const isFolder = kind === "folder";
  const file = isFolder ? null : (item as FileRow);
  const starred = (item as FileRow & { starred?: boolean }).starred ?? false;

  return createPortal(
    <div className="fixed inset-0 z-[900]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/20 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Item details"
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-ink-200 bg-white shadow-pop animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-ink-100 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-50">
            {isFolder ? (
              <FolderGlyph size="md" />
            ) : (
              <FileTypeIcon mime={file!.mime_type} size="md" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-[15px] font-semibold text-ink-900">{item.name}</p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              {isFolder ? "Folder" : file?.mime_type ?? "File"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Metadata */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <Row icon={<Tag className="h-3.5 w-3.5" />} label="Type" value={isFolder ? "Folder" : file?.mime_type ?? "Unknown"} />
          {!isFolder && (
            <Row icon={<HardDrive className="h-3.5 w-3.5" />} label="Size" value={formatBytes(file!.size_bytes)} />
          )}
          <Row icon={<FolderIcon className="h-3.5 w-3.5" />} label="Location" value={location} />
          <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={timeAgo(item.created_at)} />
          <Row icon={<Clock className="h-3.5 w-3.5" />} label="Modified" value={timeAgo(item.updated_at ?? item.created_at)} />
          {!isFolder && (
            <Row
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Shared"
              value={shareCount > 0 ? `${shareCount} active link${shareCount > 1 ? "s" : ""}` : "Not shared"}
            />
          )}
          <Row icon={<Star className="h-3.5 w-3.5" />} label="Starred" value={starred ? "Yes" : "No"} />
        </div>

        {/* Actions */}
        <div className="space-y-2 border-t border-ink-100 p-4">
          <div className="grid grid-cols-2 gap-2">
            {!isFolder && (
              <Button variant="outline" size="sm" onClick={() => onDownload?.(item.id)}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            )}
            {!isFolder && (
              <Button variant="outline" size="sm" onClick={() => onShare?.(file!)}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onRename(item.id, kind, item.name)}>
              <Pencil className="h-3.5 w-3.5" /> Rename
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleStar(details)}
              className={cn(starred && "text-amber-500")}
            >
              <Star className={cn("h-3.5 w-3.5", starred && "fill-amber-400 text-amber-400")} />
              {starred ? "Unstar" : "Star"}
            </Button>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => onDelete(item.id, kind, item.name)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Move to trash
          </Button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
