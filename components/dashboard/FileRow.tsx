"use client";
import * as React from "react";
import {
  MoreHorizontal,
  Download,
  Share2,
  Pencil,
  Trash2,
  Star,
  ArrowRightLeft,
  Copy as CopyIcon,
  Eye,
} from "lucide-react";
import {
  FileTypeIcon,
  FolderGlyph,
  DropdownMenu,
  Tooltip,
  cn,
  formatBytes,
  timeAgo,
} from "@/components/ui";
import type { FileRow, FolderRow } from "@/lib/types";

/* ── List row ─────────────────────────────────────────────────────── */
interface FileListItemProps {
  kind: "file" | "folder";
  item: FileRow | FolderRow;
  onOpen: () => void;
  onDownload?: (id: string) => void;
  onShare?: (file: FileRow) => void;
  onRename: (id: string, kind: "file" | "folder", name: string) => void;
  onDelete: (id: string, kind: "file" | "folder", name: string) => void;
  index: number;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMove?: (id: string, kind: "file" | "folder", name: string) => void;
  onDuplicate?: (file: FileRow) => void;
  onPreview?: (file: FileRow) => void;
}

export const FileListItem = React.memo(function FileListItem({
  kind,
  item,
  onOpen,
  onDownload,
  onShare,
  onRename,
  onDelete,
  index,
  onContextMenu,
  onMove,
  onDuplicate,
  onPreview,
}: FileListItemProps) {
  const isFolder = kind === "folder";
  const name = item.name;
  const size = isFolder ? null : (item as FileRow).size_bytes;
  const date = item.updated_at ?? item.created_at;

  const menuItems = isFolder
    ? [
        {
          label: "Rename",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: () => onRename(item.id, "folder", name),
        },
        {
          label: "Move to…",
          icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
          onClick: () => onMove?.(item.id, "folder", name),
        },
        {
          label: "Move to trash",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => onDelete(item.id, "folder", name),
        },
      ]
    : [
        {
          label: "Preview",
          icon: <Eye className="h-3.5 w-3.5" />,
          onClick: () => onPreview?.(item as FileRow),
        },
        {
          label: "Download",
          icon: <Download className="h-3.5 w-3.5" />,
          onClick: () => onDownload?.(item.id),
        },
        {
          label: "Share link",
          icon: <Share2 className="h-3.5 w-3.5" />,
          onClick: () => onShare?.(item as FileRow),
        },
        {
          label: "Rename",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: () => onRename(item.id, "file", name),
        },
        {
          label: "Move to…",
          icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
          onClick: () => onMove?.(item.id, "file", name),
        },
        {
          label: "Duplicate",
          icon: <CopyIcon className="h-3.5 w-3.5" />,
          onClick: () => onDuplicate?.(item as FileRow),
        },
        {
          label: "Move to trash",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => onDelete(item.id, "file", name),
        },
      ];

  return (
    <li
      className="group flex animate-slide-up items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-ink-50/80 sm:px-4"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
      onContextMenu={onContextMenu}
    >
      <button
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {isFolder ? (
          <FolderGlyph size="sm" />
        ) : (
          <FileTypeIcon mime={(item as FileRow).mime_type} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink-800 group-hover:text-ink-900">
            {(item as FileRow & { starred?: boolean }).starred && (
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            )}
            <span className="truncate">{name}</span>
          </p>
          <p className="text-[11px] text-ink-400">
            {isFolder ? "Folder" : formatBytes(size ?? 0)} · {timeAgo(date)}
          </p>
        </div>
      </button>

      <span className="hidden w-20 text-right text-[11px] text-ink-400 md:block">
        {isFolder ? "—" : formatBytes(size ?? 0)}
      </span>

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 transition-all duration-150 group-hover:opacity-100">
        {!isFolder && (
          <Tooltip label="Download">
            <button
              onClick={() => onDownload?.(item.id)}
              aria-label="Download"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-ink-700 hover:shadow-soft"
            >
              <Download className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        {!isFolder && (
          <Tooltip label="Share">
            <button
              onClick={() => onShare?.(item as FileRow)}
              aria-label="Share"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-ink-700 hover:shadow-soft"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        <DropdownMenu
          label="More actions"
          trigger={<MoreHorizontal className="h-4 w-4" />}
          triggerClassName="h-8 w-8"
          items={menuItems}
        />
      </div>
    </li>
  );
});

/* ── Grid card ────────────────────────────────────────────────────── */
interface FileGridCardProps extends Omit<FileListItemProps, "index"> {
  index: number;
}

export const FileGridCard = React.memo(function FileGridCard({
  kind,
  item,
  onOpen,
  onDownload,
  onShare,
  onRename,
  onDelete,
  index,
  onContextMenu,
  onMove,
  onDuplicate,
  onPreview,
}: FileGridCardProps) {
  const isFolder = kind === "folder";
  const name = item.name;
  const size = isFolder ? null : (item as FileRow).size_bytes;

  const menuItems = isFolder
    ? [
        {
          label: "Rename",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: () => onRename(item.id, "folder", name),
        },
        {
          label: "Move to…",
          icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
          onClick: () => onMove?.(item.id, "folder", name),
        },
        {
          label: "Move to trash",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => onDelete(item.id, "folder", name),
        },
      ]
    : [
        {
          label: "Preview",
          icon: <Eye className="h-3.5 w-3.5" />,
          onClick: () => onPreview?.(item as FileRow),
        },
        {
          label: "Download",
          icon: <Download className="h-3.5 w-3.5" />,
          onClick: () => onDownload?.(item.id),
        },
        {
          label: "Share link",
          icon: <Share2 className="h-3.5 w-3.5" />,
          onClick: () => onShare?.(item as FileRow),
        },
        {
          label: "Rename",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: () => onRename(item.id, "file", name),
        },
        {
          label: "Move to…",
          icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
          onClick: () => onMove?.(item.id, "file", name),
        },
        {
          label: "Duplicate",
          icon: <CopyIcon className="h-3.5 w-3.5" />,
          onClick: () => onDuplicate?.(item as FileRow),
        },
        {
          label: "Move to trash",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => onDelete(item.id, "file", name),
        },
      ];

  return (
    <div
      className="group relative flex animate-slide-up cursor-pointer flex-col items-center rounded-2xl border border-ink-200/70 bg-white p-4 text-center shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-card"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      {(item as FileRow & { starred?: boolean }).starred && (
        <div className="absolute left-2 top-2 z-10">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        </div>
      )}

      <div
        className="absolute right-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu
          label="More actions"
          trigger={<MoreHorizontal className="h-4 w-4" />}
          triggerClassName="h-7 w-7 bg-white/80 backdrop-blur-sm"
          items={menuItems}
        />
      </div>
      {isFolder ? (
        <FolderGlyph size="lg" />
      ) : (
        <FileTypeIcon mime={(item as FileRow).mime_type} size="lg" />
      )}
      <p
        className={cn(
          "mt-3 w-full truncate text-[13px] font-medium text-ink-800",
        )}
      >
        {name}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-400">
        {isFolder ? "Folder" : formatBytes(size ?? 0)}
      </p>
    </div>
  );
});
