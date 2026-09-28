"use client";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Upload,
  Link2,
  Trash2,
  Check,
  Copy,
  Download,
  Pencil,
  FolderOpen,
  Star,
  Info,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  useToast,
  Button,
  Input,
  Modal,
  EmptyState,
  FileRowSkeleton,
  cn,
  formatBytes,
} from "@/components/ui";
import { StatCards } from "@/components/dashboard/StatCards";
import {
  Toolbar,
  type SortKey,
  type ViewMode,
} from "@/components/dashboard/Toolbar";
import { FileListItem, FileGridCard } from "@/components/dashboard/FileRow";
import {
  UploadPanel,
  type UploadJob,
} from "@/components/dashboard/UploadPanel";
import type { FileRow, FolderRow, UsageResponse, ShareLink } from "@/lib/types";
import { ContextMenu } from "@/components/ui";
import {
  DetailsPanel,
  type DetailsItem,
} from "@/components/dashboard/DetailsPanel";

type Crumb = { id: string | null; name: string };

function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number, speedBps: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // If the caller already aborted before we even started, bail out
    // immediately so we don't fire a doomed request.
    if (signal?.aborted) {
      reject(new Error("Upload cancelled"));
      return;
    }
    const xhr = new XMLHttpRequest();
    // UploadJob previously had no speed field: onprogress only tracked
    // percent, not bytes/time. Track loaded-bytes + timestamp deltas here so
    // callers can show a live transfer speed alongside the progress bar.
    let lastLoaded = 0;
    let lastTime = performance.now();
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      const speedBps = dt > 0 ? (e.loaded - lastLoaded) / dt : 0;
      lastLoaded = e.loaded;
      lastTime = now;
      onProgress(Math.round((e.loaded / e.total) * 100), speedBps);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    // If signal aborts, kill the in-flight XHR. The onabort handler above
    // rejects the promise. Clean up the listener once the request settles so
    // we don't leak it on the controller.
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.send(file);
  });
}

// The folder path used to live only in React state, so the browser's back
// button couldn't undo a folder navigation and there was no explicit "up one
// level" control either. Encoding/decoding it to a query param means every
// folder we enter becomes a real history entry the back button can pop.
function decodePath(raw: string | null): Crumb[] {
  const root: Crumb = { id: null, name: "My Files" };
  if (!raw) return [root];
  try {
    const rest = JSON.parse(decodeURIComponent(raw)) as Crumb[];
    if (!Array.isArray(rest)) return [root];
    return [root, ...rest];
  } catch {
    return [root];
  }
}

