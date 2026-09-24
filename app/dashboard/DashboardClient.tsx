"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, Input, Modal, DropdownMenu, EmptyState, FileTypeIcon, formatBytes } from "@/components/ui/core";
import {
  FolderIcon, UploadIcon, DownloadIcon, ShareIcon, TrashIcon, PencilIcon,
  MoreIcon, SearchIcon, CheckIcon,
} from "@/components/ui/icons";
import type { FileRow, FolderRow, UsageResponse } from "@/lib/types";

type Crumb = { id: string | null; name: string };
type UploadJob = { id: string; name: string; size: number; progress: number; status: "uploading" | "done" | "error"; error?: string };
type SortKey = "name" | "size" | "created_at";

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

export default function DashboardClient() {
  const toast = useToast();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "My Files" }]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: string; kind: "file" | "folder"; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: "file" | "folder"; name: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<{ url: string; name: string } | null>(null);

  const currentFolderId = path[path.length - 1].id;

  const refresh = useCallback(async () => {
    const qs = currentFolderId ? `?parent_id=${currentFolderId}` : "";
    const [list, u] = await Promise.all([
      api.get<{ folders: FolderRow[]; files: FileRow[] }>(`/api/files${qs}`),
      api.get<UsageResponse>("/api/usage").catch(() => null),
    ]);
    setFolders(list.folders ?? []);
    setFiles(list.files ?? []);
    if (u) setUsage(u);
  }, [currentFolderId]);

  useEffect(() => { refresh(); }, [refresh]);

  const visibleFolders = useMemo(() =>
    folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => sortKey === "name" ? a.name.localeCompare(b.name) : 0),
  [folders, search, sortKey]);

  const visibleFiles = useMemo(() => {
    const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
    return filtered.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "size") return a.size_bytes - b.size_bytes;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [files, search, sortKey]);

  const openFolder = (f: FolderRow) => setPath((p) => [...p, { id: f.id, name: f.name }]);
  const jumpTo = (i: number) => setPath((p) => p.slice(0, i + 1));

  async function handleNewFolder() {
    if (!newFolderName.trim()) return;
    try {
      await api.post("/api/folders", { name: newFolderName.trim(), parent_id: currentFolderId });
      toast("Folder created");
      setNewFolderOpen(false); setNewFolderName("");
      refresh();
    } catch (e) { toast((e as ApiError).message, "error"); }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    for (const file of arr) {
      const jobId = crypto.randomUUID();
      setJobs((j) => [...j, { id: jobId, name: file.name, size: file.size, progress: 0, status: "uploading" }]);
      try {
        const init = await api.post<{ file_id: string; upload_url: string }>("/api/files/init-upload", {
          name: file.name, size: file.size, mime_type: file.type, parent_id: currentFolderId,
        });
        await putWithProgress(init.upload_url, file, (pct) =>
          setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, progress: pct } : x))));
        await api.post("/api/files/complete-upload", { file_id: init.file_id });
        setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, status: "done", progress: 100 } : x)));
      } catch (e) {
        setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, status: "error", error: (e as ApiError).message } : x)));
        toast(`${file.name}: ${(e as ApiError).message}`, "error");
      }
    }
    setTimeout(() => setJobs((j) => j.filter((x) => x.status === "uploading")), 3000);
    refresh();
  }

  async function handleDownload(id: string) {
    try {
      const { download_url } = await api.get<{ download_url: string }>(`/api/files/${id}/download-url`);
      window.location.href = download_url;
    } catch (e) { toast((e as ApiError).message, "error"); }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      const endpoint = renameTarget.kind === "file" ? `/api/files/${renameTarget.id}` : `/api/folders/${renameTarget.id}`;
      await api.patch(endpoint, { name: renameValue.trim() });
      toast("Renamed"); setRenameTarget(null); refresh();
    } catch (e) { toast((e as ApiError).message, "error"); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const endpoint = deleteTarget.kind === "file" ? `/api/files/${deleteTarget.id}` : `/api/folders/${deleteTarget.id}`;
      await api.del(endpoint);
      toast("Moved to trash"); setDeleteTarget(null); refresh();
    } catch (e) { toast((e as ApiError).message, "error"); }
  }

  async function handleShare(file: FileRow) {
    try {
      const { share_url } = await api.post<{ share_url: string }>("/api/share-links", { file_id: file.id });
      setShareUrl({ url: share_url, name: file.name });
    } catch (e) { toast((e as ApiError).message, "error"); }
  }

  const quota = usage?.plan?.quota_bytes ?? 0;
  const used = usage?.usage?.stored_bytes ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumbs + search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          {path.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300">/</span>}
              <button onClick={() => jumpTo(i)} className={i === path.length - 1 ? "font-semibold text-slate-800" : "hover:underline"}>
                {c.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width={15} height={15} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setNewFolderOpen(true)}><FolderIcon width={15} height={15} /> New folder</Button>
        <Button onClick={() => fileInputRef.current?.click()}><UploadIcon width={15} height={15} /> Upload files</Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="ml-auto rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600">
          <option value="name">Sort by name</option>
          <option value="size">Sort by size</option>
          <option value="created_at">Sort by date</option>
        </select>
      </div>

      {/* Upload jobs */}
      {jobs.length > 0 && (
        <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-3 text-xs">
              <span className="w-40 truncate text-slate-700">{j.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${j.status === "error" ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${j.progress}%` }} />
              </div>
              <span className="w-16 text-right text-slate-500">
                {j.status === "done" ? "Done" : j.status === "error" ? "Failed" : `${j.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone + list */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
        className={`rounded-xl transition-colors ${dragOver ? "bg-sky-50 ring-2 ring-sky-300" : ""}`}
      >
        {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
          <EmptyState
            icon={<UploadIcon width={36} height={36} />}
            title={search ? "No matching files" : "This folder is empty"}
            subtitle={search ? "Try a different search term." : "Drag files here or click Upload to get started."}
            action={<Button onClick={() => fileInputRef.current?.click()}><UploadIcon width={15} height={15} /> Upload files</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {visibleFolders.map((f) => (
              <li key={f.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <button onClick={() => openFolder(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <FolderIcon className="shrink-0 text-amber-500" width={20} height={20} />
                  <span className="truncate text-sm text-slate-800">{f.name}</span>
                </button>
                <DropdownMenu
                  trigger={<MoreIcon width={16} height={16} />}
                  items={[
                    { label: "Rename", onClick: () => { setRenameTarget({ id: f.id, kind: "folder", name: f.name }); setRenameValue(f.name); } },
                    { label: "Move to trash", danger: true, onClick: () => setDeleteTarget({ id: f.id, kind: "folder", name: f.name }) },
                  ]}
                />
              </li>
            ))}
            {visibleFiles.map((f) => (
              <li key={f.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <FileTypeIcon mime={f.mime_type} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{f.name}</span>
                <span className="hidden w-20 text-right text-xs text-slate-400 sm:block">{formatBytes(f.size_bytes)}</span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => handleDownload(f.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Download">
                    <DownloadIcon width={15} height={15} />
                  </button>
                  <DropdownMenu
                    trigger={<MoreIcon width={16} height={16} />}
                    items={[
                      { label: "Download", onClick: () => handleDownload(f.id) },
                      { label: "Share link", onClick: () => handleShare(f) },
                      { label: "Rename", onClick: () => { setRenameTarget({ id: f.id, kind: "file", name: f.name }); setRenameValue(f.name); } },
                      { label: "Move to trash", danger: true, onClick: () => setDeleteTarget({ id: f.id, kind: "file", name: f.name }) },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {formatBytes(used)} of {formatBytes(quota)} used · {usage?.plan?.name ?? "Free"} plan
      </p>

      {/* Modals */}
      <Modal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="New folder"
        footer={<><Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button><Button onClick={handleNewFolder}><CheckIcon width={14} height={14} /> Create</Button></>}>
        <Input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name"
          onKeyDown={(e) => e.key === "Enter" && handleNewFolder()} />
      </Modal>

      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename"
        footer={<><Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button><Button onClick={handleRename}>Save</Button></>}>
        <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRename()} />
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Move to trash?"
        footer={<><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}><TrashIcon width={14} height={14} /> Move to trash</Button></>}>
        <p className="text-sm text-slate-600">
          <strong>{deleteTarget?.name}</strong> will be moved to trash. It still counts toward your storage until permanently deleted.
        </p>
      </Modal>

      <Modal open={!!shareUrl} onClose={() => setShareUrl(null)} title={`Share "${shareUrl?.name}"`}>
        <p className="mb-2 text-xs text-slate-500">Anyone with this link can download the file (limited downloads).</p>
        <div className="flex gap-2">
          <Input readOnly value={shareUrl?.url ?? ""} className="flex-1 text-xs" />
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(shareUrl?.url ?? ""); toast("Link copied"); }}>Copy</Button>
        </div>
      </Modal>
    </div>
  );
}
