"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, EmptyState, FileTypeIcon, formatBytes, Modal } from "@/components/ui/core";
import { TrashIcon, RestoreIcon, FolderIcon } from "@/components/ui/icons";
import type { FileRow, FolderRow } from "@/lib/types";

export default function TrashClient() {
  const toast = useToast();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; kind: "file" | "folder"; name: string } | null>(null);
  const refresh = () => api.get<{ files: FileRow[]; folders: FolderRow[] }>("/api/trash")
    .then((r) => { setFiles(r.files); setFolders(r.folders); }).catch(() => {});
  useEffect(() => { refresh(); }, []);

  async function restore(id: string, kind: "file" | "folder") {
    try { await api.patch(`/api/trash/${id}?kind=${kind}`, {}); toast("Restored"); refresh(); }
    catch (e) { toast((e as ApiError).message, "error"); }
  }
  async function purge() {
    if (!purgeTarget) return;
    try { await api.del(`/api/trash/${purgeTarget.id}?kind=${purgeTarget.kind}`); toast("Permanently deleted"); setPurgeTarget(null); refresh(); }
    catch (e) { toast((e as ApiError).message, "error"); }
  }

  const empty = files.length === 0 && folders.length === 0;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-lg font-bold text-slate-900">Trash</h1>
      <p className="mb-5 text-xs text-slate-400">Items in trash count toward your storage. Purge permanently to free space.</p>
      {empty ? (
        <EmptyState icon={<TrashIcon width={36} height={36} />} title="Trash is empty" />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {folders.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <FolderIcon className="text-amber-500" width={20} height={20} />
              <span className="flex-1 truncate text-sm text-slate-700">{f.name}</span>
              <Button size="sm" variant="secondary" onClick={() => restore(f.id, "folder")}><RestoreIcon width={14} height={14} /> Restore</Button>
              <Button size="sm" variant="ghost" onClick={() => setPurgeTarget({ id: f.id, kind: "folder", name: f.name })}><TrashIcon width={14} height={14} /> Delete forever</Button>
            </li>
          ))}
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <FileTypeIcon mime={f.mime_type} />
              <span className="flex-1 truncate text-sm text-slate-700">{f.name}</span>
              <span className="hidden text-xs text-slate-400 sm:block">{formatBytes(f.size_bytes)}</span>
              <Button size="sm" variant="secondary" onClick={() => restore(f.id, "file")}><RestoreIcon width={14} height={14} /> Restore</Button>
              <Button size="sm" variant="ghost" onClick={() => setPurgeTarget({ id: f.id, kind: "file", name: f.name })}><TrashIcon width={14} height={14} /> Delete forever</Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!purgeTarget} onClose={() => setPurgeTarget(null)} title="Permanently delete?"
        footer={<><Button variant="ghost" onClick={() => setPurgeTarget(null)}>Cancel</Button><Button variant="danger" onClick={purge}><TrashIcon width={14} height={14} /> Delete forever</Button></>}>
        <p className="text-sm text-slate-600"><strong>{purgeTarget?.name}</strong> will be permanently deleted. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
