"use client";

import { useCallback, useEffect, useState } from "react";

type FolderRow = { id: string; name: string };
type FileRow = { id: string; name: string; size_bytes: number; status: string };
type Usage = { plan: { name: string; quota_bytes: number } | null; usage: { stored_bytes: number } | null };
type Crumb = { id: string | null; name: string };

export default function DashboardClient() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "My Files" }]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{ url: string; fileName: string } | null>(null);

  const currentFolderId = path[path.length - 1].id;

  const refresh = useCallback(async () => {
    const qs = currentFolderId ? `?parent_id=${currentFolderId}` : "";
    const [filesRes, usageRes] = await Promise.all([fetch(`/api/files${qs}`), fetch("/api/usage")]);
    const filesJson = await filesRes.json();
    const usageJson = await usageRes.json();
    setFolders(filesJson.folders ?? []);
    setFiles(filesJson.files ?? []);
    setUsage(usageJson);
  }, [currentFolderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openFolder(folder: FolderRow) {
    setPath((p) => [...p, { id: folder.id, name: folder.name }]);
  }

  function jumpTo(index: number) {
    setPath((p) => p.slice(0, index + 1));
  }

  async function handleNewFolder() {
    const name = prompt("Folder name");
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: currentFolderId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Could not create folder.");
      return;
    }
    await refresh();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const initRes = await fetch("/api/files/init-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, mime_type: file.type, parent_id: currentFolderId }),
      });

      let initJson: any = null;
      try {
        initJson = await initRes.json();
      } catch {
        throw new Error(`Server error (${initRes.status}) — check the terminal running npm run dev.`);
      }
      if (!initRes.ok) throw new Error(initJson.error?.message ?? "Could not start upload.");

      await fetch(initJson.upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await fetch("/api/files/complete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: initJson.file_id }),
      });

      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(fileId: string) {
    const res = await fetch(`/api/files/${fileId}/download-url`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? "Download failed.");
      return;
    }
    window.location.href = json.download_url;
  }

  async function handleRename(item: FileRow | FolderRow, kind: "file" | "folder") {
    const name = prompt("New name", item.name);
    if (!name || name === item.name) return;
    const endpoint = kind === "file" ? `/api/files/${item.id}` : `/api/folders/${item.id}`;
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await refresh();
  }

  async function handleDelete(id: string, kind: "file" | "folder") {
    if (!confirm(`Delete this ${kind}? ${kind === "file" ? "It moves to trash." : "This cannot be undone."}`)) return;
    const endpoint = kind === "file" ? `/api/files/${id}` : `/api/folders/${id}`;
    await fetch(endpoint, { method: "DELETE" });
    await refresh();
  }

  async function handleShare(file: FileRow) {
    const res = await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: file.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? "Could not create share link.");
      return;
    }
    setShareInfo({ url: json.share_url, fileName: file.name });
  }

  const quotaGB = usage?.plan ? (usage.plan.quota_bytes / 1e9).toFixed(0) : "-";
  const usedGB = usage?.usage ? (usage.usage.stored_bytes / 1e9).toFixed(2) : "0";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10" onClick={() => setOpenMenuId(null)}>
      <div className="mb-4 flex items-center justify-between">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          {path.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300">/</span>}
              <button
                onClick={() => jumpTo(i)}
                className={i === path.length - 1 ? "font-semibold text-slate-800" : "hover:underline"}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="text-sm text-slate-500">
          {usedGB} GB / {quotaGB} GB {usage?.plan && <span className="ml-1 rounded bg-slate-200 px-2 py-0.5 text-xs">{usage.plan.name}</span>}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <button onClick={handleNewFolder} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          + New folder
        </button>
        <label className="flex-1 cursor-pointer rounded-md border-2 border-dashed border-slate-300 px-3 py-2 text-center text-sm text-slate-500 hover:border-slate-400">
          {uploading ? "Uploading…" : "Click to upload a file"}
          <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {shareInfo && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-slate-600">Share link for <strong>{shareInfo.fileName}</strong>:</p>
          <div className="flex items-center gap-2">
            <input readOnly value={shareInfo.url} className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
            <button
              onClick={() => navigator.clipboard.writeText(shareInfo.url)}
              className="rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700"
            >
              Copy
            </button>
            <button onClick={() => setShareInfo(null)} className="text-xs text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {folders.length === 0 && files.length === 0 && <li className="p-4 text-sm text-slate-400">Empty folder.</li>}

        {folders.map((f) => (
          <li key={f.id} className="flex items-center justify-between p-3 text-sm hover:bg-slate-50">
            <button onClick={() => openFolder(f)} className="flex items-center gap-2 text-left text-slate-800">
              📁 {f.name}
            </button>
            <ItemMenu
              open={openMenuId === f.id}
              onToggle={() => setOpenMenuId(openMenuId === f.id ? null : f.id)}
              actions={[
                { label: "Rename", onClick: () => handleRename(f, "folder") },
                { label: "Delete", onClick: () => handleDelete(f.id, "folder"), danger: true },
              ]}
            />
          </li>
        ))}

        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between p-3 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2 text-slate-800">📄 {f.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">{(f.size_bytes / 1e6).toFixed(2)} MB</span>
              <ItemMenu
                open={openMenuId === f.id}
                onToggle={() => setOpenMenuId(openMenuId === f.id ? null : f.id)}
                actions={[
                  { label: "Download", onClick: () => handleDownload(f.id) },
                  { label: "Share", onClick: () => handleShare(f) },
                  { label: "Rename", onClick: () => handleRename(f, "file") },
                  { label: "Delete", onClick: () => handleDelete(f.id, "file"), danger: true },
                ]}
              />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function ItemMenu({
  open,
  onToggle,
  actions,
}: {
  open: boolean;
  onToggle: () => void;
  actions: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggle} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                a.onClick();
                onToggle();
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${a.danger ? "text-red-600" : "text-slate-700"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

