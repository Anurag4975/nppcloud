"use client";
import { useEffect, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  useToast,
  Button,
  EmptyState,
  FileTypeIcon,
  FolderGlyph,
  Modal,
  cn,
  formatBytes,
  timeAgo,
} from "@/components/ui";
import type { FileRow, FolderRow } from "@/lib/types";

export default function TrashClient() {
  const toast = useToast();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; kind: "file" | "folder"; name: string } | null>(null);

  const refresh = () =>
    api
      .get<{ files: FileRow[]; folders: FolderRow[] }>("/api/trash")
      .then((r) => {
        setFiles(r.files);
        setFolders(r.folders);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  async function restore(id: string, kind: "file" | "folder") {
    try {
      await api.patch(`/api/trash/${id}?kind=${kind}`, {});
      toast("Restored");
      refresh();
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  async function purge() {
    if (!purgeTarget) return;
    try {
      await api.del(`/api/trash/${purgeTarget.id}?kind=${purgeTarget.kind}`);
      toast("Permanently deleted");
      setPurgeTarget(null);
      refresh();
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  const empty = files.length === 0 && folders.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Trash</h1>
        <p className="mt-0.5 text-xs text-ink-500">
          Items in trash count toward your storage. Purge permanently to free space.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      ) : empty ? (
        <EmptyState icon={<Trash2 className="h-6 w-6" />} title="Trash is empty" subtitle="Deleted files and folders will appear here." />
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft">
          {folders.map((f, i) => (
            <li
              key={f.id}
              className="flex animate-slide-up items-center gap-3 px-3 py-3 transition-colors hover:bg-ink-50/80 sm:px-4"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <FolderGlyph size="sm" className="opacity-60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-700">{f.name}</p>
                <p className="text-[11px] text-ink-400">Folder · trashed {timeAgo(f.trashed_at)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => restore(f.id, "folder")}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setPurgeTarget({ id: f.id, kind: "folder", name: f.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </li>
          ))}
          {files.map((f, i) => (
            <li
              key={f.id}
              className="flex animate-slide-up items-center gap-3 px-3 py-3 transition-colors hover:bg-ink-50/80 sm:px-4"
              style={{ animationDelay: `${(i + folders.length) * 30}ms` }}
            >
              <FileTypeIcon mime={f.mime_type} size="sm" className="opacity-60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-700">{f.name}</p>
                <p className="text-[11px] text-ink-400">
                  {formatBytes(f.size_bytes)} · trashed {timeAgo(f.trashed_at)}
                </p>
              </div>
              <span className="hidden text-[11px] text-ink-400 sm:block">{formatBytes(f.size_bytes)}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => restore(f.id, "file")}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setPurgeTarget({ id: f.id, kind: "file", name: f.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        title="Permanently delete?"
        description="This action cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurgeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={purge}>
              <Trash2 className="h-4 w-4" /> Delete forever
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-800">
            <strong className="font-semibold">{purgeTarget?.name}</strong> will be permanently
            deleted. This cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