export default function DashboardClient() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [sharedCount, setSharedCount] = useState(0);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<Crumb[]>(() =>
    decodePath(searchParams.get("p")),
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [view, setView] = useState<ViewMode>("list");
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Right-click context menu + details sidebar (Batch 1)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileRow | FolderRow;
    kind: "file" | "folder";
  } | null>(null);
  const [detailsItem, setDetailsItem] = useState<DetailsItem | null>(null);

  // One AbortController per in-flight upload job, keyed by jobId. The cancel
  // button reaches into this map to abort the matching XHR. Entries are
  // removed in the upload's finally block.
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  // Modals
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    kind: "file" | "folder";
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    kind: "file" | "folder";
    name: string;
  } | null>(null);
  const [shareUrl, setShareUrl] = useState<{
    id: string;
    url: string;
    name: string;
  } | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [savingSharePassword, setSavingSharePassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentFolderId = path[path.length - 1].id;

  const refresh = useCallback(async () => {
    const qs = currentFolderId ? `?parent_id=${currentFolderId}` : "";
    try {
      const [list, u, shares] = await Promise.all([
        api.get<{ folders: FolderRow[]; files: FileRow[] }>(`/api/files${qs}`),
        api.get<UsageResponse>("/api/usage").catch(() => null),
        api
          .get<{ links: ShareLink[] }>("/api/share-links")
          .catch(() => ({ links: [] as ShareLink[] })),
      ]);
      setFolders(list.folders ?? []);
      setFiles(list.files ?? []);
      if (u) setUsage(u);
      setSharedCount((shares.links ?? []).filter((l) => !l.revoked).length);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Filter + sort — deferred so typing never blocks the input
  const visibleFolders = useMemo(
    () =>
      folders
        .filter((f) =>
          f.name.toLowerCase().includes(deferredSearch.toLowerCase()),
        )
        .sort((a, b) =>
          sortKey === "name" ? a.name.localeCompare(b.name) : 0,
        ),
    [folders, deferredSearch, sortKey],
  );
  const visibleFiles = useMemo(() => {
    const filtered = files.filter((f) =>
      f.name.toLowerCase().includes(deferredSearch.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "size") return a.size_bytes - b.size_bytes;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [files, deferredSearch, sortKey]);

  const lastPushedRef = useRef<string | null>(null);

  const navigateTo = useCallback(
    (next: Crumb[]) => {
      setPath(next);
      const rest = next.slice(1);
      const raw = rest.length ? JSON.stringify(rest) : null;
      lastPushedRef.current = raw;
      router.push(
        raw ? `/dashboard?p=${encodeURIComponent(raw)}` : "/dashboard",
      );
    },
    [router],
  );

  const openFolder = (f: FolderRow) =>
    navigateTo([...path, { id: f.id, name: f.name }]);
  const jumpTo = (i: number) => navigateTo(path.slice(0, i + 1));
  const goUp = () => {
    if (path.length > 1) navigateTo(path.slice(0, -1));
  };

  // Browser back/forward changes searchParams without going through
  // navigateTo — pick that up here so the file list follows the URL.
  useEffect(() => {
    const raw = searchParams.get("p");
    const encoded = raw ? encodeURIComponent(raw) : null;
    // Skip the round-trip we just pushed ourselves.
    if (encoded === lastPushedRef.current) return;
    setPath(decodePath(raw));
  }, [searchParams]);

  // The header's Upload button lives in AppShell, outside this component —
  // it broadcasts an event instead of duplicating the file-input logic.
  useEffect(() => {
    const onTriggerUpload = () => fileInputRef.current?.click();
    window.addEventListener("nppcloud:trigger-upload", onTriggerUpload);
    return () =>
      window.removeEventListener("nppcloud:trigger-upload", onTriggerUpload);
  }, []);

  async function handleNewFolder() {
    if (creatingFolder || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.post("/api/folders", {
        name: newFolderName.trim(),
        parent_id: currentFolderId,
      });
      toast("Folder created");
      setNewFolderOpen(false);
      setNewFolderName("");
      refresh();
    } catch (e) {
      toast((e as ApiError).message, "error");
    } finally {
      setCreatingFolder(false);
    }
  }

  function cancelUpload(id: string) {
    controllersRef.current.get(id)?.abort();
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    for (const file of arr) {
      const jobId = crypto.randomUUID();
      const controller = new AbortController();
      controllersRef.current.set(jobId, controller);
      setJobs((j) => [
        ...j,
        {
          id: jobId,
          name: file.name,
          size: file.size,
          progress: 0,
          status: "uploading",
        },
      ]);
      let init: { file_id: string; upload_url: string } | undefined;
      try {
        init = await api.post<{ file_id: string; upload_url: string }>(
          "/api/files/init-upload",
          {
            name: file.name,
            size: file.size,
            mime_type: file.type,
            parent_id: currentFolderId,
          },
        );
        await putWithProgress(
          init.upload_url,
          file,
          (pct, speedBps) =>
            setJobs((j) =>
              j.map((x) =>
                x.id === jobId ? { ...x, progress: pct, speedBps } : x,
              ),
            ),
          controller.signal,
        );
        await api.post("/api/files/complete-upload", { file_id: init.file_id });
        setJobs((j) =>
          j.map((x) =>
            x.id === jobId
              ? { ...x, status: "done", progress: 100, speedBps: undefined }
              : x,
          ),
        );
      } catch (e) {
        setJobs((j) =>
          j.map((x) =>
            x.id === jobId
              ? { ...x, status: "error", error: (e as ApiError).message }
              : x,
          ),
        );
        toast(`${file.name}: ${(e as ApiError).message}`, "error");
        // Release reserved quota immediately instead of waiting for the
        // abandoned-pending sweep — reserve_upload already charged storage
        // before this upload started. This also runs on cancel, which is
        // correct: the reservation must be released either way.
        if (init?.file_id) {
          api
            .post("/api/files/abort-upload", { file_id: init.file_id })
            .catch(() => {});
        }
      } finally {
        controllersRef.current.delete(jobId);
      }
    }
    refresh();
    window.dispatchEvent(new CustomEvent("nppcloud:usage-changed"));
  }

  async function handleDownload(id: string) {
    try {
      const { download_url } = await api.get<{ download_url: string }>(
        `/api/files/${id}/download-url`,
      );
      window.location.href = download_url;
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      const endpoint =
        renameTarget.kind === "file"
          ? `/api/files/${renameTarget.id}`
          : `/api/folders/${renameTarget.id}`;
      await api.patch(endpoint, { name: renameValue.trim() });
      toast("Renamed");
      setRenameTarget(null);
      refresh();
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const endpoint =
        deleteTarget.kind === "file"
          ? `/api/files/${deleteTarget.id}`
          : `/api/folders/${deleteTarget.id}`;
      await api.del(endpoint);
      toast("Moved to trash");
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  async function toggleStar(d: DetailsItem) {
    const current =
      (d.item as FileRow & { starred?: boolean }).starred ?? false;
    const endpoint =
      d.kind === "file"
        ? `/api/files/${d.item.id}`
        : `/api/folders/${d.item.id}`;
    try {
      await api.patch(endpoint, { starred: !current });
      toast(current ? "Removed from starred" : "Added to starred");
      setDetailsItem((prev) =>
        prev ? { ...prev, item: { ...prev.item, starred: !current } } : prev,
      );
      refresh();
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  function openContextMenu(
    e: React.MouseEvent,
    item: FileRow | FolderRow,
    kind: "file" | "folder",
  ) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item, kind });
  }

  async function handleShare(file: FileRow) {
    try {
      const { link, share_url } = await api.post<{
        link: { id: string };
        share_url: string;
      }>("/api/share-links", { file_id: file.id });
      setShareUrl({ id: link.id, url: share_url, name: file.name });
      setSharePassword("");
      setCopied(false);
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  function copyShareLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl.url).then(() => {
      setCopied(true);
      toast("Link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function saveSharePassword() {
    if (!shareUrl) return;
    setSavingSharePassword(true);
    try {
      // Empty string clears any existing password (set_share_link_password
      // treats "" the same as null server-side).
      await api.patch(`/api/share-links/${shareUrl.id}`, {
        password: sharePassword,
      });
      toast(sharePassword ? "Password set" : "Password removed");
    } catch (e) {
      toast((e as ApiError).message, "error");
    } finally {
      setSavingSharePassword(false);
    }
  }

  const quota = usage?.plan?.quota_bytes ?? 0;
  const used = usage?.usage?.stored_bytes ?? 0;
  const isEmpty = visibleFolders.length === 0 && visibleFiles.length === 0;
  const isSearching = deferredSearch.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Breadcrumbs */}
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {path.length > 1 && (
          <button
            onClick={goUp}
            aria-label="Up one level"
            className="mr-1 flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {path.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-300" />}
            <button
              onClick={() => jumpTo(i)}
              className={cn(
                "rounded-md px-1.5 py-0.5 transition-colors duration-150",
                i === path.length - 1
                  ? "font-semibold text-ink-900"
                  : "text-ink-500 hover:bg-ink-100 hover:text-ink-800",
              )}
            >
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Stats */}
      <StatCards
        usedBytes={used}
        totalBytes={quota}
        fileCount={files.length}
        folderCount={folders.length}
        sharedCount={sharedCount}
      />

      {/* Toolbar */}
      <Toolbar
        search={search}
        onSearch={setSearch}
        view={view}
        onViewChange={setView}
        sortKey={sortKey}
        onSortChange={setSortKey}
        onNewFolder={() => setNewFolderOpen(true)}
        onUpload={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* File area with drag-drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
        }}
        className="relative"
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/80 backdrop-blur-sm animate-fade-in">
            <div className="flex flex-col items-center gap-2 text-brand-700">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-semibold">Drop files to upload</p>
            </div>
          </div>
        )}

        {loading ? (
          <FileRowSkeleton rows={5} />
        ) : isEmpty ? (
          <EmptyState
            icon={
              isSearching ? (
                <FolderPlus className="h-6 w-6" />
              ) : (
                <Upload className="h-6 w-6" />
              )
            }
            title={isSearching ? "No matching files" : "This folder is empty"}
            subtitle={
              isSearching
                ? "Try a different search term."
                : "Drag files here or click Upload to get started."
            }
            action={
              !isSearching && (
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload files
                </Button>
              )
            }
          />
        ) : view === "list" ? (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft">
            {visibleFolders.map((f, i) => (
              <FileListItem
                key={f.id}
                kind="folder"
                item={f}
                index={i}
                onOpen={() => openFolder(f)}
                onContextMenu={(e) => openContextMenu(e, f, "folder")}
                onRename={(id, kind, name) => {
                  setRenameTarget({ id, kind, name });
                  setRenameValue(name);
                }}
                onDelete={(id, kind, name) =>
                  setDeleteTarget({ id, kind, name })
                }
              />
            ))}
            {visibleFiles.map((f, i) => (
              <FileListItem
                key={f.id}
                kind="file"
                item={f}
                index={i + visibleFolders.length}
                onOpen={() => handleDownload(f.id)}
                onContextMenu={(e) => openContextMenu(e, f, "file")}
                onDownload={handleDownload}
                onShare={handleShare}
                onRename={(id, kind, name) => {
                  setRenameTarget({ id, kind, name });
                  setRenameValue(name);
                }}
                onDelete={(id, kind, name) =>
                  setDeleteTarget({ id, kind, name })
                }
              />
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleFolders.map((f, i) => (
              <FileGridCard
                key={f.id}
                kind="folder"
                item={f}
                index={i}
                onOpen={() => openFolder(f)}
                onContextMenu={(e) => openContextMenu(e, f, "folder")}
                onRename={(id, kind, name) => {
                  setRenameTarget({ id, kind, name });
                  setRenameValue(name);
                }}
                onDelete={(id, kind, name) =>
                  setDeleteTarget({ id, kind, name })
                }
              />
            ))}
            {visibleFiles.map((f, i) => (
              <FileGridCard
                key={f.id}
                kind="file"
                item={f}
                index={i + visibleFolders.length}
                onOpen={() => handleDownload(f.id)}
                onContextMenu={(e) => openContextMenu(e, f, "file")}
                onDownload={handleDownload}
                onShare={handleShare}
                onRename={(id, kind, name) => {
                  setRenameTarget({ id, kind, name });
                  setRenameValue(name);
                }}
                onDelete={(id, kind, name) =>
                  setDeleteTarget({ id, kind, name })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer meta */}
      <p className="text-[11px] text-ink-400">
        {formatBytes(used)} of {formatBytes(quota)} used ·{" "}
        {usage?.plan?.name ?? "Free"} plan ·{" "}
        {visibleFolders.length + visibleFiles.length} items
      </p>

      {/* Upload panel */}
      <UploadPanel
        jobs={jobs}
        onDismiss={(id) => setJobs((j) => j.filter((x) => x.id !== id))}
        onCancel={cancelUpload}
        onClearDone={() => setJobs((j) => j.filter((x) => x.status !== "done"))}
      />

      {/* Modals */}
      <Modal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="New folder"
        description="Create a folder in the current directory."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleNewFolder}
              disabled={creatingFolder}
              loading={creatingFolder}
            >
              <Check className="h-4 w-4" /> Create
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Folder name"
          onKeyDown={(e) =>
            e.key === "Enter" && !creatingFolder && handleNewFolder()
          }
        />
      </Modal>

      <Modal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename"
        description={`Rename "${renameTarget?.name}"`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </>
        }
      >
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
        />
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Move to trash?"
        description="This item will be recoverable from Trash."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Move to trash
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          <strong className="font-semibold text-ink-900">
            {deleteTarget?.name}
          </strong>{" "}
          will be moved to trash. It still counts toward your storage until
          permanently deleted.
        </p>
      </Modal>

      <Modal
        open={!!shareUrl}
        onClose={() => setShareUrl(null)}
        title={`Share "${shareUrl?.name}"`}
        description="Anyone with this link can download the file."
      >
        <div className="flex gap-2">
          <Input
            readOnly
            value={shareUrl?.url ?? ""}
            icon={<Link2 className="h-4 w-4" />}
            className="flex-1 font-mono text-xs"
          />
          <Button onClick={copyShareLink} className="shrink-0">
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="mt-4 border-t border-ink-100 pt-4">
          <p className="mb-2 text-xs font-medium text-ink-700">
            Password protection (optional)
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={sharePassword}
              onChange={(e) => setSharePassword(e.target.value)}
              placeholder="Leave blank for no password"
              className="flex-1 text-xs"
            />
            <Button
              variant="ghost"
              onClick={saveSharePassword}
              disabled={savingSharePassword}
              className="shrink-0"
            >
              {sharePassword ? "Set" : "Remove"}
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            When set, anyone opening this link has to enter the password before
            downloading.
          </p>
        </div>
      </Modal>

      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Open",
              icon: <FolderOpen className="h-3.5 w-3.5" />,
              onClick: () => {
                if (contextMenu.kind === "folder")
                  openFolder(contextMenu.item as FolderRow);
                else handleDownload(contextMenu.item.id);
              },
            },
            ...(contextMenu.kind === "file"
              ? [
                  {
                    label: "Download",
                    icon: <Download className="h-3.5 w-3.5" />,
                    onClick: () => handleDownload(contextMenu.item.id),
                  },
                  {
                    label: "Share link",
                    icon: <Link2 className="h-3.5 w-3.5" />,
                    onClick: () => handleShare(contextMenu.item as FileRow),
                  },
                ]
              : []),
            {
              label: "Rename",
              icon: <Pencil className="h-3.5 w-3.5" />,
              onClick: () => {
                setRenameTarget({
                  id: contextMenu.item.id,
                  kind: contextMenu.kind,
                  name: contextMenu.item.name,
                });
                setRenameValue(contextMenu.item.name);
              },
            },
            {
              label: (contextMenu.item as { starred?: boolean }).starred
                ? "Remove star"
                : "Add star",
              icon: <Star className="h-3.5 w-3.5" />,
              onClick: () =>
                toggleStar({
                  kind: contextMenu.kind,
                  item: contextMenu.item,
                }),
            },
            {
              label: "Details",
              icon: <Info className="h-3.5 w-3.5" />,
              onClick: () =>
                setDetailsItem({
                  kind: contextMenu.kind,
                  item: contextMenu.item,
                }),
            },
            {
              label: "Move to trash",
              icon: <Trash2 className="h-3.5 w-3.5" />,
              danger: true,
              onClick: () =>
                setDeleteTarget({
                  id: contextMenu.item.id,
                  kind: contextMenu.kind,
                  name: contextMenu.item.name,
                }),
            },
          ]}
        />
      )}

      {/* Details sidebar */}
      {detailsItem && (
        <DetailsPanel
          details={detailsItem}
          location={path.map((c) => c.name).join(" / ")}
          shareCount={sharedCount}
          onClose={() => setDetailsItem(null)}
          onDownload={handleDownload}
          onShare={handleShare}
          onRename={(id, kind, name) => {
            setRenameTarget({ id, kind, name });
            setRenameValue(name);
            setDetailsItem(null);
          }}
          onDelete={(id, kind, name) => {
            setDeleteTarget({ id, kind, name });
            setDetailsItem(null);
          }}
          onToggleStar={toggleStar}
        />
      )}
    </div>
  );
}
